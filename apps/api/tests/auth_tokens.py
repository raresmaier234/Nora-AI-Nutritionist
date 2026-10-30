"""Access tokens for tests, signed the way Supabase Auth signs them.

Tests never call Supabase. They make their own ES256 key pair, point `get_token_verifier` at
its public key and a made-up issuer (`VERIFIER`, see conftest.py), and sign their own tokens.
"""

import time
import uuid
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from jwt import PyJWK
from jwt.algorithms import ECAlgorithm

from app.services.auth import TokenVerifier

ISSUER = "https://nora-test.supabase.co/auth/v1"
KEY_ID = "nora-test-key"

PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
# The public key as Supabase publishes its keys, at <SUPABASE_URL>/auth/v1/.well-known/jwks.json.
JWKS = {
    "keys": [
        {
            **ECAlgorithm.to_jwk(PRIVATE_KEY.public_key(), as_dict=True),
            "kid": KEY_ID,
            "alg": "ES256",
            "use": "sig",
            "key_ops": ["verify"],
            "ext": True,
        }
    ]
}
PUBLIC_JWK = PyJWK(JWKS["keys"][0])
VERIFIER = TokenVerifier(issuer=ISSUER, signing_key=lambda token: PUBLIC_JWK)

DEFAULT_EMAIL = "tester@example.com"
DEFAULT_NAME = "Test User"
DEFAULT_AVATAR = "https://lh3.googleusercontent.com/a/test-avatar"


def make_token(
    sub: uuid.UUID | str,
    *,
    email: str | None = DEFAULT_EMAIL,
    name: str | None = DEFAULT_NAME,
    avatar_url: str | None = DEFAULT_AVATAR,
    key: Any = PRIVATE_KEY,
    algorithm: str = "ES256",
    kid: str = KEY_ID,
    expires_in: int = 3600,
    **claims: Any,
) -> str:
    """A token for user `sub` with Supabase's claims. Any claim can be overridden through
    `claims`, and one set to None is left out."""
    now = int(time.time())
    metadata = {
        "email": email,
        "full_name": name,
        "name": name,
        "avatar_url": avatar_url,
        "picture": avatar_url,
        "provider_id": "1234567890",
    }
    payload = {
        "iss": ISSUER,
        "aud": "authenticated",
        "sub": str(sub),
        "role": "authenticated",
        "email": email,
        "iat": now,
        "exp": now + expires_in,
        "user_metadata": {k: v for k, v in metadata.items() if v is not None},
        "app_metadata": {"provider": "google", "providers": ["google"]},
        "aal": "aal1",
        "session_id": str(uuid.uuid4()),
        "is_anonymous": False,
        **claims,
    }
    payload = {k: v for k, v in payload.items() if v is not None}
    return jwt.encode(payload, key, algorithm=algorithm, headers={"kid": kid})


def auth_headers(sub: uuid.UUID | str, **kwargs: Any) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(sub, **kwargs)}"}
