"""Exceptions raised by the scraping package.

These are deliberately framework-agnostic: nothing here knows about web frameworks, and
callers map them to whatever their layer needs.
"""


class ScrapeError(Exception):
    """Base class for every failure raised by this package."""


class UnsafeURLError(ScrapeError):
    """The URL is not safe to fetch (blocked scheme, host, or resolved address)."""


class RobotsDisallowedError(ScrapeError):
    """The site's robots.txt forbids fetching this URL."""


class FetchError(ScrapeError):
    """The page could not be retrieved (network failure, bad status, oversized body).

    `status_code` is set when the failure was an HTTP response rather than a transport
    error. Robots handling depends on the distinction: a 404 means "no rules, crawl
    freely", while a 5xx means "assume disallowed until we can ask again".
    """

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class ParseError(ScrapeError):
    """The page was retrieved but its structured data could not be interpreted."""
