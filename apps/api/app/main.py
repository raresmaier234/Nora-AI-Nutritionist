from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings

settings = get_settings()

tags_metadata = [
    {"name": "Health", "description": "Liveness check for the API."},
    {
        "name": "Authentication",
        "description": "Sign up, log in, and token management. Not implemented yet.",
    },
    {
        "name": "Users",
        "description": "User profile: goals, preferences, account details. Not implemented yet.",
    },
    {
        "name": "Foods",
        "description": "Food database search and lookup. Not implemented yet.",
    },
    {
        "name": "Barcodes",
        "description": "Barcode-to-food lookup. Not implemented yet.",
    },
    {
        "name": "Meals",
        "description": "Food logging: meals and their entries. Not implemented yet.",
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