"""Aggregates all route modules under a single /api/v1 prefix."""

from fastapi import APIRouter

from app.api.routes import barcodes, foods, health, meals, nutrition, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)
api_router.include_router(users.router)
api_router.include_router(foods.router)
api_router.include_router(barcodes.router)
api_router.include_router(meals.router)
api_router.include_router(nutrition.router)
