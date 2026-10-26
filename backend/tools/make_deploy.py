"""Patch 14/14c: build a clean folder for a Docker host (Railway, Hugging Face Space, ...) and optionally point the
frontend at the backend URL.

Usage, from the backend folder:
    py -3.12 tools/make_deploy.py                                  # only build deploy_hf/
    py -3.12 tools/make_deploy.py https://careerai.up.railway.app  # + write frontend/.env.production

Creates careerai/deploy_hf/ with ONLY the files the server needs (allow-list):
    Dockerfile, README.md (Space settings), requirements.txt, app/*.py,
    artifacts/*.csv|*.json (public, derived tables), artifacts/kb/ public layer only.
Never copied: .env, *.db, seed_accounts.local.json, tests, uploads, artifacts/kb/internal_* (PNJ internal data).
Also writes frontend/.env.production with NEXT_PUBLIC_API_URL = the Space URL.
Upload the CONTENTS of deploy_hf/ to the Space (Files -> Add file -> Upload files).
"""
import re
import shutil
import sys
from pathlib import Path

BACK = Path(__file__).resolve().parent.parent
ROOT = BACK.parent
OUT = ROOT / "deploy_hf"
KB_PUBLIC = ["retrieval_config.json", "kb_codes.json", "public_chunks.jsonl", "public_emb.npy"]

api = sys.argv[1].strip().rstrip("/") if len(sys.argv) > 1 else None
if api and not re.match(r"^https://[a-z0-9.-]+$", api):
    sys.exit("Alamat backend harus berbentuk https://nama.domain (huruf kecil, tanpa garis miring di akhir)")

DOCKERFILE = """# CareerAI backend - Hugging Face Space (Docker). Built by tools/make_deploy.py (patch 14).
FROM python:3.11-slim
RUN useradd -m -u 1000 user
WORKDIR /app
COPY requirements.txt .
# CPU-only torch (much smaller than the default CUDA build), then the rest
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu \\
 && pip install --no-cache-dir -r requirements.txt
USER user
ENV HOME=/home/user HF_HOME=/home/user/.cache PYTHONUNBUFFERED=1 \\
    KB_LAYER=public RAG_COMPARE=0 LLM_PROVIDER=groq
# bake the e5 embedding model into the image so the first request does not wait for a 1 GB download
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('intfloat/multilingual-e5-base')"
COPY --chown=user app app
COPY --chown=user artifacts artifacts
RUN mkdir -p uploads
EXPOSE 7860
# Railway/Render give the port in $PORT; Hugging Face uses 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
"""

README = """---
title: CareerAI API
emoji: 🎓
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

Backend API of CareerAI (skripsi D4 Teknik Informatika PNJ). Secrets (Settings -> Variables and secrets):
DATABASE_URL, GROQ_API_KEY, FRONTEND_ORIGINS. Public knowledge-base layer only.
"""

if OUT.exists():
    shutil.rmtree(OUT)
(OUT / "app").mkdir(parents=True)
(OUT / "artifacts" / "kb").mkdir(parents=True)
for f in sorted((BACK / "app").glob("*.py")):
    shutil.copy2(f, OUT / "app" / f.name)
for f in sorted((BACK / "artifacts").iterdir()):
    if f.is_file() and f.suffix in (".csv", ".json"):
        shutil.copy2(f, OUT / "artifacts" / f.name)
for n in KB_PUBLIC:
    src = BACK / "artifacts" / "kb" / n
    if not src.exists():
        sys.exit(f"File basis pengetahuan publik tidak ada: {src}")
    shutil.copy2(src, OUT / "artifacts" / "kb" / n)
req = [line for line in (BACK / "requirements.txt").read_text(encoding="utf-8").splitlines()
       if not line.strip().startswith(("pytest", "pandas", "# tests"))]
(OUT / "requirements.txt").write_text("\n".join(req) + "\n", encoding="utf-8")
(OUT / "Dockerfile").write_text(DOCKERFILE, encoding="utf-8")
(OUT / "README.md").write_text(README, encoding="utf-8")

# safety: nothing private may be in the upload folder
bad = [p for p in OUT.rglob("*") if p.is_file() and (
    p.name.startswith("internal_") or p.suffix == ".db" or p.name.startswith(".env")
    or "seed_accounts" in p.name or "kb_v2_chunks" in p.name or "tracer" in p.name.lower())]
assert not bad, f"File privat ikut tersalin: {bad}"

files = [p for p in OUT.rglob("*") if p.is_file()]
print(f"deploy_hf siap: {len(files)} file, {sum(p.stat().st_size for p in files) / 1e6:.1f} MB (tanpa data internal)")
if api:
    (ROOT / "frontend" / ".env.production").write_text(f"NEXT_PUBLIC_API_URL={api}\n", encoding="utf-8")
    print(f"frontend/.env.production -> NEXT_PUBLIC_API_URL={api}")
