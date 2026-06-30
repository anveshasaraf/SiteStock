"""BuildTrack — Construction Inventory Management API."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import io
import csv
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Query, UploadFile, File, Header
from fastapi.responses import StreamingResponse, Response as FastResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

from storage import init_storage, put_object, get_object, APP_NAME

# --- Setup ---------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="BuildTrack API")
api = APIRouter(prefix="/api")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("buildtrack")

# --- Helpers -------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False


def make_token(user_id: str, email: str, role: str, kind: str = "access") -> str:
    exp = datetime.now(timezone.utc) + (timedelta(days=7) if kind == "refresh" else timedelta(hours=12))
    payload = {"sub": user_id, "email": email, "role": role, "type": kind, "exp": exp}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, samesite="lax", secure=False, max_age=43200, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, samesite="lax", secure=False, max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        if payload.get("type") != "access":
            raise HTTPException(401, "Invalid token")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


def scope_site_filter(user: dict, site_id: Optional[str] = None) -> dict:
    """Build a mongo filter that restricts to the user's site if non-admin."""
    if user.get("role") == "admin":
        return {"site_id": site_id} if site_id else {}
    return {"site_id": user.get("site_id")}


# --- Models --------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "site_user"] = "site_user"
    site_id: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class SiteIn(BaseModel):
    name: str
    location: Optional[str] = ""
    code: Optional[str] = ""


class CategoryIn(BaseModel):
    name: str


class ItemIn(BaseModel):
    name: str
    category: str
    unit: str = "nos"
    min_stock: float = 0
    max_stock: float = 0
    rate: float = 0
    description: Optional[str] = ""


class SupplierIn(BaseModel):
    name: str
    contact: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""


class InvoiceLine(BaseModel):
    item_id: str
    item_name: str
    unit: str
    quantity: float
    rate: float
    amount: float


class InvoiceIn(BaseModel):
    invoice_number: str
    supplier_id: str
    supplier_name: str
    site_id: str
    invoice_date: str
    gst_percent: float = 0
    lines: List[InvoiceLine]
    notes: Optional[str] = ""
    attachment_path: Optional[str] = ""
    attachment_name: Optional[str] = ""


class MovementIn(BaseModel):
    item_id: str
    site_id: str
    quantity: float
    rate: float = 0
    type: Literal["inward", "outward", "consumption"]
    reference: Optional[str] = ""
    notes: Optional[str] = ""
    issued_to: Optional[str] = ""


class PhysicalCountIn(BaseModel):
    item_id: str
    site_id: str
    counted_qty: float
    notes: Optional[str] = ""
    adjust: bool = False
    photo_path: Optional[str] = ""
    photo_name: Optional[str] = ""



# --- Auth Routes ---------------------------------------------------------
@api.post("/auth/register")
async def register(data: RegisterIn, response: Response):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    uid = new_id()
    user = {
        "id": uid,
        "email": email,
        "password_hash": hash_pw(data.password),
        "name": data.name,
        "role": data.role,
        "site_id": data.site_id,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    a = make_token(uid, email, data.role, "access")
    r = make_token(uid, email, data.role, "refresh")
    set_auth_cookies(response, a, r)
    user.pop("password_hash")
    user.pop("_id", None)
    return {"user": user, "access_token": a}


@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_pw(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    a = make_token(user["id"], email, user["role"], "access")
    r = make_token(user["id"], email, user["role"], "refresh")
    set_auth_cookies(response, a, r)
    user.pop("password_hash")
    user.pop("_id", None)
    return {"user": user, "access_token": a}


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    user.pop("_id", None)
    return user


@api.get("/users")
async def list_users(user: dict = Depends(require_admin)):
    cur = db.users.find({}, {"_id": 0, "password_hash": 0})
    return await cur.to_list(1000)


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, _: dict = Depends(require_admin)):
    await db.users.delete_one({"id": user_id})
    return {"ok": True}


# --- Sites ---------------------------------------------------------------
@api.get("/sites")
async def list_sites(user: dict = Depends(get_current_user)):
    flt = {} if user["role"] == "admin" else {"id": user.get("site_id")}
    return await db.sites.find(flt, {"_id": 0}).to_list(500)


@api.post("/sites")
async def create_site(data: SiteIn, _: dict = Depends(require_admin)):
    doc = {"id": new_id(), **data.model_dump(), "created_at": now_iso()}
    await db.sites.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/sites/{sid}")
async def update_site(sid: str, data: SiteIn, _: dict = Depends(require_admin)):
    await db.sites.update_one({"id": sid}, {"$set": data.model_dump()})
    return await db.sites.find_one({"id": sid}, {"_id": 0})


@api.delete("/sites/{sid}")
async def delete_site(sid: str, _: dict = Depends(require_admin)):
    await db.sites.delete_one({"id": sid})
    return {"ok": True}


# --- Categories ----------------------------------------------------------
@api.get("/categories")
async def list_categories(_: dict = Depends(get_current_user)):
    return await db.categories.find({}, {"_id": 0}).to_list(500)


@api.post("/categories")
async def create_category(data: CategoryIn, _: dict = Depends(get_current_user)):
    existing = await db.categories.find_one({"name": data.name})
    if existing:
        existing.pop("_id", None)
        return existing
    doc = {"id": new_id(), "name": data.name, "created_at": now_iso()}
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/categories/{cid}")
async def delete_category(cid: str, _: dict = Depends(require_admin)):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}


