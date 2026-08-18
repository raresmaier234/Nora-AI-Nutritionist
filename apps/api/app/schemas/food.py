from pydantic import BaseModel


class Nutrition(BaseModel):
    calories: str | None = None
    carbohydrateContent: str | None = None
    proteinContent: str | None = None
    fatContent: str | None = None
    saturatedFatContent: str | None = None
    cholesterolContent: str | None = None
    sodiumContent: str | None = None
    fiberContent: str | None = None
    sugarContent: str | None = None
    unsaturatedFatContent: str | None = None
    servingSize: str | None = None


class Recipe(BaseModel):
    name: str
    ingredients: list[str]
    nutrition: Nutrition | None = None
