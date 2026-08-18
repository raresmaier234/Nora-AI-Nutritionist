from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(description="Current API health status.", examples=["ok"])
