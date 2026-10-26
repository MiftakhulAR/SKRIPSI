"""Copy the laptop database (backend/careerai.db) to PostgreSQL / Supabase (patch 13).

Usage, from the backend folder (DATABASE_URL in backend/.env or in the environment):
    py -3.12 tools/migrate_sqlite_to_postgres.py               # careerai.db -> DATABASE_URL
    py -3.12 tools/migrate_sqlite_to_postgres.py other.db
    py -3.12 tools/migrate_sqlite_to_postgres.py --force       # overwrite a target that already has accounts

All tables are copied 1:1 (accounts, sessions, profiles, assessments, ratings, AI explanations, knowledge-base list,
and the catalogue with the admin's edits). The target tables are emptied first. ID counters are moved past the
copied IDs so new rows do not collide. Nothing is deleted from careerai.db.
"""
import os
import sqlite3
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
from dotenv import load_dotenv  # noqa: E402

load_dotenv(HERE / ".env")
args = [a for a in sys.argv[1:] if not a.startswith("--")]
force = "--force" in sys.argv
src = Path(args[0]) if args else HERE / "careerai.db"
if not os.environ.get("DATABASE_URL", "").startswith(("postgres://", "postgresql://")):
    sys.exit("DATABASE_URL (postgresql://...) belum di-set di backend/.env")
if not src.exists():
    sys.exit(f"File SQLite tidak ditemukan: {src}")

from app import catalog_db, db  # noqa: E402

TABLES = ["users", "sessions", "assessments", "ratings", "explanations", "kb_docs",
          "interest_areas", "skills", "careers", "career_skills", "course_templates", "career_groups", "catalog_meta"]
SERIAL = {"users", "assessments", "kb_docs"}

db.init()
catalog_db.init()          # creates the tables (and seeds the catalogue, replaced below by the laptop copy)
s = sqlite3.connect(src)
s.row_factory = sqlite3.Row
with db.conn() as c:
    n_users = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if n_users and not force:
        sys.exit(f"Database tujuan sudah berisi {n_users} akun. Jalankan dengan --force untuk menimpanya.")
    for t in TABLES:
        cols_src = [r["name"] for r in s.execute(f"PRAGMA table_info({t})")]
        if not cols_src:
            print(f"  {t:18s} tidak ada di SQLite, dilewati")
            continue
        cols = [x for x in cols_src if x in db.table_columns(c, t)]
        rows = [tuple(r[x] for x in cols) for r in s.execute(f"SELECT {', '.join(cols)} FROM {t}")]
        c.execute(f"DELETE FROM {t}")
        c.executemany(f"INSERT INTO {t} ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))})", rows)
        if t in SERIAL:
            c.execute(f"SELECT setval(pg_get_serial_sequence('{t}', 'id'), COALESCE((SELECT MAX(id) FROM {t}), 0) + 1, false)")
        print(f"  {t:18s} {len(rows):6d} baris")
print("Selesai:", src.name, "-> PostgreSQL. Backend akan memakai PostgreSQL selama DATABASE_URL di-set.")
