"""robots.txt fetching, caching and rate limiting.

`RobotsCache.fetch()` is the single door every crawl request goes through, so respecting
robots is structural rather than a convention someone remembers to follow.

Notes on stdlib `urllib.robotparser`, all verified against Python 3.11:

- A parser that was never `parse()`d answers `can_fetch → False` for everything. That
  reads as "robots blocked us" when it means "we never asked", so fetch failures are
  mapped to an explicit policy below rather than left to a blank parser.
- `Crawl-delay: 2.5` is silently dropped (the value must be all digits). The floor here
  covers that.
- `Disallow: /*?` wildcards are not supported, so it *under*-blocks. Sufficient for the
  simple rule sets we target, but not to be trusted as a general gate.
- User-agent matching is a substring test on the token before the first `/`. A name
  containing another bot's token would inherit that bot's rules, so ours is distinct.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import httpx

from app.services.scraping.errors import FetchError, RobotsDisallowedError
from app.services.scraping.fetcher import TEXT_CONTENT_TYPES, fetch_document

logger = logging.getLogger(__name__)

# Identifies the crawler honestly and gives operators a contact point. Deliberately not
# containing another bot's token — see the module docstring.
CRAWLER_USER_AGENT = "NoraFoodBot/1.0 (+https://github.com/raresmaier234/Nora-AI-Nutritionist)"
CRAWLER_AGENT_TOKEN = "NoraFoodBot"

# Politeness floor. Sites that welcome bulk crawlers commonly ask 2s, and this is a
# background job with no latency requirement, so we take that as a minimum even where
# robots grants us an unlimited rate.
DEFAULT_CRAWL_DELAY_SECONDS = 2.0

ROBOTS_MAX_BYTES = 512 * 1024


def origin_of(url: str) -> str:
    """Scheme + host + port — the scope robots.txt itself applies to."""
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, "", "", ""))


@dataclass(frozen=True)
class RobotsPolicy:
    """The rules for one origin, plus the delay we will actually honour."""

    origin: str
    crawl_delay: float
    sitemaps: tuple[str, ...]
    allow_all: bool = False
    disallow_all: bool = False
    parser: RobotFileParser | None = None
    agent_token: str = CRAWLER_AGENT_TOKEN

    def can_fetch(self, url: str) -> bool:
        if self.disallow_all:
            return False
        if self.allow_all or self.parser is None:
            return True
        return self.parser.can_fetch(self.agent_token, url)


class RobotsCache:
    """Fetches robots.txt once per origin and paces requests to each host."""

    def __init__(
        self,
        *,
        user_agent: str = CRAWLER_USER_AGENT,
        agent_token: str = CRAWLER_AGENT_TOKEN,
        default_delay: float = DEFAULT_CRAWL_DELAY_SECONDS,
        client: httpx.Client | None = None,
        timeout: float = 10.0,
    ) -> None:
        self._user_agent = user_agent
        self._agent_token = agent_token
        self._default_delay = default_delay
        self._client = client
        self._timeout = timeout
        self._policies: dict[str, RobotsPolicy] = {}
        self._last_request_start: dict[str, float] = {}

    def policy_for(self, url: str) -> RobotsPolicy:
        """Return the cached policy for this URL's origin, fetching robots.txt if needed."""
        origin = origin_of(url)
        cached = self._policies.get(origin)
        if cached is not None:
            return cached

        policy = self._load_policy(origin)
        self._policies[origin] = policy
        return policy

    def _load_policy(self, origin: str) -> RobotsPolicy:
        robots_url = f"{origin}/robots.txt"

        try:
            text = fetch_document(
                robots_url,
                content_types=TEXT_CONTENT_TYPES,
                client=self._client,
                timeout=self._timeout,
                max_bytes=ROBOTS_MAX_BYTES,
                user_agent=self._user_agent,
            )
        except FetchError as exc:
            return self._policy_for_failure(origin, exc)
        except Exception as exc:  # DNS/SSRF refusals and anything else unexpected
            logger.warning("robots.txt unreachable for %s (%s) — assuming disallowed", origin, exc)
            return RobotsPolicy(
                origin=origin,
                crawl_delay=self._default_delay,
                sitemaps=(),
                disallow_all=True,
                agent_token=self._agent_token,
            )

        parser = RobotFileParser()
        parser.parse(text.splitlines())  # also stamps mtime, so crawl_delay() works

        declared = parser.crawl_delay(self._agent_token)
        delay = max(float(declared or 0.0), self._default_delay)

        return RobotsPolicy(
            origin=origin,
            crawl_delay=delay,
            sitemaps=tuple(parser.site_maps() or ()),
            parser=parser,
            agent_token=self._agent_token,
        )

    def _policy_for_failure(self, origin: str, exc: FetchError) -> RobotsPolicy:
        """Map a robots.txt fetch failure onto a policy (RFC 9309 §2.3.1).

        "Unavailable" (404) means no restrictions; "unreachable" (5xx, network) means
        assume complete disallow. 401/403 are treated as a refusal to serve rules.
        """
        status = exc.status_code
        unavailable = status is not None and 400 <= status < 500 and status not in (401, 403, 429)

        if unavailable:
            logger.info("no robots.txt for %s (status %s) — crawling allowed", origin, status)
            return RobotsPolicy(
                origin=origin,
                crawl_delay=self._default_delay,
                sitemaps=(),
                allow_all=True,
                agent_token=self._agent_token,
            )

        logger.warning("robots.txt for %s failed (%s) — assuming disallowed", origin, exc)
        return RobotsPolicy(
            origin=origin,
            crawl_delay=self._default_delay,
            sitemaps=(),
            disallow_all=True,
            agent_token=self._agent_token,
        )

    def can_fetch(self, url: str) -> bool:
        return self.policy_for(url).can_fetch(url)

    def crawl_delay(self, url: str) -> float:
        return self.policy_for(url).crawl_delay

    def wait(self, url: str) -> None:
        """Block until this origin may be hit again, then stamp the clock.

        Measured start-to-start, not end-to-start: the obligation is that requests to the
        host are no closer together than the delay, and time already spent on extraction
        counts toward it. Sleeping the full delay *after* the work would roughly double a
        multi-day run for no benefit to the site.
        """
        origin = origin_of(url)
        delay = self.crawl_delay(url)

        previous = self._last_request_start.get(origin)
        if previous is not None:
            remaining = delay - (time.monotonic() - previous)
            if remaining > 0:
                time.sleep(remaining)

        self._last_request_start[origin] = time.monotonic()

    def fetch(self, url: str, **kwargs) -> str:
        """Fetch `url` through the robots gate and the delay clock.

        Raises RobotsDisallowedError rather than skipping quietly, so a disallowed URL is
        visible as a failure instead of looking like a page with no food on it.
        """
        if not self.can_fetch(url):
            raise RobotsDisallowedError(f"robots.txt disallows {url}")

        self.wait(url)
        kwargs.setdefault("user_agent", self._user_agent)
        kwargs.setdefault("client", self._client)
        return fetch_document(url, **kwargs)