# --- Items ---------------------------------------------------------------
@api.get("/items")
async def list_items(_: dict = Depends(get_current_user)):
    return await db.items.find({}, {"_id": 0}).to_list(2000)


@api.post("/items")
async def create_item(data: ItemIn, _: dict = Depends(get_current_user)):
    doc = {"id": new_id(), **data.model_dump(), "created_at": now_iso()}
    await db.items.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/items/{iid}")
async def update_item(iid: str, data: ItemIn, _: dict = Depends(get_current_user)):
    await db.items.update_one({"id": iid}, {"$set": data.model_dump()})
    return await db.items.find_one({"id": iid}, {"_id": 0})


@api.delete("/items/{iid}")
async def delete_item(iid: str, _: dict = Depends(require_admin)):
    await db.items.delete_one({"id": iid})
    return {"ok": True}


# --- Suppliers -----------------------------------------------------------
@api.get("/suppliers")
async def list_suppliers(_: dict = Depends(get_current_user)):
    return await db.suppliers.find({}, {"_id": 0}).to_list(1000)


@api.post("/suppliers")
async def create_supplier(data: SupplierIn, _: dict = Depends(get_current_user)):
    doc = {"id": new_id(), **data.model_dump(), "created_at": now_iso()}
    await db.suppliers.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/suppliers/{sid}")
async def update_supplier(sid: str, data: SupplierIn, _: dict = Depends(get_current_user)):
    await db.suppliers.update_one({"id": sid}, {"$set": data.model_dump()})
    return await db.suppliers.find_one({"id": sid}, {"_id": 0})


@api.delete("/suppliers/{sid}")
async def delete_supplier(sid: str, _: dict = Depends(require_admin)):
    await db.suppliers.delete_one({"id": sid})
    return {"ok": True}


# --- Invoices ------------------------------------------------------------
@api.get("/invoices")
async def list_invoices(user: dict = Depends(get_current_user), site_id: Optional[str] = None):
    flt = scope_site_filter(user, site_id)
    return await db.invoices.find(flt, {"_id": 0}).sort("invoice_date", -1).to_list(2000)


