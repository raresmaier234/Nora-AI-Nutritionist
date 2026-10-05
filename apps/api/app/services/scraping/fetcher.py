"""Retrieval of remote documents, guarded against SSRF.

Knows nothing about what it fetches — it returns text and raises FetchError.
"""

import logging
from urllib.parse import urljoin, urlsplit

import httpx

from app.services.scraping.errors import FetchError, UnsafeURLError
from app.services.scraping.ssrf import resolve_safe_target

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 10.0
DEFAULT_MAX_BYTES = 5 * 1024 * 1024
DEFAULT_MAX_REDIRECTS = 5
DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; RecipeScraper/1.0)"

HTML_CONTENT_TYPES = ("text/html", "application/xhtml+xml")
XML_CONTENT_TYPES = ("application/xml", "text/xml")
TEXT_CONTENT_TYPES = ("text/plain",)

# Keeps the rejection message readable. "HTML" in particular is load-bearing: existing
# tests assert on it.
_CONTENT_TYPE_LABELS = {
    HTML_CONTENT_TYPES: "HTML",
    XML_CONTENT_TYPES: "XML",
    TEXT_CONTENT_TYPES: "plain text",
}

_HTML_ACCEPT = "text/html,application/xhtml+xml"


def fetch_html(
    url: str,
    *,
    client: httpx.Client | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    max_bytes: int = DEFAULT_MAX_BYTES,
    max_redirects: int = DEFAULT_MAX_REDIRECTS,
    user_agent: str = DEFAULT_USER_AGENT,
) -> str:
    """Fetch `url` and return its HTML.

    Raises UnsafeURLError if the URL (or any redirect hop) resolves somewhere it
    shouldn't, and FetchError for network failures, non-200 responses, non-HTML content,
    or bodies exceeding `max_bytes`.

    Pass `client` to reuse a connection pool; a short-lived client is created otherwise.
    """
    return fetch_document(
        url,
        content_types=HTML_CONTENT_TYPES,
        accept=_HTML_ACCEPT,
        client=client,
        timeout=timeout,
        max_bytes=max_bytes,
        max_redirects=max_redirects,
        user_agent=user_agent,
    )


def fetch_document(
    url: str,
    *,
    content_types: tuple[str, ...] = HTML_CONTENT_TYPES,
    accept: str | None = None,
    client: httpx.Client | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    max_bytes: int = DEFAULT_MAX_BYTES,
    max_redirects: int = DEFAULT_MAX_REDIRECTS,
    user_agent: str = DEFAULT_USER_AGENT,
    allowed_hosts: frozenset[str] | None = None,
) -> str:
    """Fetch `url` and return its body as text, accepting `content_types`.

    Same SSRF, per-redirect revalidation and byte-cap guarantees as `fetch_html`; only the
    acceptable content types differ, so robots.txt and sitemaps can be read too.

    `content_types` validates the *response*; `accept` sets the request header. They are
    separate because servers routinely answer `text/xml` when asked for `application/xml`.
    An empty `content_types` disables response validation.

    `allowed_hosts`, when given, restricts every hop — the first request and each redirect
    — to those hostnames, raising UnsafeURLError otherwise. Without it a listed site can
    redirect the request to any public host.
    """
    accept_header = accept if accept is not None else ", ".join(content_types) or "*/*"

    if client is not None:
        return _fetch(
            client,
            url,
            content_types,
            accept_header,
            timeout,
            max_bytes,
            max_redirects,
            user_agent,
            allowed_hosts,
        )

    with httpx.Client() as owned_client:
        return _fetch(
            owned_client,
            url,
            content_types,
            accept_header,
            timeout,
            max_bytes,
            max_redirects,
            user_agent,
            allowed_hosts,
        )


def _fetch(
    client: httpx.Client,
    url: str,
    content_types: tuple[str, ...],
    accept: str,
    timeout: float,
    max_bytes: int,
    max_redirects: int,
    user_agent: str,
    allowed_hosts: frozenset[str] | None,
) -> str:
    current_url = url

    for _ in range(max_redirects + 1):
        if allowed_hosts is not None:
            # urlsplit, not httpx.URL: it is what resolve_safe_target uses for DNS and the
            # Host header, so the host checked here is the host actually contacted.
            host = (urlsplit(current_url).hostname or "").lower()
            if host not in allowed_hosts:
                raise UnsafeURLError(f"{host or current_url!r} is not an allowed site")

        # Re-validated on every hop: a redirect is a fresh URL, and skipping this check
        # would let a public page bounce the request to a private address.
        target = resolve_safe_target(current_url)

        headers = {
            "Host": target.host_header,
            "User-Agent": user_agent,
            "Accept": accept,
        }

        try:
            with client.stream(
                "GET",
                target.pinned_url,
                headers=headers,
                extensions={"sni_hostname": target.sni_hostname},
                timeout=timeout,
                follow_redirects=False,
            ) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        raise FetchError("Redirect response without a Location header")
                    current_url = urljoin(current_url, location)
                    continue

                if response.status_code != 200:
                    raise FetchError(
                        f"Source returned status {response.status_code}",
                        status_code=response.status_code,
                    )

                content_type = response.headers.get("content-type", "")
                if content_types and content_type:
                    if not content_type.lower().startswith(content_types):
                        label = _CONTENT_TYPE_LABELS.get(content_types) or "/".join(content_types)
                        raise FetchError(f"Expected {label}, got {content_type!r}")

                return _read_capped(response, max_bytes)

        except httpx.InvalidURL:
            # A URL urlsplit tolerates but httpx refuses (a tab in a sitemap <loc>, say).
            # Raised as a ScrapeError so one bad entry skips that URL, not the whole run.
            raise UnsafeURLError("Malformed URL") from None
        except httpx.RequestError:
            # Logged with the traceback, but the message is not propagated — it can
            # contain internal hostnames and ports.
            logger.warning("Failed to fetch scrape target", exc_info=True)
            raise FetchError("Could not fetch URL") from None

    raise FetchError(f"Exceeded {max_redirects} redirects")


def _read_capped(response: httpx.Response, max_bytes: int) -> str:
    """Read a streamed body, aborting once it exceeds `max_bytes`."""
    chunks: list[bytes] = []
    total = 0

    for chunk in response.iter_bytes():
        total += len(chunk)
        if total > max_bytes:
            raise FetchError(f"Response exceeded {max_bytes} bytes")
        chunks.append(chunk)

    body = b"".join(chunks)
    try:
        return body.decode(response.charset_encoding or "utf-8", errors="replace")
    except LookupError:
        # The server named an encoding Python doesn't know (e.g. "utf8mb4").
        return body.decode("utf-8", errors="replace")
