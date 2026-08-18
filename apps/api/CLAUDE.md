# Project

Nora AI Nutritionist API.

# Purpose

FastAPI backend for the Nora AI Nutritionist mobile application.

# Stack

- Python
- FastAPI
- PostgreSQL
- SQLAlchemy
- Alembic
- pytest

# Architecture rules

- Keep architecture simple.
- Prefer explicit code.
- Avoid unnecessary abstractions.
- Do not introduce new architectural layers without a reason.
- Keep routes focused on HTTP/API concerns.
- Put actual business logic in services when it becomes complex enough to justify them.
- Keep database models separate from API schemas.
- Do not put secrets in source code.
- Do not modify the Expo mobile app (`apps/mobile/` in this repo) from here.
- Do not add dependencies without a reason.

# API & Swagger rules

- All API endpoints must be versioned under /api/v1/.
- Every real endpoint must have a meaningful Swagger summary and description.
- Use Pydantic request/response schemas.
- Do not expose SQLAlchemy models directly.
- Use appropriate response models.
- Keep Swagger documentation synchronized with the actual API.
- Do not document functionality that does not exist.
- Do not create fake endpoints simply for documentation.

# Documentation

Read these before making significant changes:

- docs/architecture.md
- docs/api.md
- docs/database.md
- docs/development.md

# Important rule

If a future task would significantly change the architecture, explain the proposed change before implementing it.
