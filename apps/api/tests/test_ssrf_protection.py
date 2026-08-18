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

from app.core.ssrf_protection import UnsafeURLError, resolve_safe_target
from app.services.scrapper import foods_placeholder


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


# --- foods_placeholder (route handler): SSRF is enforced before any network call --


def test_scrape_endpoint_rejects_loopback_url(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_if_called(*args: object, **kwargs: object) -> None:
        raise AssertionError("httpx.Client.get should never be called for a blocked URL")

    monkeypatch.setattr(httpx.Client, "get", fail_if_called)

    with pytest.raises(HTTPException) as exc_info:
        foods_placeholder(url="http://127.0.0.1/admin")

    assert exc_info.value.status_code == 400


def test_scrape_endpoint_rejects_metadata_url(monkeypatch: pytest.MonkeyPatch) -> None:
    def fail_if_called(*args: object, **kwargs: object) -> None:
        raise AssertionError("httpx.Client.get should never be called for a blocked URL")

    monkeypatch.setattr(httpx.Client, "get", fail_if_called)

    with pytest.raises(HTTPException) as exc_info:
        foods_placeholder(url="http://169.254.169.254/latest/meta-data/iam/security-credentials/")

    assert exc_info.value.status_code == 400


def test_scrape_endpoint_does_not_leak_raw_exception_details(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_get(self: httpx.Client, *args: object, **kwargs: object) -> None:
        raise httpx.ConnectError("connection refused by db-primary.internal:5432")

    monkeypatch.setattr(httpx.Client, "get", fake_get)

    with pytest.raises(HTTPException) as exc_info:
        foods_placeholder(url="http://93.184.216.34/recipe")

    detail = exc_info.value.detail
    assert detail == "Could not fetch URL"
    assert "db-primary" not in str(detail)
    assert "5432" not in str(detail)


def test_scrape_endpoint_uses_pinned_target_on_success(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[dict] = []

    def fake_get(self: httpx.Client, url: str, **kwargs: object) -> httpx.Response:
        calls.append({"url": url, **kwargs})
        html = (
            '<html><script type="application/ld+json">'
            '{"@graph": [{"@type": "Recipe", "name": "Soup", '
            '"recipeIngredient": ["water"]}]}'
            "</script></html>"
        )
        return httpx.Response(200, text=html)

    def fake_getaddrinfo(host: str, *args: object, **kwargs: object) -> list:
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 0))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    monkeypatch.setattr(httpx.Client, "get", fake_get)

    recipe = foods_placeholder(url="http://example.com/recipe")

    assert recipe is not None
    assert recipe.name == "Soup"
    assert len(calls) == 1
    assert calls[0]["url"] == "http://93.184.216.34/recipe"
    assert calls[0]["headers"] == {"Host": "example.com"}
    assert calls[0]["extensions"] == {"sni_hostname": "example.com"}
