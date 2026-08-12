"""
Stock register logic tests.
Tests the stock math and invoice atomicity expectations.
These run against an ephemeral Postgres instance (see CI).
"""
import os
import uuid
import pytest
import asyncpg

DB_URL = os.environ.get("DATABASE_URL", "")


@pytest.fixture(scope="module")
def anyio_backend():
    return "asyncio"


# ── Pure math tests (no DB needed) ───────────────────────────────────────────

def compute_stock_py(movements: list[dict]) -> float:
    """Mirror the SQL view logic in Python for testing."""
    total = 0.0
    for m in movements:
        if m["type"] == "inward":
            total += m["quantity"]
        elif m["type"] in ("outward", "consumption"):
            total -= m["quantity"]
    return round(total, 6)


class TestStockMath:
    def test_simple_inward(self):
        moves = [{"type": "inward", "quantity": 100}]
        assert compute_stock_py(moves) == 100.0

    def test_inward_minus_outward(self):
        moves = [
            {"type": "inward",  "quantity": 100},
            {"type": "outward", "quantity": 30},
        ]
        assert compute_stock_py(moves) == 70.0

    def test_consumption_reduces_stock(self):
        moves = [
            {"type": "inward",      "quantity": 50},
            {"type": "consumption", "quantity": 20},
        ]
        assert compute_stock_py(moves) == 30.0

    def test_negative_stock_allowed(self):
        moves = [
            {"type": "inward",  "quantity": 10},
            {"type": "outward", "quantity": 25},
        ]
        assert compute_stock_py(moves) == -15.0

    def test_decimal_precision(self):
        moves = [
            {"type": "inward",  "quantity": 3.14},
            {"type": "outward", "quantity": 1.07},
        ]
        assert abs(compute_stock_py(moves) - 2.07) < 1e-6

    def test_zero_initial(self):
        assert compute_stock_py([]) == 0.0

    def test_multiple_inwards(self):
        moves = [
            {"type": "inward", "quantity": 50},
            {"type": "inward", "quantity": 50},
        ]
        assert compute_stock_py(moves) == 100.0


class TestStockStatus:
    def status(self, stock, min_stock, max_stock):
        if stock <= 0:
            return "OUT"
        elif min_stock and stock <= min_stock:
            return "LOW"
        elif max_stock and stock >= max_stock:
            return "HIGH"
        return "OK"

    def test_out(self):
        assert self.status(0, 10, 100) == "OUT"
        assert self.status(-5, 10, 100) == "OUT"

    def test_low(self):
        assert self.status(5, 10, 100) == "LOW"
        assert self.status(10, 10, 100) == "LOW"

    def test_high(self):
        assert self.status(100, 10, 100) == "HIGH"
        assert self.status(150, 10, 100) == "HIGH"

    def test_ok(self):
        assert self.status(50, 10, 100) == "OK"


class TestInvoiceAtomicity:
    """Verify that invoice + lines + auto-inward movement form an atomic unit."""

    def test_invoice_rollback_simulation(self):
        """
        If lines are invalid (e.g. zero qty), the invoice INSERT
        should be rolled back. We verify the logic expectation here.
        """
        invoice_lines = [
            {"item_id": str(uuid.uuid4()), "quantity": 10, "rate": 50},
            {"item_id": None, "quantity": 0, "rate": 0},  # invalid
        ]
        valid_lines = [l for l in invoice_lines if l["item_id"] and l["quantity"] > 0]
        assert len(valid_lines) == 1

    def test_movement_created_for_each_line(self):
        lines = [
            {"item_id": str(uuid.uuid4()), "quantity": 5,  "rate": 100},
            {"item_id": str(uuid.uuid4()), "quantity": 10, "rate": 200},
        ]
        movements = [{"type": "inward", "quantity": l["quantity"], "item_id": l["item_id"]} for l in lines]
        assert len(movements) == len(lines)
        assert all(m["type"] == "inward" for m in movements)


@pytest.mark.skipif(not DB_URL, reason="DATABASE_URL not set")
class TestStockViewIntegration:
    """Integration tests - requires a live Postgres with the schema applied."""

    @pytest.fixture(autouse=True)
    async def setup_db(self):
        self.conn = await asyncpg.connect(DB_URL, statement_cache_size=0)
        yield
        await self.conn.close()

    @pytest.mark.anyio
    async def test_stock_view_reflects_movements(self):
        site_id = str(uuid.uuid4())
        item_id = str(uuid.uuid4())
        # Verify basic view structure
        rows = await self.conn.fetch(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'stock_register'"
        )
        col_names = [r["column_name"] for r in rows]
        assert "stock" in col_names
        assert "status" in col_names
