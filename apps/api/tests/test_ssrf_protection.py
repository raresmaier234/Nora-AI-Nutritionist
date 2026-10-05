"""Tests for the SSRF guard used by the recipe scraper.

Covers: scheme allowlisting, blocking private/loopback/link-local/multicast/reserved
addresses (including the 169.254.169.254 cloud metadata endpoint), DNS-rebinding
protection (the resolved IP is validated and then pinned for the actual request), and
that the scrape endpoint never leaks raw internal exception details to the client.
"""

import socket

import httpx
import pytest
from fastapi import HTTPException

from app.services.scraping import (
    FetchError,
    ScrapeError,
    UnsafeURLError,
    fetch_document,
    fetch_html,
    resolve_safe_target,
)


# --- resolve_safe_target: scheme & basic validation -------------------------------


def test_rejects_non_http_scheme() -> None:
    with pytest.raises(UnsafeURLError, match="scheme"):
        resolve_safe_target("ftp://example.com/recipe")


def test_rejects_missing_hostname() -> None:
    with pytest.raises(UnsafeURLError, match="hostname"):
        resolve_safe_target("http:///recipe")


def test_rejects_unresolvable_host(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_getaddrinfo(*args: object, **kwargs: object) -> None:
        raise socket.gaierror("name or service not known")

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)

    with pytest.raises(UnsafeURLError, match="resolve"):
        resolve_safe_target("http://does-not-exist.invalid/recipe")


# --- resolve_safe_target: blocked IP ranges (no DNS needed, IP literals) ----------


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/",
        "http://127.0.0.1:8080/admin",
        "http://10.1.2.3/",
        "http://172.16.0.5/",
        "http://192.168.1.1/",
        "http://169.254.169.254/latest/meta-data/",  # cloud metadata endpoint
        "http://169.254.0.1/",
        "http://0.0.0.0/",
        "http://224.0.0.1/",  # multicast
        "http://[::1]/",  # IPv6 loopback
        "http://[fe80::1]/",  # IPv6 link-local
        "http://[fc00::1]/",  # IPv6 unique-local
        "http://[::ffff:169.254.169.254]/",  # IPv4-mapped metadata address
    ],
)
def test_rejects_disallowed_ip_literals(url: str) -> None:
    with pytest.raises(UnsafeURLError):
        resolve_safe_target(url)


def test_allows_public_ip_literal() -> None:
    target = resolve_safe_target("http://93.184.216.34/recipe?x=1")

    assert target.pinned_url == "http://93.184.216.34/recipe?x=1"
    assert target.host_header == "93.184.216.34"
    assert target.sni_hostname == "93.184.216.34"


# --- resolve_safe_target: DNS rebinding ------------------------------------------


def test_rejects_hostname_that_resolves_to_a_private_ip(monkeypatch: pytest.MonkeyPatch) -> None:
    """A hostname that looks public but resolves to a private IP must be blocked."""

    def fake_getaddrinfo(host: str, *args: object, **kwargs: object) -> list:
        assert host == "attacker.example"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 0))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)

    with pytest.raises(UnsafeURLError):
        resolve_safe_target("http://attacker.example/recipe")


def test_pins_request_to_validated_ip_instead_of_hostname(monkeypatch: pytest.MonkeyPatch) -> None:
    """Once a hostname's IP is validated, the request must target that exact IP.

    This closes the DNS-rebinding gap: if we validated the hostname but then let the
    HTTP client re-resolve it at connect time, a second (different) DNS answer could
    point at a private address.
    """

    def fake_getaddrinfo(host: str, *args: object, **kwargs: object) -> list:
        assert host == "example.com"
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)

    target = resolve_safe_target("https://example.com:8443/recipe?x=1")

    assert target.pinned_url == "https://93.184.216.34:8443/recipe?x=1"
    assert target.host_header == "example.com"
    assert target.sni_hostname == "example.com"


# --- fetch_html: the guard holds for the real request path, including redirects ----


_PUBLIC_IP = "93.184.216.34"
_HOSTS = {
    "example.com": _PUBLIC_IP,
    "other.example": _PUBLIC_IP,
    "rebound.example": "127.0.0.1",
}


