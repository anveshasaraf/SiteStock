-- BuildTrack - Initial Schema
-- Run with: supabase db push  OR  supabase migration up
-- Schema authority: this file. Never edit the DB directly.

-- ── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- fuzzy item search later

-- ── Custom Types ─────────────────────────────────────────────────────────────

CREATE TYPE site_role AS ENUM ('viewer', 'logger', 'manager', 'site_admin');
-- Hierarchy: viewer < logger < manager < site_admin
-- is_super_admin flag on profiles bypasses per-site checks (company owner)

CREATE TYPE movement_type AS ENUM ('inward', 'outward', 'consumption');

-- ── Core Tables ───────────────────────────────────────────────────────────────

-- Mirrors auth.users; created automatically via trigger on sign-up
CREATE TABLE profiles (
    id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL DEFAULT '',
    phone           TEXT,
    email           TEXT,
    is_super_admin  BOOLEAN     NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sites / Projects
CREATE TABLE sites (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    code        TEXT        NOT NULL DEFAULT '',
    location    TEXT        NOT NULL DEFAULT '',
    created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ                  -- soft-delete
);

-- Granular per-project membership - the heart of the permission model
CREATE TABLE memberships (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
    site_id     UUID        NOT NULL REFERENCES sites(id)     ON DELETE CASCADE,
    role        site_role   NOT NULL DEFAULT 'logger',
    created_by  UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, site_id)
);

