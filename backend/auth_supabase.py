"""Supabase JWT authentication + per-project RBAC for FastAPI.

Supabase now uses RS256 asymmetric signing (JWT Signing Keys, not the legacy
HS256 shared secret). We verify tokens via the project's JWKS endpoint.
"""
import asyncio
import os
import uuid
import logging
from typing import Optional

import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Request, Depends

from db import get_pool

logger = logging.getLogger("buildtrack.auth")

SUPABASE_URL: str = os.environ["SUPABASE_URL"]

# PyJWKClient fetches the public keys from Supabase and caches them.
# On a cache miss (key rotation) it re-fetches automatically.
_jwks_client = PyJWKClient(
    f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json",
    cache_keys=True,
    lifespan=3600,  # re-fetch keys at most once per hour
)

# Role hierarchy for comparison
_ROLE_LEVEL = {"viewer": 1, "logger": 2, "manager": 3, "site_admin": 4}


# ── JWT validation ────────────────────────────────────────────────────────────

async def _decode_token(token: str) -> dict:
    """Verify a Supabase JWT using the project's JWKS endpoint (RS256)."""
    loop = asyncio.get_event_loop()
    try:
        # JWKS fetch is synchronous + cached; run in thread pool to avoid blocking
        signing_key = await loop.run_in_executor(
            None, _jwks_client.get_signing_key_from_jwt, token
        )
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired — please sign in again")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Invalid token: {e}")
    except Exception as e:
        logger.warning("JWKS verification error: %s", e)
        raise HTTPException(401, "Token verification failed")


def _extract_token(request: Request) -> Optional[str]:
    """Extract Bearer token from Authorization header or cookie fallback."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("sb-access-token")


# ── User loading ─────────────────────────────────────────────────────────────

async def get_current_user(request: Request) -> dict:
    """
    Validates the Supabase JWT and returns the user's profile + memberships.
    memberships: {site_id_str: role_str}
    """
    token = _extract_token(request)
    if not token:
        raise HTTPException(401, "Not authenticated")

    payload = await _decode_token(token)
    user_id_str: str = payload.get("sub", "")
    if not user_id_str:
        raise HTTPException(401, "Token has no subject")

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(401, "Invalid user ID in token")

    pool = await get_pool()
    async with pool.acquire() as conn:
        profile = await conn.fetchrow(
            "SELECT id, name, phone, email, is_super_admin FROM profiles WHERE id = $1",
            user_uuid,
        )
        if not profile:
            raise HTTPException(
                401, "User profile not found — account may not be set up yet"
            )

        rows = await conn.fetch(
            "SELECT site_id, role FROM memberships WHERE user_id = $1",
            user_uuid,
        )

    return {
        "id": str(profile["id"]),
        "name": profile["name"] or "",
        "phone": profile["phone"],
        "email": profile["email"],
        "is_super_admin": bool(profile["is_super_admin"]),
        "memberships": {str(r["site_id"]): r["role"] for r in rows},
    }


# ── Authorization helpers ─────────────────────────────────────────────────────

def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if not user.get("is_super_admin"):
        raise HTTPException(403, "Super-admin access required")
    return user


def require_site_role(min_role: str):
    """
    FastAPI dependency factory.
    Usage: user = Depends(require_site_role("logger"))
    The route MUST have a {site_id} path parameter.
    """
    async def _check(site_id: str, user: dict = Depends(get_current_user)) -> dict:
        if user.get("is_super_admin"):
            return {**user, "_site_id": site_id}

        user_role: Optional[str] = user["memberships"].get(site_id)
        if not user_role:
            raise HTTPException(403, "You are not a member of this project")

        if _ROLE_LEVEL.get(user_role, 0) < _ROLE_LEVEL.get(min_role, 999):
            raise HTTPException(
                403,
                f"This action requires the '{min_role}' role or higher "
                f"(your role: '{user_role}')",
            )
        return {**user, "_site_id": site_id}

    return _check


def get_user_site_role(user: dict, site_id: str) -> Optional[str]:
    if user.get("is_super_admin"):
        return "site_admin"
    return user["memberships"].get(site_id)
