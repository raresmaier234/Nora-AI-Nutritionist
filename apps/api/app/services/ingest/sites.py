"""The websites the crawler is allowed to touch.

The operator lists them in a TOML file (`sites.toml` by default). Nothing outside that list
is ever fetched: manual seeding rejects off-list URLs, discovery only keeps sitemap entries
on a listed site, and the fetcher refuses a redirect to an unlisted host.

    [[site]]
    host = "www.eatthismuch.com"
    paths = ["/calories/"]
    skip_sitemaps = ["recipes", "quantities", "branded"]

Only `host` is required. `paths` defaults to the whole site.
"""

from __future__ import annotations

import re
import tomllib
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

_KNOWN_KEYS = frozenset(
    {
        "host",
        "paths",
        "url_pattern",
        "skip_sitemaps",
        "skip_pages_containing",
        "always_per_100g",
        "reader",
    }
)


class SitesFileError(ValueError):
    """The sites file is missing, malformed, or describes a site ambiguously."""


@dataclass(frozen=True)
class Site:
    """One allowed website.

    `host` must match exactly: `kaufland.ro` does not cover `www.kaufland.ro`. List the
    host the site actually serves pages from, or its redirects will be refused.
    """

    host: str
    # A URL must start with one of these to be crawled. "/" means the whole site.
    paths: tuple[str, ...] = ("/",)
    # When set, the URL's path must also match this regex in full. For sites whose single
    # food pages and multi-food category pages share a prefix: "/Calorii-Oua/" is a table
    # of forty foods, "/Calorii-Albus-de-ou.html" is one.
    url_pattern: str | None = None
    # Sitemaps whose URL contains any of these words are never fetched. EatThisMuch
    # publishes a recipes family whose every entry 404s, and a quantities family that
    # restates foods already listed elsewhere.
    skip_sitemaps: tuple[str, ...] = ()
    # Some sites print every value per 100g without ever saying "per 100g" (food
    # encyclopedias do this), and the model then guesses a serving. With this on, every food
    # from the site is read as per 100g whatever the model says. Only turn it on for a site
    # you have checked: nothing downstream can detect it being wrong.
    always_per_100g: bool = False
    # A page whose HTML contains any of these is skipped without being read. For sites
    # that mark user-submitted entries as unreviewed, say.
    skip_pages_containing: tuple[str, ...] = ()
    # The name of a reader in `sources.readers` that pulls values straight out of the
    # page's own data, with no model involved. For sites that publish nutrition as
    # structured data rather than as a visible table.
    reader: str | None = None

    @property
    def base_url(self) -> str:
        return f"https://{self.host}/"

    def owns(self, url: str) -> bool:
        """Whether `url` is on this site and under one of its paths.

        Only plainly written URLs qualify. Dot segments are refused because the HTTP client
        resolves them before sending: "/calories/../account" passes a prefix check but
        requests "/account". Userinfo and explicit ports are refused because they make the
        same host look like a different origin to robots.txt and the rate limiter.
        """
        try:
            parts = urlsplit(url)
            port = parts.port
        except ValueError:  # an unparseable port
            return False
        segments = parts.path.split("/")
        return (
            parts.scheme in ("http", "https")
            and (parts.hostname or "") == self.host
            and port is None
            and "@" not in parts.netloc
            and "." not in segments
            and ".." not in segments
            and parts.path.startswith(self.paths)
            and (self.url_pattern is None or re.fullmatch(self.url_pattern, parts.path) is not None)
        )


