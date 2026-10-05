"""Tests for the sites file: the list of websites the crawler may touch."""

from pathlib import Path

import pytest

from app.services.ingest.sites import Site, SiteList, SitesFileError, load_sites

REPO_SITES_FILE = Path(__file__).resolve().parent.parent / "sites.toml"


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "sites.toml"
    path.write_text(text)
    return path


def test_loads_sites_with_defaults(tmp_path) -> None:
    sites = load_sites(
        write(
            tmp_path,
            """
            [[site]]
            host = "WWW.Example.com"

            [[site]]
            host = "www.eatthismuch.com"
            paths = ["/calories/"]
            skip_sitemaps = ["Recipes"]
            always_per_100g = true
            """,
        )
    )

    assert sites.sites[0] == Site(host="www.example.com")
    assert sites.sites[0].paths == ("/",)
    assert sites.sites[1].skip_sitemaps == ("recipes",)
    assert sites.sites[1].always_per_100g is True
    assert sites.hosts == {"www.example.com", "www.eatthismuch.com"}


def test_the_committed_sites_file_is_valid() -> None:
    assert load_sites(REPO_SITES_FILE).sites


@pytest.mark.parametrize(
    ("body", "message"),
    [
        ("", "lists no sites"),
        ('[[site]]\npaths = ["/"]\n', "'host' is required"),
        ('[[site]]\nhost = "https://www.example.com"\n', "bare hostname"),
        ('[[site]]\nhost = "www.example.com/foods"\n', "bare hostname"),
        ('[[site]]\nhost = "www.example.com"\npaths = ["foods/"]\n', "must start with '/'"),
        ('[[site]]\nhost = "www.example.com"\npaths = "/foods/"\n', "list of strings"),
        ('[[site]]\nhost = "www.example.com"\nhosts = "typo"\n', "unknown keys"),
        ('[[site]]\nhost = "a.com"\n[[site]]\nhost = "a.com"\n', "listed twice"),
        ('[[site]]\nhost = "a.com"\nurl_pattern = "/(unclosed"\n', "not a valid regex"),
        ('[[site]]\nhost = "a.com"\nskip_pages_containing = "x"\n', "list of strings"),
        ("not = [valid", "not valid TOML"),
    ],
)
def test_rejects_a_malformed_file(tmp_path, body, message) -> None:
    with pytest.raises(SitesFileError, match=message):
        load_sites(write(tmp_path, body))


def test_a_missing_file_says_where_it_looked(tmp_path) -> None:
    with pytest.raises(SitesFileError, match="not found"):
        load_sites(tmp_path / "nope.toml")


SITES = SiteList(
    sites=(
        Site(host="www.eatthismuch.com", paths=("/calories/",)),
        Site(host="www.kaufland.ro"),
    )
)


@pytest.mark.parametrize(
    ("url", "host"),
    [
        ("https://www.eatthismuch.com/calories/butter-1", "www.eatthismuch.com"),
        ("http://www.eatthismuch.com/calories/butter-1", "www.eatthismuch.com"),
        ("https://www.kaufland.ro/anything.html?x=1", "www.kaufland.ro"),
        # Off the listed path.
        ("https://www.eatthismuch.com/recipes/lasagne", None),
        # Hosts must match exactly.
        ("https://eatthismuch.com/calories/butter-1", None),
        ("https://www.eatthismuch.com.evil.example/calories/x", None),
        ("https://kaufland.ro/", None),
        ("ftp://www.kaufland.ro/", None),
        ("not a url", None),
        # The client resolves dot segments before sending, escaping the listed path.
        ("https://www.eatthismuch.com/calories/../account/settings", None),
        ("https://www.eatthismuch.com/calories/./butter-1", None),
        # Same host under another origin: its own robots.txt and rate-limit clock.
        ("https://www.eatthismuch.com:8443/calories/butter-1", None),
        ("https://user@www.eatthismuch.com/calories/butter-1", None),
        ("https://www.eatthismuch.com:notaport/calories/x", None),
    ],
)
def test_finds_the_site_that_owns_a_url(url, host) -> None:
    site = SITES.site_for(url)
    assert (site.host if site else None) == host


def test_url_pattern_keeps_category_pages_out() -> None:
    site = Site(
        host="calorii.oneden.com", paths=("/Calorii-",), url_pattern=r"/Calorii-[^/]+\.html"
    )

    assert site.owns("https://calorii.oneden.com/Calorii-Albus-de-ou.html")
    assert not site.owns("https://calorii.oneden.com/Calorii-Oua/")
    assert not site.owns("https://calorii.oneden.com/Calorii-Oua/Albus.html")


def test_get_names_the_listed_hosts_when_one_is_missing() -> None:
    with pytest.raises(KeyError, match="www.kaufland.ro"):
        SITES.get("www.tesco.com")
