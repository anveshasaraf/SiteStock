"""
Per-project role enforcement tests.
These use a fake JWT with the correct structure; the pool is mocked.
"""
import time
import uuid
import pytest
import jose.jwt as jwt
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient

SECRET = "test-secret-at-least-32-characters-long"


def make_token(user_id: str, email: str = "test@example.com", exp_offset: int = 3600):
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "iat": int(time.time()),
        "exp": int(time.time()) + exp_offset,
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")


def make_profile(user_id: str, memberships: dict, is_super_admin: bool = False):
    return {
        "id": user_id,
        "name": "Test User",
        "email": "test@example.com",
        "is_super_admin": is_super_admin,
        "memberships": memberships,
    }


@pytest.fixture
def app():
    import os
    os.environ["SUPABASE_JWT_SECRET"] = SECRET
    os.environ["DATABASE_URL"] = "postgresql://test/test"
    os.environ["SUPABASE_URL"] = "https://placeholder.supabase.co"
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "placeholder"
    os.environ["SUPABASE_STORAGE_BUCKET"] = "attachments"
    os.environ["CORS_ORIGINS"] = "http://localhost:3000"
    from server import app
    return app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


SITE_A = str(uuid.uuid4())
SITE_B = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())


def _mock_get_current_user(memberships, is_super_admin=False):
    async def _inner(_request):
        return make_profile(USER_ID, memberships, is_super_admin)
    return _inner


class TestProjectIsolation:
    """Users in site A should not read/write site B."""

    def test_viewer_can_read_own_site_stock(self, client):
        token = make_token(USER_ID)
        profile = make_profile(USER_ID, {SITE_A: "viewer"})
        with patch("auth_supabase.get_current_user", new=_mock_get_current_user({SITE_A: "viewer"})):
            with patch("db.get_pool") as mock_pool:
                mock_conn = AsyncMock()
                mock_conn.fetch = AsyncMock(return_value=[])
                mock_pool.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
                r = client.get(f"/api/p/{SITE_A}/stock",
                               headers={"Authorization": f"Bearer {token}"})
        # 200 or 500 (pool mocked minimally) — should NOT be 403
        assert r.status_code != 403

    def test_viewer_blocked_from_other_site(self, client):
        token = make_token(USER_ID)
        with patch("auth_supabase.get_current_user", new=_mock_get_current_user({SITE_A: "viewer"})):
            r = client.get(f"/api/p/{SITE_B}/stock",
                           headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403

    def test_logger_can_post_movement_to_own_site(self, client):
        token = make_token(USER_ID)
        with patch("auth_supabase.get_current_user", new=_mock_get_current_user({SITE_A: "logger"})):
            with patch("db.get_pool") as mock_pool:
                mock_conn = AsyncMock()
                mock_conn.fetchrow = AsyncMock(return_value={"id": str(uuid.uuid4()), "item_id": str(uuid.uuid4()), "quantity": 10, "rate": 100, "amount": 1000, "type": "inward", "reference": "", "notes": "", "issued_to": None, "created_at": "2025-01-01T00:00:00", "item_name": "Cement"})
                mock_pool.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
                r = client.post(f"/api/p/{SITE_A}/movements",
                                json={"item_id": str(uuid.uuid4()), "quantity": 10, "rate": 100, "type": "inward", "reference": "REF-001", "notes": "", "issued_to": ""},
                                headers={"Authorization": f"Bearer {token}"})
        assert r.status_code != 403

    def test_logger_blocked_from_other_site_write(self, client):
        token = make_token(USER_ID)
        with patch("auth_supabase.get_current_user", new=_mock_get_current_user({SITE_A: "logger"})):
            r = client.post(f"/api/p/{SITE_B}/movements",
                            json={"item_id": str(uuid.uuid4()), "quantity": 10, "rate": 100, "type": "inward"},
                            headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403

    def test_unauthenticated_is_401(self, client):
        r = client.get(f"/api/p/{SITE_A}/stock")
        assert r.status_code == 401

    def test_super_admin_can_access_any_site(self, client):
        token = make_token(USER_ID)
        with patch("auth_supabase.get_current_user", new=_mock_get_current_user({}, is_super_admin=True)):
            with patch("db.get_pool") as mock_pool:
                mock_conn = AsyncMock()
                mock_conn.fetch = AsyncMock(return_value=[])
                mock_pool.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
                r = client.get(f"/api/p/{SITE_B}/stock",
                               headers={"Authorization": f"Bearer {token}"})
        assert r.status_code != 403

    def test_viewer_cannot_delete_movement(self, client):
        token = make_token(USER_ID)
        with patch("auth_supabase.get_current_user", new=_mock_get_current_user({SITE_A: "viewer"})):
            r = client.delete(f"/api/p/{SITE_A}/movements/{uuid.uuid4()}",
                              headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403

    def test_logger_cannot_delete_movement(self, client):
        token = make_token(USER_ID)
        with patch("auth_supabase.get_current_user", new=_mock_get_current_user({SITE_A: "logger"})):
            r = client.delete(f"/api/p/{SITE_A}/movements/{uuid.uuid4()}",
                              headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 403

    def test_manager_can_delete_movement(self, client):
        token = make_token(USER_ID)
        with patch("auth_supabase.get_current_user", new=_mock_get_current_user({SITE_A: "manager"})):
            with patch("db.get_pool") as mock_pool:
                mock_conn = AsyncMock()
                mock_conn.fetchrow = AsyncMock(return_value={"id": str(uuid.uuid4()), "site_id": SITE_A, "deleted_at": None})
                mock_conn.execute = AsyncMock(return_value="UPDATE 1")
                mock_pool.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
                r = client.delete(f"/api/p/{SITE_A}/movements/{uuid.uuid4()}",
                                  headers={"Authorization": f"Bearer {token}"})
        assert r.status_code != 403
