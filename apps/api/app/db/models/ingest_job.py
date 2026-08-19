"""IngestJob model: one URL in the crawl frontier.

Ingesting 100k foods is a multi-day run, so progress lives in Postgres rather than in the
process. A killed run resumes by reading this table; nothing is re-fetched or re-extracted.
"""

from datetime import datetime

from sqlalchemy import DateTime, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

STATUS_PENDING = "pending"
STATUS_IN_PROGRESS = "in_progress"
STATUS_DONE = "done"
STATUS_FAILED = "failed"


class IngestJob(Base):
    __tablename__ = "ingest_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Unique, so re-seeding the frontier with an overlapping list is idempotent.
    url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)

    status: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=STATUS_PENDING, index=True
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    foods_found: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # Which adapter produced this URL, so a mixed frontier can be worked correctly.
    source: Mapped[str] = mapped_column(
        Text, nullable=False, server_default="html", index=True
    )
    # The sitemap this URL came from — provenance for debugging a bad crawl.
    discovered_from: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Stored as text on purpose: sitemaps mix full ISO-8601 with offsets and bare dates,
    # and the question this answers is "did it change since last time", not ordering.
    lastmod: Mapped[str | None] = mapped_column(Text, nullable=True)

    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
