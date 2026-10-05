"""tag ingest jobs by site host

Jobs used to be tagged with an adapter name ("eatthismuch", "html"). The crawler now
tags each job with the host of the listed site it belongs to, and `run --site HOST`
filters on that, so older rows are retagged from their own URL.

Revision ID: e4b8c2d91f07
Revises: c7d2e4a81b53
Create Date: 2026-09-26
"""

from collections.abc import Sequence

from alembic import op

revision: str = "e4b8c2d91f07"
down_revision: str | None = "c7d2e4a81b53"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The host is the part between "://" and the next "/", ":", "?" or "#".
    op.execute(
        """
        UPDATE ingest_jobs
        SET source = lower(substring(url from '^[a-zA-Z]+://([^/:?#]+)'))
        WHERE source IN ('eatthismuch', 'html')
          AND substring(url from '^[a-zA-Z]+://([^/:?#]+)') IS NOT NULL
        """
    )


def downgrade() -> None:
    # Only the EatThisMuch rows can be mapped back exactly; manually seeded rows on any
    # host go back to the generic "html" tag they were created with.
    op.execute(
        """
        UPDATE ingest_jobs
        SET source = CASE
            WHEN source = 'www.eatthismuch.com' AND discovered_from IS NOT NULL
                THEN 'eatthismuch'
            ELSE 'html'
        END
        """
    )
