import os

# tests never download the embedding model or call an LLM
os.environ.setdefault("KB_EMBED_MOCK", "1")
os.environ.setdefault("LLM_MOCK", "1")
os.environ.setdefault("KB_LAYER", "public")

# PostgreSQL run (DATABASE_URL=postgresql://.../<test database>): start from empty tables, like the SQLite test file.
# Never point this at the Supabase production database.
if os.environ.get("DATABASE_URL", "").startswith(("postgres://", "postgresql://")):
    assert os.environ.get("PG_TEST_OK") == "1", "set PG_TEST_OK=1 to confirm DATABASE_URL is a throw-away test database"
    import psycopg
    with psycopg.connect(os.environ["DATABASE_URL"], autocommit=True) as _c:
        _c.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public")