@dataclass(frozen=True)
class SiteList:
    sites: tuple[Site, ...]

    @property
    def hosts(self) -> frozenset[str]:
        return frozenset(site.host for site in self.sites)

    def site_for(self, url: str) -> Site | None:
        """The listed site that owns `url`, or None if the URL is off the list."""
        for site in self.sites:
            if site.owns(url):
                return site
        return None

    def require_enforced_by(self, allowed_hosts: frozenset[str] | None) -> None:
        """Raise unless a fetcher's host allowlist is at least as strict as this list.

        The host check on redirects lives in the fetcher, which only enforces it when given
        a list. Callers that crawl on behalf of a SiteList check this up front, so a caller
        that forgets to pass the list fails immediately instead of silently following
        redirects anywhere on the internet.
        """
        if allowed_hosts is None or not allowed_hosts <= self.hosts:
            raise ValueError(
                "the RobotsCache must be built with allowed_hosts=sites.hosts, "
                "or redirects can leave the site list"
            )

    def get(self, host: str) -> Site:
        for site in self.sites:
            if site.host == host:
                return site
        raise KeyError(f"{host!r} is not in the sites file; listed: {sorted(self.hosts)}")


def load_sites(path: str | Path) -> SiteList:
    """Read and validate a sites file."""
    path = Path(path)
    try:
        data = tomllib.loads(path.read_text())
    except FileNotFoundError:
        raise SitesFileError(f"sites file not found: {path}") from None
    except tomllib.TOMLDecodeError as exc:
        raise SitesFileError(f"{path} is not valid TOML: {exc}") from None

    entries = data.get("site", [])
    if not isinstance(entries, list) or not entries:
        raise SitesFileError(f"{path} lists no sites; add at least one [[site]] table")

    sites = tuple(_parse_site(entry, index, path) for index, entry in enumerate(entries, 1))

    seen: set[str] = set()
    for site in sites:
        if site.host in seen:
            raise SitesFileError(
                f"{path}: {site.host} is listed twice; put all its paths in one entry"
            )
        seen.add(site.host)

    return SiteList(sites=sites)


def _parse_site(entry: object, index: int, path: Path) -> Site:
    where = f"{path}, site #{index}"
    if not isinstance(entry, dict):
        raise SitesFileError(f"{where}: expected a [[site]] table")

    unknown = set(entry) - _KNOWN_KEYS
    if unknown:
        raise SitesFileError(f"{where}: unknown keys {sorted(unknown)}")

    host = entry.get("host")
    if not isinstance(host, str) or not host.strip():
        raise SitesFileError(f"{where}: 'host' is required")
    host = host.strip().lower()
    if "/" in host or ":" in host:
        raise SitesFileError(
            f"{where}: host {host!r} should be a bare hostname like 'www.example.com', "
            "without a scheme, port or path"
        )

    paths = _string_list(entry.get("paths", ["/"]), f"{where}: 'paths'")
    for prefix in paths:
        if not prefix.startswith("/"):
            raise SitesFileError(f"{where}: path {prefix!r} must start with '/'")

    skip = _string_list(entry.get("skip_sitemaps", []), f"{where}: 'skip_sitemaps'")

    always_per_100g = entry.get("always_per_100g", False)
    if not isinstance(always_per_100g, bool):
        raise SitesFileError(f"{where}: 'always_per_100g' must be true or false")

    url_pattern = entry.get("url_pattern")
    if url_pattern is not None:
        if not isinstance(url_pattern, str):
            raise SitesFileError(f"{where}: 'url_pattern' must be a string")
        try:
            re.compile(url_pattern)
        except re.error as exc:
            raise SitesFileError(f"{where}: 'url_pattern' is not a valid regex: {exc}") from None

    skip_pages = _string_list(
        entry.get("skip_pages_containing", []), f"{where}: 'skip_pages_containing'"
    )

    reader = entry.get("reader")
    if reader is not None and (not isinstance(reader, str) or not reader.strip()):
        raise SitesFileError(f"{where}: 'reader' must be a reader name")

    return Site(
        host=host,
        paths=tuple(paths) or ("/",),
        url_pattern=url_pattern,
        skip_sitemaps=tuple(word.lower() for word in skip),
        always_per_100g=always_per_100g,
        skip_pages_containing=tuple(skip_pages),
        reader=reader.strip() if reader else None,
    )


def _string_list(value: object, what: str) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise SitesFileError(f"{what} must be a list of strings")
    return value
