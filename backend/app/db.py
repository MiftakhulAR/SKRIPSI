"""Storage: SQLite (one file careerai.db, laptop and tests) or PostgreSQL/Supabase (deploy, patch 13).

DATABASE_URL set (postgresql://...)  -> PostgreSQL through a small connection pool (psycopg 3).
DATABASE_URL not set                 -> SQLite file DB_PATH (default backend/careerai.db), as before.
The SQL in the app is written once: "?" placeholders, ON CONFLICT upserts and RETURNING work in both
(SQLite >= 3.35); the PostgreSQL wrapper below only translates placeholders and the DDL keyword AUTOINCREMENT.
Table names and columns are the same in both, so tools/migrate_sqlite_to_postgres.py copies rows 1:1.
"""
import json
import os
import re
import sqlite3
from datetime import datetime
from pathlib import Path

from .catalog import KB_SEED

DB_PATH = Path(os.environ.get("DB_PATH", Path(__file__).resolve().parent.parent / "careerai.db"))
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
IS_PG = DATABASE_URL.startswith(("postgres://", "postgresql://"))


class _Row(dict):
    """Row that works like sqlite3.Row: r["col"], r[0] and dict(r)."""
    def __getitem__(self, k):
        if isinstance(k, int):
            return list(self.values())[k]
        return super().__getitem__(k)


def _row_factory(cur):
    names = [d.name for d in cur.description] if cur.description else []
    return lambda values: _Row(zip(names, values))


def _sql(q: str, params: bool = True) -> str:
    """SQLite-style SQL -> psycopg: with parameters "%" is escaped and "?" becomes "%s"
    (no "?" is used inside string literals in this app)."""
    q = q.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
    return q.replace("%", "%%").replace("?", "%s") if params else q


class _PgConn:
    """The part of the sqlite3.Connection API the app uses, on top of a pooled psycopg connection."""
    def __init__(self, pool):
        self._ctx = pool.connection()

    def __enter__(self):
        self._c = self._ctx.__enter__()
        return self

    def __exit__(self, *exc):
        return self._ctx.__exit__(*exc)            # commit on success, rollback on error, return to the pool

    def execute(self, q, params=()):
        params = tuple(params)
        return self._c.execute(_sql(q, bool(params)), params or None)

    def executemany(self, q, rows):
        rows = [tuple(r) for r in rows]
        if rows:
            with self._c.cursor() as cur:
                cur.executemany(_sql(q), rows)

    def executescript(self, script):
        for stmt in [x.strip() for x in script.split(";") if x.strip()]:
            self._c.execute(_sql(stmt, False))


_pool = None


def _pg_pool():
    global _pool
    if _pool is None:
        from psycopg_pool import ConnectionPool
        # prepare_threshold=None: Supabase's pooler (pgbouncer, transaction mode) does not support prepared statements
        _pool = ConnectionPool(DATABASE_URL, min_size=1, max_size=int(os.environ.get("DB_POOL_MAX", "5")), open=True,
                               kwargs={"row_factory": _row_factory, "prepare_threshold": None, "connect_timeout": 15})
        import atexit
        atexit.register(_pool.close)
    return _pool


