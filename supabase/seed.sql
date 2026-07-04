-- BuildTrack Seed Data
-- Run after migrations: supabase db reset  OR  psql ... < seed.sql
-- NOTE: The super-admin user must be created separately via Supabase Auth
--       (Dashboard → Authentication → Users → "Invite user" with is_super_admin=true)
--       or via the bootstrap script in scripts/create_super_admin.py

-- Default categories (10 standard construction materials)
INSERT INTO categories (name) VALUES
    ('Cement'),
    ('Steel / Rebar'),
    ('Bricks & Blocks'),
    ('Sand'),
    ('Aggregate'),
    ('Tools'),
    ('Electrical'),
    ('Plumbing'),
    ('Paint'),
    ('Hardware')
ON CONFLICT (name) DO NOTHING;
