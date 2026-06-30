# BuildTrack — Construction Inventory Management

## Original Problem Statement
Build an app for a construction company providing: inward/outward entry for different purchase items, value entry, low/high stock analysis, purchase invoice creation, and consumption/issue of materials.

## User Choices (gathered)
- Authentication: **JWT-based custom auth** (email + password)
- Categories: **editable**, allow adding line items / categories on the fly
- Low/High stock: **Both** manual thresholds + auto-calculated from consumption
- Export: **CSV/Excel** for inventory, invoices, consumption
- Multi-site: **per-site login** + main admin sees full cross-site dashboard

## Architecture
- **Backend**: FastAPI + Motor (Mongo) + PyJWT + bcrypt. All routes under `/api`.
- **Frontend**: React 19 + Tailwind + shadcn/ui + Phosphor icons + Recharts. Auth uses Bearer header in axios (localStorage) and httpOnly cookies as fallback.
- **Mongo collections**: `users`, `sites`, `categories`, `items`, `suppliers`, `invoices`, `movements`.
- **Roles**: `admin` (cross-site), `site_user` (restricted to assigned `site_id`).

## What's Implemented (Feb 2026)
- JWT auth (login / register / me / logout); admin seeded from `.env`
- Sites, Items, Suppliers, Categories CRUD with custom-category creation on the fly
- Purchase Invoice with multi-line entry; auto-creates inward movements
- **Invoice attachment (image / PDF) upload to Emergent Object Storage**, viewable inline from invoice list (paperclip icon)
- Inward / Outward / Consumption movement entries with per-site scoping
- Live Stock Register: inward − outward − consumption = on hand; status OK / LOW / OUT / HIGH (manual + auto-calc thresholds)
- Dashboard: purchase value, consumption value, stock value, 30-day trend chart, per-site bar chart, low/high stock lists
- CSV export for stock, invoices, and each movement type
- Sidebar with site selector; admin can also create users with site assignment
- Default categories seeded (Cement, Steel/Rebar, Bricks, Sand, Aggregate, Tools, Electrical, Plumbing, Paint, Hardware)
- **Mobile-friendly responsive layout**: hamburger drawer, bottom-nav with 5 most-used actions (Home / Bills / In / Use / Stock), card lists on mobile for invoices, stock and movements, 44px tap targets, `capture="environment"` so phone camera opens directly

## Test Credentials
See `/app/memory/test_credentials.md` — default admin `admin@buildtrack.com / admin123`.

## Prioritized Backlog
- **P1**: Editable invoice (currently delete + recreate), goods-receipt-note (GRN) printing, item-wise consumption trend
- **P1**: Email/SMS low-stock alerts and weekly stock summary
- **P2**: Barcode/QR scanning for issue & receipt, project/cost-center allocation, vendor performance & price history
- **P2**: PDF invoice export with company letterhead
- **P2**: Role between admin and site_user (e.g. store_keeper read-only)
