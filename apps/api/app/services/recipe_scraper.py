"""Binds the generic JSON-LD scraper to this app's Recipe model.

The one place where `app.services.scraping` meets Nora-specific types — keeping it here
is what lets that package stay portable.
"""

from app.schemas.food import Recipe
from app.services.scraping import JsonLdScraper, json_ld_scraper
from app.utils.normalize_recipe import normalize_recipe

recipe_scraper: JsonLdScraper[Recipe] = json_ld_scraper("Recipe", normalize_recipe)
