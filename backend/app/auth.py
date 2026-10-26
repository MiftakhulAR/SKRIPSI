"""Simple account + session auth for local development (stdlib only).

- Passwords: PBKDF2-HMAC-SHA256 with a random salt (never stored in plain text).
- Sessions: random token stored in the DB, sent by the frontend as "Authorization: Bearer <token>".
- Admin: accounts created by seed_accounts.py with role "admin", or emails listed in ADMIN_EMAILS.

In P2b this can be replaced by Supabase Auth without changing the frontend pages.
"""
import hashlib
import hmac
import os
import secrets

from fastapi import Depends, Header, HTTPException

from . import db

ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2${ITERATIONS}${salt.hex()}${h.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, it, salt, h = stored.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(it))
        return hmac.compare_digest(calc.hex(), h)
    except ValueError:
        return False


def admin_emails() -> set[str]:
    return {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}


def new_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    db.save_session(token, user_id)
    return token


def current_user(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "login_required")
    user = db.user_by_token(authorization.split(" ", 1)[1].strip())
    if not user:
        raise HTTPException(401, "login_required")
    return user


def optional_user(authorization: str | None = Header(default=None)) -> dict | None:
    try:
        return current_user(authorization)
    except HTTPException:
        return None


def admin_user(user: dict = Depends(current_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "admin_only")
    return user


def profile_complete(p: dict) -> bool:
    from .profile import complete
    return complete(p)


def user_profile(u: dict) -> dict:
    """Stored profile cleaned against the current catalogue (also converts the pre-patch-8 format)."""
    from .profile import normalize
    raw = db.get_profile(u)
    return {**normalize(raw), "updated_at": raw.get("updated_at")}


def public_user(u: dict) -> dict:
    out = {k: u[k] for k in ("id", "name", "email", "role", "status", "cohort")}
    out["profile_complete"] = profile_complete(user_profile(u))
    return out
