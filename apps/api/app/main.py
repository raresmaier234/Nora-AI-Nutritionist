from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()

tags_metadata = [
    {"name": "Health", "description": "Liveness check for the API. The only endpoint open to all."},
    {
        "name": "Users",
        "description": (
            "The signed-in user's profile, plan and daily targets, and account deletion. "
            "Signing in happens in Supabase Auth (Google, Apple); every endpoint except "
            "health needs its access token as `Authorization: Bearer <token>`."
        ),
    },
    {
        "name": "Foods",
        "description": "Food database search. Values are per 100g.",
    },
    {
        "name": "Barcodes",
        "description": "Barcode-to-food lookup. Not implemented yet.",
    },
    {
        "name": "Meals",
        "description": (
            "Food logging: what was eaten, per meal and day. Each user has their own log."
        ),
    },
    {
        "name": "Nutrition",
        "description": (
            "Daily nutrition summaries and AI food photo recognition/estimation. Not "
            "implemented yet."
        ),
    },
]

app = FastAPI(
    title="Nora AI Nutritionist API",
    description="API backend for the Nora AI Nutritionist mobile application",
    version="1.0.0",
    openapi_tags=tags_metadata,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.app_host, port=settings.app_port, reload=settings.debug)