def _fake_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_getaddrinfo(host: str, *args: object, **kwargs: object) -> list:
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (_HOSTS[host], 0))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_fetch_html_rejects_loopback_before_connecting() -> None:
    def fail_if_called(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request may be issued for a blocked URL")

    with _client(fail_if_called) as client, pytest.raises(UnsafeURLError):
        fetch_html("http://127.0.0.1/admin", client=client)


def test_fetch_html_rejects_metadata_endpoint_before_connecting() -> None:
    def fail_if_called(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request may be issued for a blocked URL")

    with _client(fail_if_called) as client, pytest.raises(UnsafeURLError):
        fetch_html("http://169.254.169.254/latest/meta-data/", client=client)


def test_fetch_html_revalidates_redirect_targets(monkeypatch: pytest.MonkeyPatch) -> None:
    """A public page must not be able to bounce the request to a private address."""
    _fake_dns(monkeypatch)

    def redirect_to_loopback(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "http://rebound.example/admin"})

    with _client(redirect_to_loopback) as client, pytest.raises(UnsafeURLError):
        fetch_html("http://example.com/recipe", client=client)


def test_fetch_document_refuses_a_redirect_to_an_unlisted_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A listed site must not be able to send the crawler to a public host off the list."""
    _fake_dns(monkeypatch)
    requested: list[str] = []

    def redirect_elsewhere(request: httpx.Request) -> httpx.Response:
        requested.append(request.headers["host"])
        return httpx.Response(302, headers={"location": "https://other.example/page"})

    with (
        _client(redirect_elsewhere) as client,
        pytest.raises(UnsafeURLError, match="other.example"),
    ):
        fetch_document(
            "http://example.com/recipe", client=client, allowed_hosts=frozenset({"example.com"})
        )

    assert requested == ["example.com"]  # the off-list host was never contacted


def test_fetch_document_refuses_an_unlisted_host_before_connecting() -> None:
    def fail_if_called(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no request may be issued for an unlisted host")

    with _client(fail_if_called) as client, pytest.raises(UnsafeURLError):
        fetch_document(
            "http://other.example/", client=client, allowed_hosts=frozenset({"example.com"})
        )


def test_fetch_document_follows_a_redirect_within_the_list(monkeypatch: pytest.MonkeyPatch) -> None:
    _fake_dns(monkeypatch)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/old":
            return httpx.Response(301, headers={"location": "/new"})
        return httpx.Response(200, headers={"content-type": "text/html"}, text="<p>ok</p>")

    with _client(handler) as client:
        body = fetch_document(
            "http://example.com/old", client=client, allowed_hosts=frozenset({"example.com"})
        )

    assert body == "<p>ok</p>"


def test_a_malformed_redirect_is_a_scrape_error_not_a_crash(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Callers catch ScrapeError per page; anything else would end a whole crawl."""
    _fake_dns(monkeypatch)

    def bad_location(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "/foods\t1.html"})

    with _client(bad_location) as client, pytest.raises(ScrapeError):
        fetch_document(
            "http://example.com/recipe", client=client, allowed_hosts=frozenset({"example.com"})
        )


def test_fetch_html_does_not_leak_raw_exception_details(monkeypatch: pytest.MonkeyPatch) -> None:
    _fake_dns(monkeypatch)

    def refuse(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused by db-primary.internal:5432")

    with _client(refuse) as client, pytest.raises(FetchError) as exc_info:
        fetch_html("http://example.com/recipe", client=client)

    message = str(exc_info.value)
    assert "db-primary" not in message
    assert "5432" not in message


def test_fetch_html_requests_the_pinned_ip_with_original_host(monkeypatch: pytest.MonkeyPatch) -> None:
    _fake_dns(monkeypatch)
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["host"] = request.headers["host"]
        return httpx.Response(200, headers={"content-type": "text/html"}, text="<html></html>")

    with _client(handler) as client:
        fetch_html("http://example.com/recipe", client=client)

    assert seen["url"] == f"http://{_PUBLIC_IP}/recipe"
    assert seen["host"] == "example.com"


def test_fetch_html_rejects_oversized_body(monkeypatch: pytest.MonkeyPatch) -> None:
    _fake_dns(monkeypatch)

    def huge(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"content-type": "text/html"}, text="x" * 5000)

    with _client(huge) as client, pytest.raises(FetchError, match="exceeded"):
        fetch_html("http://example.com/recipe", client=client, max_bytes=1000)


def test_fetch_html_rejects_non_html_content(monkeypatch: pytest.MonkeyPatch) -> None:
    _fake_dns(monkeypatch)

    def pdf(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"content-type": "application/pdf"}, text="%PDF-")

    with _client(pdf) as client, pytest.raises(FetchError, match="Expected HTML"):
        fetch_html("http://example.com/recipe", client=client)
