"""Supabase Auth's admin API, called with the project's secret key. Server side only.

Used for one thing: deleting a person's Supabase user when they delete their account, so they
can no longer sign in. Everything else about users lives in our own database.
"""

import uuid
from dataclasses import dataclass

import httpx

from app.core.config import get_settings

TIMEOUT_SECONDS = 10


class SupabaseAdminError(Exception):
    """Supabase did not confirm the change: unreachable, or it answered with an error."""


@dataclass(frozen=True)
class SupabaseAdmin:
    url: str
    secret_key: str
    # Tests fake Supabase with an httpx.MockTransport; None sends real requests.
    transport: httpx.BaseTransport | None = None

    def delete_user(self, user_id: uuid.UUID) -> None:
        """Delete the Supabase user. One Supabase no longer has counts as deleted."""
        try:
            with httpx.Client(transport=self.transport, timeout=TIMEOUT_SECONDS) as client:
                # The key in both headers, as Supabase's own clients send it.
                response = client.delete(
                    f"{self.url.rstrip('/')}/auth/v1/admin/users/{user_id}",
                    headers={
                        "apikey": self.secret_key,
                        "Authorization": f"Bearer {self.secret_key}",
                    },
                )
        except httpx.HTTPError as exc:
            raise SupabaseAdminError(f"Supabase could not be reached: {exc}") from exc
        if response.status_code == httpx.codes.NOT_FOUND:
            return
        if response.is_error:
            raise SupabaseAdminError(
                f"Supabase answered {response.status_code}: {response.text[:200]}"
            )


def get_supabase_admin() -> SupabaseAdmin | None:
    """The admin client, or None when SUPABASE_URL or SUPABASE_SECRET_KEY is unset.

    Also a FastAPI dependency, so tests can fake Supabase.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_secret_key:
        return None
    return SupabaseAdmin(url=settings.supabase_url, secret_key=settings.supabase_secret_key)
