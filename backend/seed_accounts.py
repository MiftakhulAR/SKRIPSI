"""Create or update test accounts in the local database.

Usage (from the backend folder, with the backend stopped or running):
    python seed_accounts.py                      # reads seed_accounts.local.json
    python seed_accounts.py other_file.json

The JSON file holds passwords, so it is listed in .gitignore and must never be pushed to GitHub.
Existing accounts with the same email are updated (name, password, role, status, cohort).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app import auth, db  # noqa: E402

path = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parent / "seed_accounts.local.json")
accounts = json.loads(path.read_text(encoding="utf-8"))
db.init()
for a in accounts:
    email = a["email"].strip().lower()
    role = a.get("role", "student")
    fields = {"name": a["name"], "password_hash": auth.hash_password(a["password"]), "role": role,
              "status": a.get("status"), "cohort": a.get("cohort")}
    u = db.user_by_email(email)
    if u:
        db.update_user(u["id"], **fields)
        print(f"updated  {email:45s} role={role}")
    else:
        db.create_user(a["name"], email, fields["password_hash"], fields["status"], fields["cohort"], set(), role=role)
        print(f"created  {email:45s} role={role}")
print("Database:", db.DB_PATH)
