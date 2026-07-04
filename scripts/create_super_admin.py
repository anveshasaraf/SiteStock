#!/usr/bin/env python3
"""
One-time script to seed the first super-admin user.

Usage:
    export SUPABASE_URL=https://<ref>.supabase.co
    export SUPABASE_SERVICE_ROLE_KEY=eyJ...
    export DATABASE_URL=postgresql://...
    python scripts/create_super_admin.py --email admin@example.com --name "Admin Name"
"""
import argparse
import asyncio
import os
import sys
import httpx
import asyncpg


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--password", default=None, help="Leave blank to get a magic-link email")
    args = parser.parse_args()

    supabase_url = os.environ["SUPABASE_URL"]
    service_key  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    db_url       = os.environ["DATABASE_URL"]

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }

    # 1. Create Supabase auth user
    print(f"Creating auth user: {args.email}")
    payload = {"email": args.email, "email_confirm": True}
    if args.password:
        payload["password"] = args.password
    else:
        payload["password"] = os.urandom(24).hex()  # random; will use magic link

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{supabase_url}/auth/v1/admin/users",
            json=payload, headers=headers, timeout=15,
        )
        if r.status_code not in (200, 201):
            print(f"Error creating auth user: {r.text}"); sys.exit(1)
        user_id = r.json()["id"]
        print(f"Auth user created: {user_id}")

        # 2. Upsert profile + set super-admin
        conn = await asyncpg.connect(db_url, statement_cache_size=0)
        try:
            await conn.execute("""
                INSERT INTO profiles (id, name, email, is_super_admin)
                VALUES ($1, $2, $3, true)
                ON CONFLICT (id) DO UPDATE
                  SET name = EXCLUDED.name,
                      email = EXCLUDED.email,
                      is_super_admin = true
            """, user_id, args.name, args.email)
            print(f"Profile upserted for {args.name} ({args.email}) — is_super_admin=true")
        finally:
            await conn.close()

    if not args.password:
        # Send magic link
        r2 = await client.post(
            f"{supabase_url}/auth/v1/admin/users/{user_id}/magiclink",
            headers=headers, timeout=15,
        )
        print(f"Magic link sent to {args.email} — check inbox to set a password.")
    else:
        print(f"\nDone! Login at your app with email={args.email}")


if __name__ == "__main__":
    asyncio.run(main())