@api.post("/invoices")
async def create_invoice(data: InvoiceIn, user: dict = Depends(get_current_user)):
    if user["role"] != "admin" and user.get("site_id") != data.site_id:
        raise HTTPException(403, "Cannot create invoice for another site")
    subtotal = sum(line.amount for line in data.lines)
    gst_amount = round(subtotal * data.gst_percent / 100, 2)
    total = round(subtotal + gst_amount, 2)
    doc = {
        "id": new_id(),
        **data.model_dump(),
        "subtotal": subtotal,
        "gst_amount": gst_amount,
        "total": total,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.invoices.insert_one(doc)
    # Auto inward entries for each line
    for line in data.lines:
        mv = {
            "id": new_id(),
            "item_id": line.item_id,
            "item_name": line.item_name,
            "site_id": data.site_id,
            "quantity": line.quantity,
            "rate": line.rate,
            "amount": line.amount,
            "type": "inward",
            "reference": f"INV:{data.invoice_number}",
            "notes": f"Auto-created from invoice {data.invoice_number}",
            "issued_to": "",
            "created_by": user["id"],
            "created_at": now_iso(),
        }
        await db.movements.insert_one(mv)
    doc.pop("_id", None)
    return doc


@api.delete("/invoices/{iid}")
async def delete_invoice(iid: str, _: dict = Depends(require_admin)):
    inv = await db.invoices.find_one({"id": iid})
    if inv:
        await db.movements.delete_many({"reference": f"INV:{inv['invoice_number']}"})
    await db.invoices.delete_one({"id": iid})
    return {"ok": True}


# --- Movements (Inward / Outward / Consumption) --------------------------
@api.get("/movements")
async def list_movements(
    user: dict = Depends(get_current_user),
    site_id: Optional[str] = None,
    mtype: Optional[str] = Query(None, alias="type"),
):
    flt = scope_site_filter(user, site_id)
    if mtype:
        flt["type"] = mtype
    return await db.movements.find(flt, {"_id": 0}).sort("created_at", -1).to_list(5000)


@api.post("/movements")
async def create_movement(data: MovementIn, user: dict = Depends(get_current_user)):
    if user["role"] != "admin" and user.get("site_id") != data.site_id:
        raise HTTPException(403, "Cannot create movement for another site")
    item = await db.items.find_one({"id": data.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")
    rate = data.rate or item.get("rate", 0)
    amount = round(rate * data.quantity, 2)
    doc = {
        "id": new_id(),
        **data.model_dump(),
        "item_name": item["name"],
        "amount": amount,
        "rate": rate,
        "created_by": user["id"],
        "created_at": now_iso(),
    }
    await db.movements.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/movements/{mid}")
async def delete_movement(mid: str, _: dict = Depends(require_admin)):
    await db.movements.delete_one({"id": mid})
    return {"ok": True}


# --- Stock Register ------------------------------------------------------
async def compute_stock(site_id: Optional[str] = None) -> List[dict]:
    items = await db.items.find({}, {"_id": 0}).to_list(5000)
    sites = await db.sites.find({}, {"_id": 0}).to_list(500)
    movements = await db.movements.find({}, {"_id": 0}).to_list(20000)

    # group movements by (site_id, item_id)
    agg: dict = {}
    for mv in movements:
        key = (mv["site_id"], mv["item_id"])
        a = agg.setdefault(key, {"inward": 0.0, "outward": 0.0, "consumption": 0.0, "last_rate": 0.0})
        a[mv["type"]] = a[mv["type"]] + float(mv["quantity"])
        if mv["type"] == "inward":
            a["last_rate"] = mv.get("rate") or a["last_rate"]

    rows: List[dict] = []
    target_sites = [s for s in sites if not site_id or s["id"] == site_id]
    for s in target_sites:
        for it in items:
            a = agg.get((s["id"], it["id"]), {"inward": 0, "outward": 0, "consumption": 0, "last_rate": 0})
            stock = a["inward"] - a["outward"] - a["consumption"]
            min_s = float(it.get("min_stock", 0))
            max_s = float(it.get("max_stock", 0))
            consumed = a["consumption"] + a["outward"]
            auto_min = round(consumed / 6.0, 2) if consumed else 0  # auto-min = avg over ~6 cycles
            status = "OK"
            if stock <= 0:
                status = "OUT"
            elif min_s and stock < min_s:
                status = "LOW"
            elif auto_min and stock < auto_min and not min_s:
                status = "LOW"
            elif max_s and stock > max_s:
                status = "HIGH"
            rows.append(
                {
                    "site_id": s["id"],
                    "site_name": s["name"],
                    "item_id": it["id"],
                    "item_name": it["name"],
                    "category": it.get("category", ""),
                    "unit": it.get("unit", ""),
                    "inward": round(a["inward"], 3),
                    "outward": round(a["outward"], 3),
                    "consumption": round(a["consumption"], 3),
                    "stock": round(stock, 3),
                    "min_stock": min_s,
                    "max_stock": max_s,
                    "auto_min_stock": auto_min,
                    "rate": a["last_rate"] or float(it.get("rate", 0)),
                    "value": round(stock * (a["last_rate"] or float(it.get("rate", 0))), 2),
                    "status": status,
                }
            )
    return rows


@api.get("/stock")
async def get_stock(user: dict = Depends(get_current_user), site_id: Optional[str] = None):
    if user["role"] != "admin":
        site_id = user.get("site_id")
    return await compute_stock(site_id)


# --- Physical Stock Audit ------------------------------------------------
async def _system_stock(item_id: str, site_id: str) -> float:
    cur = await db.movements.find({"item_id": item_id, "site_id": site_id}, {"_id": 0}).to_list(20000)
    inw = sum(float(m["quantity"]) for m in cur if m["type"] == "inward")
    out = sum(float(m["quantity"]) for m in cur if m["type"] in ("outward", "consumption"))
    return inw - out


@api.get("/physical-stock")
async def list_physical(user: dict = Depends(get_current_user), site_id: Optional[str] = None):
    if user["role"] != "admin":
        site_id = user.get("site_id")
    flt = {"site_id": site_id} if site_id else {}
    return await db.physical_counts.find(flt, {"_id": 0}).sort("created_at", -1).to_list(2000)


@api.post("/physical-stock")
async def create_physical(data: PhysicalCountIn, user: dict = Depends(get_current_user)):
    if user["role"] != "admin" and user.get("site_id") != data.site_id:
        raise HTTPException(403, "Cannot count stock at another site")
    item = await db.items.find_one({"id": data.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Item not found")
    system_qty = await _system_stock(data.item_id, data.site_id)
    variance = round(data.counted_qty - system_qty, 3)
    doc = {
        "id": new_id(),
        "item_id": data.item_id,
        "item_name": item["name"],
        "unit": item.get("unit", ""),
        "site_id": data.site_id,
        "counted_qty": data.counted_qty,
        "system_qty": round(system_qty, 3),
        "variance": variance,
        "notes": data.notes,
        "photo_path": data.photo_path or "",
        "photo_name": data.photo_name or "",
        "adjusted": bool(data.adjust and variance != 0),
        "counted_by": user["id"],
        "counted_by_name": user.get("name", ""),
        "created_at": now_iso(),
    }
    await db.physical_counts.insert_one(doc)

    if data.adjust and variance != 0:
        mv_type = "inward" if variance > 0 else "outward"
        rate = float(item.get("rate", 0))
        await db.movements.insert_one({
            "id": new_id(),
            "item_id": data.item_id,
            "item_name": item["name"],
            "site_id": data.site_id,
            "quantity": abs(variance),
            "rate": rate,
            "amount": round(abs(variance) * rate, 2),
            "type": mv_type,
            "reference": f"ADJ:{doc['id'][:8]}",
            "notes": f"Stock audit adjustment ({'+' if variance > 0 else ''}{variance})",
            "issued_to": "",
            "created_by": user["id"],
            "created_at": now_iso(),
        })
    doc.pop("_id", None)
    return doc


# --- Dashboard -----------------------------------------------------------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user), site_id: Optional[str] = None):
    if user["role"] != "admin":
        site_id = user.get("site_id")
    stock_rows = await compute_stock(site_id)
    inv_flt = {"site_id": site_id} if site_id else {}
    invoices = await db.invoices.find(inv_flt, {"_id": 0}).to_list(5000)
    mv_flt = {"site_id": site_id} if site_id else {}
    movements = await db.movements.find(mv_flt, {"_id": 0}).to_list(20000)

    total_purchase = sum(float(i.get("total", 0)) for i in invoices)
    total_consumption_value = sum(
        float(m.get("amount", 0)) for m in movements if m["type"] in ("consumption", "outward")
    )
    total_stock_value = sum(r["value"] for r in stock_rows)
    low = [r for r in stock_rows if r["status"] in ("LOW", "OUT")]
    high = [r for r in stock_rows if r["status"] == "HIGH"]

    # per-site aggregation for admin
    by_site: dict = {}
    for r in stock_rows:
        s = by_site.setdefault(r["site_name"], {"site_name": r["site_name"], "stock_value": 0, "low_count": 0})
        s["stock_value"] += r["value"]
        if r["status"] in ("LOW", "OUT"):
            s["low_count"] += 1

    # last 30 days movement trend
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    recent_mv = [m for m in movements if m.get("created_at", "") >= cutoff]
    trend: dict = {}
    for m in recent_mv:
        day = m["created_at"][:10]
        t = trend.setdefault(day, {"day": day, "inward": 0, "outward": 0, "consumption": 0})
        t[m["type"]] += float(m["quantity"])
    trend_list = sorted(trend.values(), key=lambda x: x["day"])

    return {
        "total_purchase_value": round(total_purchase, 2),
        "total_consumption_value": round(total_consumption_value, 2),
        "total_stock_value": round(total_stock_value, 2),
        "items_count": len({r["item_id"] for r in stock_rows}),
        "low_stock_count": len(low),
        "high_stock_count": len(high),
        "invoice_count": len(invoices),
        "low_stock": low[:20],
        "high_stock": high[:20],
        "by_site": list(by_site.values()),
        "trend": trend_list,
    }


# --- CSV Export ----------------------------------------------------------
def _csv_response(rows: List[dict], filename: str, headers: List[str]) -> StreamingResponse:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow(r)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@api.get("/export/stock")
async def export_stock(user: dict = Depends(get_current_user), site_id: Optional[str] = None):
    if user["role"] != "admin":
        site_id = user.get("site_id")
    rows = await compute_stock(site_id)
    headers = [
        "site_name", "item_name", "category", "unit",
        "inward", "outward", "consumption", "stock",
        "min_stock", "max_stock", "rate", "value", "status",
    ]
    return _csv_response(rows, "stock_register.csv", headers)


@api.get("/export/invoices")
async def export_invoices(user: dict = Depends(get_current_user), site_id: Optional[str] = None):
    flt = scope_site_filter(user, site_id)
    invs = await db.invoices.find(flt, {"_id": 0}).to_list(5000)
    rows = []
    for inv in invs:
        for line in inv.get("lines", []):
            rows.append(
                {
                    "invoice_number": inv["invoice_number"],
                    "invoice_date": inv["invoice_date"],
                    "supplier_name": inv["supplier_name"],
                    "site_id": inv["site_id"],
                    "item_name": line["item_name"],
                    "quantity": line["quantity"],
                    "unit": line["unit"],
                    "rate": line["rate"],
                    "amount": line["amount"],
                    "gst_percent": inv.get("gst_percent", 0),
                    "total": inv.get("total", 0),
                }
            )
    headers = ["invoice_number", "invoice_date", "supplier_name", "site_id",
               "item_name", "quantity", "unit", "rate", "amount", "gst_percent", "total"]
    return _csv_response(rows, "invoices.csv", headers)


@api.get("/export/movements")
async def export_movements(
    user: dict = Depends(get_current_user),
    site_id: Optional[str] = None,
    mtype: Optional[str] = Query(None, alias="type"),
):
    flt = scope_site_filter(user, site_id)
    if mtype:
        flt["type"] = mtype
    rows = await db.movements.find(flt, {"_id": 0}).sort("created_at", -1).to_list(20000)
    headers = ["created_at", "type", "item_name", "site_id", "quantity",
               "rate", "amount", "reference", "issued_to", "notes"]
    return _csv_response(rows, "movements.csv", headers)


# --- XLSX exports --------------------------------------------------------
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter


def _xlsx_response(rows: List[dict], headers: List[str], filename: str,
                   widths: List[int] = None, row_fill_key: str = None) -> StreamingResponse:
    wb = Workbook()
    ws = wb.active
    ws.title = filename.replace(".xlsx", "")[:31]
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="111827")
    fills = {
        "OUT":  PatternFill("solid", fgColor="FEE2E2"),
        "LOW":  PatternFill("solid", fgColor="FEF3C7"),
        "HIGH": PatternFill("solid", fgColor="DBEAFE"),
    }
    ws.append(headers)
    for i, _ in enumerate(headers, 1):
        c = ws.cell(row=1, column=i)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(horizontal="left", vertical="center")
    ws.freeze_panes = "A2"
    for r in rows:
        ws.append([r.get(h, "") for h in headers])
        if row_fill_key and r.get(row_fill_key) in fills:
            fill = fills[r[row_fill_key]]
            for col in range(1, len(headers) + 1):
                ws.cell(row=ws.max_row, column=col).fill = fill
    for i, w in enumerate(widths or [18] * len(headers), 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.auto_filter.ref = ws.dimensions
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@api.get("/export/stock.xlsx")
async def export_stock_xlsx(user: dict = Depends(get_current_user), site_id: Optional[str] = None):
    if user["role"] != "admin":
        site_id = user.get("site_id")
    rows = await compute_stock(site_id)
    headers = ["site_name", "item_name", "category", "unit", "inward", "outward",
               "consumption", "stock", "min_stock", "max_stock", "rate", "value", "status"]
    widths = [18, 28, 18, 8, 10, 10, 12, 10, 10, 10, 10, 14, 10]
    return _xlsx_response(rows, headers, "stock_register.xlsx", widths, row_fill_key="status")


@api.get("/export/invoices.xlsx")
async def export_invoices_xlsx(user: dict = Depends(get_current_user), site_id: Optional[str] = None):
    flt = scope_site_filter(user, site_id)
    invs = await db.invoices.find(flt, {"_id": 0}).to_list(5000)
    rows = []
    for inv in invs:
        for line in inv.get("lines", []):
            rows.append({
                "invoice_number": inv["invoice_number"], "invoice_date": inv["invoice_date"],
                "supplier_name": inv["supplier_name"], "site_id": inv["site_id"],
                "item_name": line["item_name"], "quantity": line["quantity"],
                "unit": line["unit"], "rate": line["rate"], "amount": line["amount"],
                "gst_percent": inv.get("gst_percent", 0), "total": inv.get("total", 0),
            })
    headers = ["invoice_number", "invoice_date", "supplier_name", "site_id",
               "item_name", "quantity", "unit", "rate", "amount", "gst_percent", "total"]
    widths = [16, 14, 22, 24, 26, 10, 8, 12, 14, 12, 14]
    return _xlsx_response(rows, headers, "invoices.xlsx", widths)


@api.get("/export/movements.xlsx")
async def export_movements_xlsx(
    user: dict = Depends(get_current_user),
    site_id: Optional[str] = None,
    mtype: Optional[str] = Query(None, alias="type"),
):
    flt = scope_site_filter(user, site_id)
    if mtype:
        flt["type"] = mtype
    rows = await db.movements.find(flt, {"_id": 0}).sort("created_at", -1).to_list(20000)
    headers = ["created_at", "type", "item_name", "site_id", "quantity",
               "rate", "amount", "reference", "issued_to", "notes"]
    widths = [22, 14, 24, 24, 10, 12, 14, 18, 18, 28]
    return _xlsx_response(rows, headers, f"{mtype or 'movements'}.xlsx", widths)


# --- Bootstrap -----------------------------------------------------------
DEFAULT_CATEGORIES = ["Cement", "Steel / Rebar", "Bricks & Blocks", "Sand", "Aggregate",
                      "Tools", "Electrical", "Plumbing", "Paint", "Hardware"]


@app.on_event("startup")
async def startup():
    init_storage()
    await db.users.create_index("email", unique=True)
    await db.items.create_index("name")
    await db.sites.create_index("name")
    await db.movements.create_index([("site_id", 1), ("item_id", 1)])
    await db.invoices.create_index("invoice_number")
    await db.categories.create_index("name", unique=True)

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@buildtrack.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one(
            {
                "id": new_id(),
                "email": admin_email,
                "password_hash": hash_pw(admin_pw),
                "name": "Admin",
                "role": "admin",
                "site_id": None,
                "created_at": now_iso(),
            }
        )
        logger.info("Admin seeded: %s", admin_email)
    elif not verify_pw(admin_pw, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email}, {"$set": {"password_hash": hash_pw(admin_pw)}}
        )

    # Seed default categories
    for c in DEFAULT_CATEGORIES:
        await db.categories.update_one(
            {"name": c},
            {"$setOnInsert": {"id": new_id(), "name": c, "created_at": now_iso()}},
            upsert=True,
        )


@app.on_event("shutdown")
async def shutdown():
    client.close()


@api.get("/")
async def root():
    return {"service": "BuildTrack", "status": "ok"}


# --- File upload / serve --------------------------------------------------
MIME = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "webp": "image/webp", "gif": "image/gif", "pdf": "application/pdf",
}


@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    ext = (file.filename or "bin").rsplit(".", 1)[-1].lower()
    if ext not in MIME:
        raise HTTPException(400, f"Unsupported file type .{ext}")
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "File too large (8MB max)")
    path = f"{APP_NAME}/uploads/{user['id']}/{new_id()}.{ext}"
    try:
        result = put_object(path, data, MIME[ext])
    except Exception as e:
        logger.exception("Upload failed: %s", e)
        raise HTTPException(500, "Upload failed - object storage unavailable")
    await db.files.insert_one({
        "id": new_id(),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": MIME[ext],
        "size": result.get("size", len(data)),
        "uploaded_by": user["id"],
        "is_deleted": False,
        "created_at": now_iso(),
    })
    return {"path": result["path"], "name": file.filename}


@api.get("/files/{path:path}")
async def serve_file(path: str, request: Request, auth: Optional[str] = Query(None)):
    token = request.cookies.get("access_token")
    if not token:
        h = request.headers.get("Authorization", "")
        if h.startswith("Bearer "):
            token = h[7:]
    if not token and auth:
        token = auth
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    rec = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not rec:
        raise HTTPException(404, "File not found")
    data, ct = get_object(path)
    return FastResponse(content=data, media_type=rec.get("content_type", ct))



app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
