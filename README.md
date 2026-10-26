# CareerAI — prototype P2

IT career recommendation for D4 Teknik Informatika PNJ.
**Frontend:** Next.js (App Router) + Tailwind, EN/ID switch · **Backend:** FastAPI (REST API).
Same look as the earlier Jinja2 version (sidebar, violet theme); the HTML now lives in React components.

```
careerai/
├── backend/                  FastAPI
│   ├── app/main.py           API routes
│   ├── app/scoring.py        fit score (Bab III 3.5, same as notebook Tahap 10)
│   ├── app/data.py           loads artifacts/
│   ├── app/db.py             SQLite (local) → Supabase/PostgreSQL in P2b
│   ├── app/catalog.py        knowledge-base document list (status only)
│   ├── artifacts/            public tables exported from Colab
│   ├── prepare_artifacts.py  refresh artifacts from Drive
│   └── tests/                pytest
└── frontend/                 Next.js
    ├── app/                  pages: /, /assessment, /analyzing/[id], /results/[id],
    │                         /results/[id]/career/[slug], /admin/kb
    ├── components/           Shell (sidebar + header + EN/ID), Summary
    └── lib/                  api.ts (calls backend), i18n.tsx (EN/ID texts)
```

## Run locally (Windows, two terminals in VS Code)
Requires Python 3.10+ and Node.js 20+.

**Terminal 1 — backend**
```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
API docs: http://localhost:8000/docs · tests: `pytest -q`

**Terminal 2 — frontend**
```
cd frontend
npm install
copy .env.example .env.local
npm run dev
```
Open http://localhost:3000

Refresh the scoring tables after re-running Colab: `python prepare_artifacts.py "G:/My Drive/Skripsi_RAG"`.

## Accounts and access
- Visitors can open Dashboard and Explore Careers without an account.
- Assessment, results and Ask AI need an account (register with consent, then log in).
- After registering, the user is logged in and fills the **profile once** (courses + grades, skills, 1–3 interests).
  Every assessment reuses the profile and only asks for **experience**. The profile can be edited any time (My Profile).
- Admin accounts are created with the seed script (or emails listed in the env var `ADMIN_EMAILS`).
  Admin pages: Knowledge Base, Career Catalogue, User Feedback, Settings.

### Test accounts
```
cd backend
python seed_accounts.py          # creates/updates the accounts in seed_accounts.local.json
```
`seed_accounts.local.json` contains passwords and is ignored by git — never push it.
- Old assessments made before login existed are kept in the database but are not shown (they have no owner).

## AI (LLM) — explanation and Ask AI
The ranking is always the formula; the LLM only writes text from that data.
1. Get a free API key: Groq (console.groq.com) or Google AI Studio (Gemini).
2. In `backend/`, copy `.env.example` to `.env` and fill in, e.g.
   ```
   LLM_PROVIDER=groq
   GROQ_API_KEY=your_key_here
   ```
   (or `LLM_PROVIDER=gemini` + `GEMINI_API_KEY=...`, model default `gemini-3.8-flash`, change with `LLM_MODEL=`).
3. Restart the backend. Check: http://localhost:8000/api/llm/status shows `"ready": true`.
`.env` is git-ignored — never commit or share the key.
Mode now: system data only (assessment, profile, career catalogue, course mapping). Knowledge-base passages (RAG) are added in P3.

## API
| Method | URL | Function |
|---|---|---|
| GET | /api/meta | courses, grades, skill dictionary, 9 interest areas |
| GET | /api/profile · POST /api/profile/account, /academic, /password | profile (filled once) and account |
| POST | /api/assessments | (login, profile complete) experience → ranking, saved as a snapshot → `{id}` |
| GET | /api/assessments | history (latest 10, top 3 each) |
| GET | /api/assessments/{id} | input + 15 ranked careers + ratings |
| POST | /api/assessments/{id}/ratings | relevance rating 1–5 |
| POST | /api/auth/register, /api/auth/login, /api/auth/logout · GET /api/auth/me | accounts (token in `Authorization: Bearer`) |
| GET | /api/careers, /api/careers/{slug} | public career catalogue |
| POST | /api/ask | Ask AI (LLM, answers from system data with [n] sources) |
| POST | /api/assessments/{id}/explain | LLM explanation of one career (cached per language) |
| POST | /api/assessments/preview | live ranking while choosing experience (not saved) |
| GET | /api/llm/status | provider, model, ready |
| GET/POST/DELETE | /api/kb, /api/kb/{id} | knowledge-base documents (admin) |
| GET | /api/admin/feedback | rating summary (admin) |

## Scoring
e(s) = max(course grade/4, self-rating 0.33/0.67/1, confirmed experience 1);
K = Σ w·e / Σ w over skills in ≥ 10% of the career's job ads; M = 1 if a chosen interest area (max 3) matches;
Fit = 100 [0.5 K + 0.5 M].

## Next
- P2b: Supabase/PostgreSQL (or Supabase Auth), deploy (Vercel + Hugging Face Spaces).
- P3: Ask AI answers, LLM skill extraction from the experience text, retrieval (e5 + FAISS), LLM explanation with sources + claim checker (from notebook Tahap 12).