def conn():
    if IS_PG:
        return _PgConn(_pg_pool())
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def table_columns(c, table) -> set:
    if IS_PG:
        return {r["column_name"] for r in c.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?", (table,))}
    return {r["name"] for r in c.execute(f"PRAGMA table_info({table})")}


def now():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def _add_column(c, table, col, ddl):
    if col not in table_columns(c, table):
        c.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init():
    with conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'student',
            status TEXT,
            cohort TEXT,
            consent_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            input_json TEXT NOT NULL,
            result_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ratings (
            assessment_id INTEGER NOT NULL,
            career_slug TEXT NOT NULL,
            value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
            created_at TEXT NOT NULL,
            PRIMARY KEY (assessment_id, career_slug)
        );
        CREATE TABLE IF NOT EXISTS explanations (
            assessment_id INTEGER NOT NULL,
            career_slug TEXT NOT NULL,
            lang TEXT NOT NULL,
            content_json TEXT NOT NULL,
            model TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (assessment_id, career_slug, lang)
        );
        CREATE TABLE IF NOT EXISTS kb_docs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            doc_type TEXT NOT NULL,
            format TEXT NOT NULL,
            filename TEXT,
            chunks INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL,
            updated TEXT NOT NULL
        );
        """)
        # migrations for a careerai.db created by the previous version
        _add_column(c, "assessments", "user_id", "user_id INTEGER")
        _add_column(c, "users", "profile_json", "profile_json TEXT")
        _add_column(c, "users", "profile_updated_at", "profile_updated_at TEXT")
        _add_column(c, "kb_docs", "year", "year TEXT")
        _add_column(c, "kb_docs", "access", "access TEXT NOT NULL DEFAULT 'public'")
        if c.execute("SELECT COUNT(*) FROM kb_docs WHERE year IS NOT NULL").fetchone()[0] == 0:
            c.execute("DELETE FROM kb_docs WHERE filename IS NULL")       # replace old seed rows
            c.executemany(
                "INSERT INTO kb_docs (title, doc_type, format, year, access, chunks, status, updated) VALUES (?,?,?,?,?,?,?,?)",
                [(*row, now()) for row in KB_SEED])


# ---- users & sessions ----
def create_user(name, email, password_hash, status, cohort, admin_emails: set, role: str | None = None) -> dict:
    with conn() as c:
        role = role or ("admin" if email in admin_emails else "student")
        uid = c.execute("INSERT INTO users (name, email, password_hash, role, status, cohort, consent_at, created_at) "
                        "VALUES (?,?,?,?,?,?,?,?) RETURNING id", (name, email, password_hash, role, status, cohort, now(), now())).fetchone()[0]
        return dict(c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())


def get_user(uid):
    with conn() as c:
        r = c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
    return dict(r) if r else None


def update_user(uid, **fields):
    if not fields:
        return
    cols = ", ".join(f"{k}=?" for k in fields)
    with conn() as c:
        c.execute(f"UPDATE users SET {cols} WHERE id=?", (*fields.values(), uid))


def get_profile(user: dict) -> dict:
    """Raw stored profile; use auth.user_profile() for the cleaned version."""
    p = json.loads(user.get("profile_json") or "{}")
    return {**p, "updated_at": user.get("profile_updated_at")}


def save_profile(uid, profile: dict):
    update_user(uid, profile_json=json.dumps(profile), profile_updated_at=now())


def user_by_email(email):
    with conn() as c:
        r = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    return dict(r) if r else None


def save_session(token, user_id):
    with conn() as c:
        c.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?,?,?)", (token, user_id, now()))


def user_by_token(token):
    with conn() as c:
        r = c.execute("SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token=?", (token,)).fetchone()
    return dict(r) if r else None


def delete_session(token):
    with conn() as c:
        c.execute("DELETE FROM sessions WHERE token=?", (token,))


# ---- assessments ----
def save_assessment(user_id: int, data: dict, results: list) -> int:
    with conn() as c:
        return c.execute("INSERT INTO assessments (user_id, created_at, input_json, result_json) VALUES (?,?,?,?) RETURNING id",
                         (user_id, now(), json.dumps(data), json.dumps(results))).fetchone()[0]


def get_assessment(aid: int):
    with conn() as c:
        r = c.execute("SELECT * FROM assessments WHERE id=?", (aid,)).fetchone()
    if not r:
        return None
    return {"id": r["id"], "user_id": r["user_id"], "created_at": r["created_at"],
            "input": json.loads(r["input_json"]), "results": json.loads(r["result_json"])}


def list_assessments(user_id: int, limit=10):
    with conn() as c:
        rows = c.execute("SELECT id, created_at, result_json FROM assessments WHERE user_id=? ORDER BY id DESC LIMIT ?",
                         (user_id, limit)).fetchall()
    return [{"id": r["id"], "created_at": r["created_at"],
             "top": [{"slug": x["slug"], "name": x["name"], "score": x["score"]} for x in json.loads(r["result_json"])[:3]]}
            for r in rows]


# ---- LLM explanations (cached so the same result is not regenerated) ----
def get_explanation(aid, slug, lang):
    with conn() as c:
        r = c.execute("SELECT * FROM explanations WHERE assessment_id=? AND career_slug=? AND lang=?", (aid, slug, lang)).fetchone()
    return {**json.loads(r["content_json"]), "model": r["model"], "created_at": r["created_at"]} if r else None


def save_explanation(aid, slug, lang, content, model):
    with conn() as c:
        c.execute("INSERT INTO explanations VALUES (?,?,?,?,?,?) ON CONFLICT (assessment_id, career_slug, lang) DO UPDATE SET "
                  "content_json=excluded.content_json, model=excluded.model, created_at=excluded.created_at",
                  (aid, slug, lang, json.dumps(content), model, now()))


def latest_assessment(user_id):
    with conn() as c:
        r = c.execute("SELECT id FROM assessments WHERE user_id=? ORDER BY id DESC LIMIT 1", (user_id,)).fetchone()
    return get_assessment(r["id"]) if r else None


# ---- ratings ----
def save_rating(aid: int, slug: str, value: int):
    with conn() as c:
        c.execute("""INSERT INTO ratings (assessment_id, career_slug, value, created_at) VALUES (?,?,?,?)
                     ON CONFLICT(assessment_id, career_slug) DO UPDATE SET value=excluded.value,
                     created_at=excluded.created_at""", (aid, slug, value, now()))


def get_ratings(aid: int) -> dict:
    with conn() as c:
        rows = c.execute("SELECT career_slug, value FROM ratings WHERE assessment_id=?", (aid,)).fetchall()
    return {r["career_slug"]: r["value"] for r in rows}


def feedback_summary():
    """Ratings of the top-3 careers per assessment (the evaluation uses top-3 relevance)."""
    with conn() as c:
        rows = c.execute("SELECT r.assessment_id, r.career_slug, r.value, r.created_at, a.result_json "
                         "FROM ratings r JOIN assessments a ON a.id = r.assessment_id").fetchall()
        n_users = c.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        n_assess = c.execute("SELECT COUNT(*) FROM assessments").fetchone()[0]
        inputs = [json.loads(r[0]) for r in c.execute("SELECT input_json FROM assessments")]
    per, recent = {}, []
    for r in rows:
        res = json.loads(r["result_json"])
        row = next((x for x in res if x["slug"] == r["career_slug"]), None)
        rank = (row.get("rank") or res.index(row) + 1) if row else None
        name = next((x["name"] for x in json.loads(r["result_json"]) if x["slug"] == r["career_slug"]), r["career_slug"])
        p = per.setdefault(r["career_slug"], {"slug": r["career_slug"], "name": name, "n": 0, "sum": 0})
        p["n"] += 1
        p["sum"] += r["value"]
        recent.append({"assessment_id": r["assessment_id"], "career": name, "rank": rank, "value": r["value"],
                       "created_at": r["created_at"]})
    top3 = [x["value"] for x in recent if x["rank"] and x["rank"] <= 3]
    careers = sorted(({"slug": p["slug"], "name": p["name"], "n": p["n"], "mean": round(p["sum"] / p["n"], 2)}
                      for p in per.values()), key=lambda x: -x["n"])
    # FR4: share of skill suggestions (from the experience story) that the student ticked
    sug = [(set(i.get("experience_suggested") or []), set(i.get("experience") or [])) for i in inputs]
    sug = [(s, e) for s, e in sug if s]
    n_sug = sum(len(s) for s, _ in sug)
    n_acc = sum(len(s & e) for s, e in sug)
    fr4 = {"assessments_with_story": len(sug), "suggested": n_sug, "accepted": n_acc,
           "accepted_pct": round(100 * n_acc / n_sug, 1) if n_sug else None}
    return {"users": n_users, "assessments": n_assess, "ratings": len(recent), "fr4": fr4,
            "mean_top3": round(sum(top3) / len(top3), 2) if top3 else None, "n_top3": len(top3),
            "per_career": careers, "recent": sorted(recent, key=lambda x: x["created_at"], reverse=True)[:20]}


# ---- knowledge base ----
def list_docs():
    with conn() as c:
        return [dict(r) for r in c.execute("SELECT * FROM kb_docs ORDER BY id").fetchall()]


def add_doc(title, doc_type, fmt, year, filename):
    with conn() as c:
        c.execute("INSERT INTO kb_docs (title, doc_type, format, year, access, filename, chunks, status, updated) "
                  "VALUES (?,?,?,?, 'private', ?, 0, 'Uploaded', ?)", (title, doc_type, fmt, year, filename, now()))


def get_doc(doc_id):
    with conn() as c:
        r = c.execute("SELECT * FROM kb_docs WHERE id=?", (doc_id,)).fetchone()
    return dict(r) if r else None


def delete_doc(doc_id):
    with conn() as c:
        c.execute("DELETE FROM kb_docs WHERE id=?", (doc_id,))
