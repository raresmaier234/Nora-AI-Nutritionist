"""Who is calling: Supabase access tokens, and the user behind each request.

Supabase Auth signs people in (Google, Apple), and refreshes and revokes their sessions. The
app sends the session's access token, a JWT, with every request as `Authorization: Bearer
<token>`. This API never sees a password or a refresh token: it checks each access token's
signature against the Supabase project's public keys (its JWKS), checks the claims, and
loads the matching `users` row, creating it the first time (see `app/services/users.py`).

`get_current_user` is the dependency every protected route takes. Without `SUPABASE_URL` it
refuses every request (503) rather than letting anyone in.
"""

import logging
import ssl
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import certifi  # installed with httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWK, PyJWKClient, PyJWKClientConnectionError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models.user import PLANS, User
from app.db.session import get_db
from app.services import users

logger = logging.getLogger(__name__)

# Supabase's asymmetric signing keys. Never HS256: that is the legacy shared secret, and
# anyone holding it could mint tokens.
ALGORITHMS = ["ES256", "RS256"]
# Every token for a signed-in user has this audience and this role (anon keys say "anon").
AUDIENCE = "authenticated"
ROLE = "authenticated"
# Tolerated difference between Supabase's clock and ours when checking exp and iat.
CLOCK_SKEW_SECONDS = 30
# Fetching the keys happens once per process (and on rotation); don't hang a request on it.
JWKS_TIMEOUT_SECONDS = 5

bearer = HTTPBearer(
    auto_error=False,
    scheme_name="Supabase access token",
    bearerFormat="JWT",
    description="The access token of the user's Supabase session (`session.access_token`).",
)

# For `responses=` on protected routers, so Swagger lists the outcomes every one of them has.
AUTH_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"description": "No access token, or it is invalid or expired."},
    503: {"description": "Sign-in is not configured on this server, or Supabase is unreachable."},
}


@dataclass(frozen=True)
class TokenVerifier:
    """Checks access tokens issued by one Supabase project.

    `signing_key` returns the public key a token was signed with, found by the `kid` in its
    header. In production that is the project's JWKS; tests swap in their own key pair and
    issuer by overriding `get_token_verifier`.
    """

    issuer: str
    signing_key: Callable[[str], PyJWK]

    def verify(self, token: str) -> dict[str, Any]:
        """The token's claims. Raises a `jwt.PyJWTError` for any token that isn't valid."""
        claims = jwt.decode(
            token,
            self.signing_key(token),
            algorithms=ALGORITHMS,
            audience=AUDIENCE,
            issuer=self.issuer,
            leeway=CLOCK_SKEW_SECONDS,
            options={"require": ["exp", "iss", "aud", "sub"]},
        )
        if claims.get("role") != ROLE:
            raise jwt.InvalidTokenError("not a signed-in user's token")
        # Supabase's anonymous sign-ins also get the authenticated role. Nora has no guest
        # mode, so refuse them even if the project ever turns them on.
        if claims.get("is_anonymous") is True:
            raise jwt.InvalidTokenError("anonymous sessions are not accepted")
        try:
            uuid.UUID(claims["sub"])
        except (ValueError, TypeError, AttributeError):
            raise jwt.InvalidTokenError("sub is not a user id") from None
        return claims


@lru_cache
def _jwks_client(url: str) -> PyJWKClient:
    # One per process: it caches the key set, refetching when it expires or when a token
    # names a key it hasn't seen (rotation). certifi's CA bundle, because some Python
    # installs (python.org's on macOS) have none for urllib.
    return PyJWKClient(
        url,
        timeout=JWKS_TIMEOUT_SECONDS,
        ssl_context=ssl.create_default_context(cafile=certifi.where()),
    )


def get_token_verifier() -> TokenVerifier | None:
    """The verifier for the configured Supabase project, or None when SUPABASE_URL is unset.

    Also a FastAPI dependency, so tests can swap in their own keys.
    """
    supabase_url = get_settings().supabase_url
    if not supabase_url:
        return None
    auth_url = f"{supabase_url.rstrip('/')}/auth/v1"
    jwks = _jwks_client(f"{auth_url}/.well-known/jwks.json")
    return TokenVerifier(issuer=auth_url, signing_key=jwks.get_signing_key_from_jwt)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"}
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    verifier: TokenVerifier | None = Depends(get_token_verifier),
    db: Session = Depends(get_db),
) -> User:
    """The signed-in user making this request. 401 without a valid token, 503 if unconfigured."""
    if verifier is None:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Sign-in is not configured on this server.",
        )
    if credentials is None:
        raise _unauthorized("Not signed in: send an `Authorization: Bearer <access token>` header.")
    try:
        claims = verifier.verify(credentials.credentials)
    except PyJWKClientConnectionError as exc:
        # The token may well be fine; it just can't be checked right now. A 401 would make
        # the app sign the user out.
        logger.warning("Could not fetch Supabase's signing keys: %s", exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not check the access token right now. Try again shortly.",
        ) from exc
    except jwt.PyJWTError as exc:
        raise _unauthorized(f"Invalid access token: {exc}") from exc
    return users.get_or_create(db, claims)


def require_plan(plan: str) -> Callable[..., User]:
    """A dependency that lets through only users on `plan` or a higher one; others get 403.

        @router.post("/...", dependencies=[Depends(require_plan("premium"))])
    """
    if plan not in PLANS:
        raise ValueError(f"unknown plan {plan!r}; expected one of {PLANS}")

    def dependency(user: User = Depends(get_current_user)) -> User:
        if not users.has_plan(user, plan):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail=f"This needs the {plan} plan; you are on the "
                f"{users.current_plan(user)} plan.",
            )
        return user

    return dependency
