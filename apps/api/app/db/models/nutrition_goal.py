"""NutritionGoal model: one set of questionnaire answers a user gave for their nutrition plan.

Every answer is kept, as sent, in `answers` (JSONB), with the questionnaire version and the
consent the user gave before answering health questions (GDPR Art. 9). A user can answer
again (Change plan, a health re-check), so they can have many; the latest is the one in force.
Plans are built from a goal (`nutrition_plans.goal_id`). Answers from under-16s are never
stored. See docs/plans/ai-nutrition-plan.md.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class NutritionGoal(Base):
    __tablename__ = "nutrition_goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    questionnaire_version: Mapped[int] = mapped_column(Integer, nullable=False)
    # Every answer, including those that don't feed the algorithm (GoalAnswers, in
    # app/schemas/nutrition_plan.py).
    answers: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    # The language the user answered in; plans built from this goal are written in it.
    language: Mapped[str] = mapped_column(Text, nullable=False)
    # Which consent text the user agreed to, and when.
    consent_version: Mapped[str] = mapped_column(Text, nullable=False)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
