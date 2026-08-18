import json
import logging

import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException

from app.api.routes.foods import router
from app.core.ssrf_protection import UnsafeURLError, resolve_safe_target
from app.utils.normalize_recipe import normalize_recipe

logger = logging.getLogger(__name__)


@router.get(
    "/scrape",
    summary="Extract recipe JSON-LD from a webpage",
    description="Fetches a webpage and extracts Schema.org Recipe objects from JSON-LD.",
    responses={
        200: {"description": "Success"},
        400: {"description": "Bad Request"},
    },
)
def foods_placeholder(url: str):
    try:
        target = resolve_safe_target(url)
    except UnsafeURLError as exc:
        raise HTTPException(status_code=400, detail="URL is not allowed") from exc

    try:
        with httpx.Client() as client:
            response = client.get(
                target.pinned_url,
                headers={"Host": target.host_header},
                extensions={"sni_hostname": target.sni_hostname},
                timeout=10.0,
            )
    except httpx.RequestError:
        logger.warning("Failed to fetch scrape target", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="Could not fetch URL",
        ) from None

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail={
                "message": "Source returned an error",
                "source_status_code": response.status_code,
            },
        )

    soup = BeautifulSoup(response.text, "html.parser")

    scripts = soup.find_all(
        "script",
        attrs={"type": "application/ld+json"},
    )

    recipe = None

    for script in scripts:
        try:
            data = json.loads(script.get_text())
        except json.JSONDecodeError:
            continue

        graph = data.get("@graph", [])

        if isinstance(graph, list):
            for item in graph:
                if isinstance(item, dict) and item.get("@type") == "Recipe":
                    recipe = normalize_recipe(item)

    return recipe