"""Guards outbound scraper requests against SSRF, including basic DNS-rebinding protection."""

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

from app.services.scraping.errors import UnsafeURLError

ALLOWED_SCHEMES = {"http", "https"}


@dataclass(frozen=True)
class SafeRequestTarget:
    """A URL rewritten to connect directly to an already-validated IP address.

    Connecting to `pinned_url` instead of the original hostname closes the gap where DNS
    could resolve differently between the validation check and the actual connection (DNS
    rebinding). `host_header`/`sni_hostname` preserve the original hostname for virtual
    hosting and TLS certificate validation.
    """

    pinned_url: str
    host_header: str
    sni_hostname: str


def _is_disallowed_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def resolve_safe_target(url: str) -> SafeRequestTarget:
    """Validate `url` and return a request target pinned to a pre-checked, public IP.

    Raises UnsafeURLError if the scheme isn't http/https, the URL has no hostname, the
    hostname can't be resolved, or any resolved address is private/loopback/link-local/
    multicast/reserved/unspecified — this covers cloud metadata endpoints such as
    169.254.169.254, which fall under link-local.
    """
    parts = urlsplit(url)

    if parts.scheme not in ALLOWED_SCHEMES:
        raise UnsafeURLError(f"Unsupported URL scheme: {parts.scheme!r}")

    hostname = parts.hostname
    if not hostname:
        raise UnsafeURLError("URL is missing a hostname")

    try:
        addr_infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise UnsafeURLError(f"Could not resolve host: {hostname}") from exc

    resolved_ips = {info[4][0] for info in addr_infos}
    if not resolved_ips:
        raise UnsafeURLError(f"Could not resolve host: {hostname}")

    for ip_str in resolved_ips:
        ip = ipaddress.ip_address(ip_str.split("%", 1)[0])  # strip IPv6 zone id, if any
        if _is_disallowed_ip(ip):
            raise UnsafeURLError(f"URL resolves to a disallowed address: {ip_str}")

    # Pin the connection to one of the IPs just validated, rather than letting the HTTP
    # client re-resolve the hostname later — re-resolving would reopen the DNS rebinding
    # gap (a public IP now, a private one a moment later).
    pinned_ip = next(iter(resolved_ips))
    netloc = f"[{pinned_ip}]" if ":" in pinned_ip else pinned_ip
    if parts.port:
        netloc = f"{netloc}:{parts.port}"

    pinned_url = urlunsplit(
        (parts.scheme, netloc, parts.path or "/", parts.query, parts.fragment)
    )

    return SafeRequestTarget(pinned_url=pinned_url, host_header=hostname, sni_hostname=hostname)