-- Global item master (not site-scoped)
CREATE TABLE categories (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE items (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    category    TEXT        NOT NULL DEFAULT '',
    unit        TEXT        NOT NULL DEFAULT 'nos',
    min_stock   NUMERIC(12,3) NOT NULL DEFAULT 0,
    max_stock   NUMERIC(12,3) NOT NULL DEFAULT 0,
    rate        NUMERIC(12,2) NOT NULL DEFAULT 0,
    description TEXT        DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE TABLE suppliers (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL,
    contact     TEXT        DEFAULT '',
    phone       TEXT        DEFAULT '',
    address     TEXT        DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- Purchase invoices (site-scoped)
CREATE TABLE invoices (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number  TEXT        NOT NULL,
    supplier_id     UUID        REFERENCES suppliers(id) ON DELETE SET NULL,
    supplier_name   TEXT        NOT NULL DEFAULT '',
    site_id         UUID        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    invoice_date    DATE        NOT NULL,
    gst_percent     NUMERIC(5,2) NOT NULL DEFAULT 0,
    subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
    gst_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
    total           NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes           TEXT        DEFAULT '',
    attachment_path TEXT        DEFAULT '',
    attachment_name TEXT        DEFAULT '',
    created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE(site_id, invoice_number)
);

-- Normalized invoice lines
CREATE TABLE invoice_lines (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id  UUID        NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_id     UUID        NOT NULL REFERENCES items(id)    ON DELETE RESTRICT,
    item_name   TEXT        NOT NULL DEFAULT '',
    unit        TEXT        NOT NULL DEFAULT 'nos',
    quantity    NUMERIC(12,3) NOT NULL,
    rate        NUMERIC(12,2) NOT NULL DEFAULT 0,
    amount      NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- Stock movements (site-scoped)
CREATE TABLE movements (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id     UUID            NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    item_name   TEXT            NOT NULL DEFAULT '',
    site_id     UUID            NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    quantity    NUMERIC(12,3)   NOT NULL,
    rate        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    amount      NUMERIC(14,2)   NOT NULL DEFAULT 0,
    type        movement_type   NOT NULL,
    reference   TEXT            DEFAULT '',
    notes       TEXT            DEFAULT '',
    issued_to   TEXT            DEFAULT '',
    created_by  UUID            REFERENCES profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- Physical stock audits (site-scoped)
CREATE TABLE physical_counts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID        NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    item_name       TEXT        NOT NULL DEFAULT '',
    unit            TEXT        DEFAULT '',
    site_id         UUID        NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    counted_qty     NUMERIC(12,3) NOT NULL,
    system_qty      NUMERIC(12,3) NOT NULL DEFAULT 0,
    variance        NUMERIC(12,3) NOT NULL DEFAULT 0,
    notes           TEXT        DEFAULT '',
    photo_path      TEXT        DEFAULT '',
    photo_name      TEXT        DEFAULT '',
    adjusted        BOOLEAN     NOT NULL DEFAULT false,
    counted_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    counted_by_name TEXT        DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- File upload metadata (Supabase Storage paths)
CREATE TABLE files (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_path        TEXT        NOT NULL UNIQUE,
    original_filename   TEXT        DEFAULT '',
    content_type        TEXT        DEFAULT '',
    size                INTEGER     DEFAULT 0,
    uploaded_by         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    is_deleted          BOOLEAN     NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only audit trail
CREATE TABLE audit_log (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
    action      TEXT        NOT NULL,   -- 'create' | 'update' | 'delete'
    table_name  TEXT        NOT NULL,
    record_id   UUID,
    site_id     UUID,
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX idx_memberships_user     ON memberships(user_id);
CREATE INDEX idx_memberships_site     ON memberships(site_id);
CREATE INDEX idx_movements_site_item  ON movements(site_id, item_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_movements_site_type  ON movements(site_id, type)    WHERE deleted_at IS NULL;
CREATE INDEX idx_movements_created    ON movements(created_at DESC)  WHERE deleted_at IS NULL;
CREATE INDEX idx_invoices_site        ON invoices(site_id)           WHERE deleted_at IS NULL;
CREATE INDEX idx_invoice_lines_inv    ON invoice_lines(invoice_id);
CREATE INDEX idx_physical_site        ON physical_counts(site_id);
CREATE INDEX idx_items_name_trgm      ON items USING gin(name gin_trgm_ops) WHERE deleted_at IS NULL;
CREATE INDEX idx_audit_table_record   ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_user           ON audit_log(user_id);

-- ── Helper Functions ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT COALESCE(
        (SELECT is_super_admin FROM profiles WHERE id = auth.uid()), false
    );
$$;

-- Returns the calling user's role in a given site (null if not a member)
CREATE OR REPLACE FUNCTION my_site_role(p_site_id UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT role::TEXT FROM memberships
    WHERE user_id = auth.uid() AND site_id = p_site_id
    LIMIT 1;
$$;

-- Role hierarchy check: returns true if caller has at least min_role in site
CREATE OR REPLACE FUNCTION has_site_role(p_site_id UUID, min_role site_role)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM memberships
        WHERE user_id = auth.uid() AND site_id = p_site_id
          AND CASE role
                WHEN 'viewer'     THEN 1
                WHEN 'logger'     THEN 2
                WHEN 'manager'    THEN 3
                WHEN 'site_admin' THEN 4
              END >=
              CASE min_role
                WHEN 'viewer'     THEN 1
                WHEN 'logger'     THEN 2
                WHEN 'manager'    THEN 3
                WHEN 'site_admin' THEN 4
              END
    ) OR is_super_admin();
$$;

-- ── Trigger: auto-create profile on auth.users insert ────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO profiles (id, name, phone, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', ''),
        NEW.phone,
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Stock Register View ───────────────────────────────────────────────────────
-- Replaces the Python compute_stock() load-everything approach.
-- Uses SQL aggregation - O(movements) not O(sites * items).

CREATE OR REPLACE VIEW stock_register AS
WITH movement_agg AS (
    SELECT
        m.site_id,
        m.item_id,
        SUM(CASE WHEN m.type = 'inward'      THEN m.quantity ELSE 0 END) AS inward,
        SUM(CASE WHEN m.type = 'outward'     THEN m.quantity ELSE 0 END) AS outward,
        SUM(CASE WHEN m.type = 'consumption' THEN m.quantity ELSE 0 END) AS consumption,
        -- Last inward rate (most recent per site+item)
        (SELECT rate FROM movements m2
         WHERE m2.site_id = m.site_id
           AND m2.item_id = m.item_id
           AND m2.type    = 'inward'
           AND m2.deleted_at IS NULL
         ORDER BY m2.created_at DESC
         LIMIT 1) AS last_rate
    FROM movements m
    WHERE m.deleted_at IS NULL
    GROUP BY m.site_id, m.item_id
),
cross_join AS (
    SELECT s.id AS site_id, s.name AS site_name,
           i.id AS item_id, i.name AS item_name,
           i.category, i.unit, i.min_stock, i.max_stock, i.rate AS master_rate
    FROM sites s
    CROSS JOIN items i
    WHERE s.deleted_at IS NULL AND i.deleted_at IS NULL
)
SELECT
    cj.site_id,
    cj.site_name,
    cj.item_id,
    cj.item_name,
    cj.category,
    cj.unit,
    ROUND(COALESCE(ma.inward,      0), 3) AS inward,
    ROUND(COALESCE(ma.outward,     0), 3) AS outward,
    ROUND(COALESCE(ma.consumption, 0), 3) AS consumption,
    ROUND(COALESCE(ma.inward, 0) - COALESCE(ma.outward, 0) - COALESCE(ma.consumption, 0), 3) AS stock,
    cj.min_stock,
    cj.max_stock,
    ROUND(
        CASE WHEN (COALESCE(ma.outward, 0) + COALESCE(ma.consumption, 0)) > 0
             THEN (COALESCE(ma.outward, 0) + COALESCE(ma.consumption, 0)) / 6.0
             ELSE 0 END,
    3) AS auto_min_stock,
    COALESCE(ma.last_rate, cj.master_rate) AS rate,
    ROUND(
        (COALESCE(ma.inward, 0) - COALESCE(ma.outward, 0) - COALESCE(ma.consumption, 0))
        * COALESCE(ma.last_rate, cj.master_rate),
    2) AS value,
    -- Status: same logic as original Python, now in SQL
    CASE
        WHEN (COALESCE(ma.inward,0) - COALESCE(ma.outward,0) - COALESCE(ma.consumption,0)) <= 0
            THEN 'OUT'
        WHEN cj.min_stock > 0
         AND (COALESCE(ma.inward,0) - COALESCE(ma.outward,0) - COALESCE(ma.consumption,0)) < cj.min_stock
            THEN 'LOW'
        WHEN cj.min_stock = 0
         AND (COALESCE(ma.outward,0) + COALESCE(ma.consumption,0)) > 0
         AND (COALESCE(ma.inward,0) - COALESCE(ma.outward,0) - COALESCE(ma.consumption,0))
             < ROUND((COALESCE(ma.outward,0) + COALESCE(ma.consumption,0)) / 6.0, 3)
            THEN 'LOW'
        WHEN cj.max_stock > 0
         AND (COALESCE(ma.inward,0) - COALESCE(ma.outward,0) - COALESCE(ma.consumption,0)) > cj.max_stock
            THEN 'HIGH'
        ELSE 'OK'
    END AS status
FROM cross_join cj
LEFT JOIN movement_agg ma ON ma.site_id = cj.site_id AND ma.item_id = cj.item_id;

-- ── Row-Level Security (defense-in-depth; FastAPI uses service-role, bypasses) ──

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites           ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships     ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE physical_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE files           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;

-- profiles: users see their own row; super admins see all
CREATE POLICY "profiles_select" ON profiles FOR SELECT
    USING (id = auth.uid() OR is_super_admin());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
    USING (id = auth.uid() OR is_super_admin());

-- sites: members can read their sites; super admin sees all
CREATE POLICY "sites_select" ON sites FOR SELECT
    USING (is_super_admin() OR EXISTS (
        SELECT 1 FROM memberships WHERE user_id = auth.uid() AND site_id = sites.id
    ));
CREATE POLICY "sites_insert" ON sites FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "sites_update" ON sites FOR UPDATE
    USING (is_super_admin() OR has_site_role(id, 'site_admin'));
CREATE POLICY "sites_delete" ON sites FOR DELETE USING (is_super_admin());

-- memberships: users see their own; site_admin sees their site; super admin sees all
CREATE POLICY "memberships_select" ON memberships FOR SELECT
    USING (user_id = auth.uid() OR is_super_admin() OR has_site_role(site_id, 'site_admin'));
CREATE POLICY "memberships_insert" ON memberships FOR INSERT
    WITH CHECK (is_super_admin() OR has_site_role(site_id, 'site_admin'));
CREATE POLICY "memberships_update" ON memberships FOR UPDATE
    USING (is_super_admin() OR has_site_role(site_id, 'site_admin'));
CREATE POLICY "memberships_delete" ON memberships FOR DELETE
    USING (is_super_admin() OR has_site_role(site_id, 'site_admin'));

-- Global master data: any authenticated user reads; manager+ writes
CREATE POLICY "categories_select"  ON categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "categories_write"   ON categories FOR ALL   USING (is_super_admin());

CREATE POLICY "items_select" ON items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "items_write"  ON items FOR ALL   USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM memberships WHERE user_id = auth.uid()
    AND CASE role WHEN 'manager' THEN true WHEN 'site_admin' THEN true ELSE false END
));

CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "suppliers_write"  ON suppliers FOR ALL   USING (is_super_admin() OR EXISTS (
    SELECT 1 FROM memberships WHERE user_id = auth.uid()
    AND role IN ('manager', 'site_admin')
));

-- Site-scoped tables: member with required role
CREATE POLICY "invoices_select" ON invoices FOR SELECT
    USING (has_site_role(site_id, 'viewer'));
CREATE POLICY "invoices_insert" ON invoices FOR INSERT
    WITH CHECK (has_site_role(site_id, 'logger'));
CREATE POLICY "invoices_delete" ON invoices FOR DELETE
    USING (has_site_role(site_id, 'manager'));

CREATE POLICY "invoice_lines_select" ON invoice_lines FOR SELECT
    USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND has_site_role(i.site_id, 'viewer')));
CREATE POLICY "invoice_lines_insert" ON invoice_lines FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND has_site_role(i.site_id, 'logger')));
CREATE POLICY "invoice_lines_delete" ON invoice_lines FOR DELETE
    USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND has_site_role(i.site_id, 'manager')));

CREATE POLICY "movements_select" ON movements FOR SELECT
    USING (has_site_role(site_id, 'viewer'));
CREATE POLICY "movements_insert" ON movements FOR INSERT
    WITH CHECK (has_site_role(site_id, 'logger'));
CREATE POLICY "movements_delete" ON movements FOR DELETE
    USING (has_site_role(site_id, 'manager'));

CREATE POLICY "physical_counts_select" ON physical_counts FOR SELECT
    USING (has_site_role(site_id, 'viewer'));
CREATE POLICY "physical_counts_insert" ON physical_counts FOR INSERT
    WITH CHECK (has_site_role(site_id, 'logger'));

CREATE POLICY "files_select" ON files FOR SELECT
    USING (uploaded_by = auth.uid() OR is_super_admin());
CREATE POLICY "files_insert" ON files FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "audit_log_select" ON audit_log FOR SELECT
    USING (user_id = auth.uid() OR is_super_admin());
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
