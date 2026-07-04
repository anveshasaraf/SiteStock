"""Supabase Storage wrapper — replaces the Emergent object-storage integration."""
import os
import logging
import uuid as _uuid
from typing import Tuple

import httpx

logger = logging.getLogger("buildtrack.storage")

SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SERVICE_KEY: str  = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "buildtrack"
SIGNED_URL_TTL = 1800  # 30 minutes

_headers = lambda: {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
}

# Maximum upload size: 8 MB
MAX_BYTES = 8 * 1024 * 1024

ALLOWED_MIME = {
    "jpg":  "image/jpeg",
    "jpeg": "image/jpeg",
    "png":  "image/png",
    "webp": "image/webp",
    "gif":  "image/gif",
    "pdf":  "application/pdf",
}


def _storage_url(path: str = "") -> str:
    return f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"


def make_storage_path(user_id: str, ext: str) -> str:
    """Generate a collision-safe storage path for an upload."""
    return f"uploads/{user_id}/{_uuid.uuid4()}.{ext}"


async def upload_file(storage_path: str, data: bytes, content_type: str) -> dict:
    """Upload bytes to Supabase Storage. Returns {path, size}."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            _storage_url(storage_path),
            content=data,
            headers={**_headers(), "Content-Type": content_type, "x-upsert": "false"},
        )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Storage upload failed: {resp.status_code} {resp.text}")
    return {"path": storage_path, "size": len(data)}


async def get_signed_url(storage_path: str) -> str:
    """Return a short-lived signed URL for the given path."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{storage_path}",
            json={"expiresIn": SIGNED_URL_TTL},
            headers=_headers(),
        )
    if resp.status_code != 200:
        raise RuntimeError(f"Signed URL failed: {resp.status_code} {resp.text}")
    return resp.json()["signedURL"]


async def delete_file(storage_path: str) -> None:
    """Soft-delete: removes the object from storage."""
    async with httpx.AsyncClient(timeout=10) as client:
        await client.delete(
            _storage_url(storage_path),
            headers=_headers(),
        )
