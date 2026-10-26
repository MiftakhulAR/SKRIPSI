"""RAG (patch 11): retriever = notebook Tahap 12 ambil(); explanation v1 with passages; claim checker.

Run: pytest -q.  With a real embedding model, tools/check_rag_tahap12.py compares the passages with the
ones used in the Tahap 12 evaluation (needs the Drive folder)."""
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

TEST_DB = Path(__file__).parent / "_test_rag.db"
TEST_DB.unlink(missing_ok=True)
os.environ["DB_PATH"] = str(TEST_DB)

from app import assistant, claims, db, rag  # noqa: E402
from app.data import store  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)
KB = rag.get()


def ambil_notebook(kb_df, emb, embed, karier, cocok, gap, k, tau, mode):
    """Notebook 12_llm_rag_eval_v2.ipynb, Cell 3, copied as is (kb_df = all chunks)."""
    q = embed([f"{karier}. Kompetensi yang dimiliki: {', '.join(cocok) or '-'}. "
               f"Kompetensi yang perlu ditingkatkan: {', '.join(gap[:3]) or '-'}."], "query: ")[0]
    KARIER_SET = kb_df["karier"].map(lambda x: set(x or [])).tolist()
    mask = kb_df["retrieval"].to_numpy() & np.array([karier in s for s in KARIER_SET])
    if mode == "publik":
        mask &= (kb_df["akses"] == "publik").to_numpy()
    idx = np.where(mask)[0]
    skor = emb[idx] @ q
    o = np.argsort(-skor)
    h = kb_df.iloc[idx[o]][["chunk_id", "jenis", "akses", "judul", "teks"]].copy()
    h.insert(0, "skor", skor[o].round(4))
    h = h.drop_duplicates("judul").head(k)
    return h[h["skor"] >= tau].reset_index(drop=True)


def test_kb_loaded_public_layer():
    assert KB is not None and KB.layer == "public" and KB.tau == 0.8401 and KB.top_k == 5
    assert len(KB.chunks) == 970 and all(c["akses"] == "publik" for c in KB.chunks)
    st = client.get("/api/rag/status").json()
    assert st["ready"] and st["prompt_version"] == "v1" and st["evaluated_model"] == "openai/gpt-oss-120b"
    assert "teks" not in json.dumps(st)


def test_retrieval_equals_notebook():
    df = pd.DataFrame(KB.chunks).assign(retrieval=True)
    tau = 0.05                                     # mock embeddings give low scores; the rule is what is tested
    old, KB.tau = KB.tau, tau
    try:
        for career in [c.name for c in store().careers.values() if c.tier == "validated"]:
            cocok, gap = ["Python", "SQL", "Git"], ["Docker", "Linux", "Java", "AWS"]
            web = [p["chunk_id"] for p in KB.for_career(career, cocok, gap)]
            nb = ambil_notebook(df, KB.emb, KB.embedder.encode, career, cocok, gap, 5, tau, "publik")["chunk_id"].tolist()
            assert web == nb, career
            assert web, career
    finally:
        KB.tau = old


def test_private_excerpt_never_sent_to_browser():
    p = {"chunk_id": "rps-1", "jenis": "rps", "judul": "[RPS] X", "teks": "[RPS] X\nisi internal", "akses": "privat", "skor": 0.9}
    out = rag.public_passage(p, 1, "en")
    assert out["access"] == "internal" and "excerpt" not in out
    assert rag.public_passage({**p, "akses": "publik"}, 1, "en")["excerpt"] == "isi internal"


def _student(email):
    r = client.post("/api/auth/register", json={"name": "Rag Test", "email": email, "password": "rahasia123", "consent": True})
    h = {"Authorization": f"Bearer {r.json()['token']}"}
    client.post("/api/profile/academic", json={"self_rated": {"Python": "advanced", "SQL": "intermediate", "Java": "beginner",
                                                              "JavaScript": "advanced", "Git": "advanced"},
                                               "interests": ["Software development"]}, headers=h)
    aid = client.post("/api/assessments", json={"experience": ["Python"]}, headers=h).json()["id"]
    return h, client.get(f"/api/assessments/{aid}", headers=h).json()


def test_explain_rag_non_rag_and_reference():
    h, a = _student("rag@test.id")
    val = next(r for r in a["results"] if r["tier"] == "validated")
    old, KB.tau = KB.tau, 0.0
    try:
        ex = client.post(f"/api/assessments/{a['id']}/explain", json={"career": val["slug"], "lang": "en"}, headers=h).json()
    finally:
        KB.tau = old
    assert ex["mode"] == "rag" and ex["kb_layer"] == "public" and ex["prompt_version"] == "v1" and ex["evaluated_config"]
    assert 1 <= len(ex["passages"]) <= 5 and ex["passages"][0]["n"] == 1 and ex["passages"][0]["access"] == "public"
    first = ex["basis_of_fit"]
    assert first[0]["data"] and first[1]["cites"] == [1]                 # passage id -> [1]
    assert ex["check"]["claims"] > 0 and ex["check"]["invalid_citations"] == 0 and ex["complete"]
    # cached per language and mode
    again = client.post(f"/api/assessments/{a['id']}/explain", json={"career": val["slug"], "lang": "en"}, headers=h).json()
    assert again["created_at"] == ex["created_at"]
    nr = client.post(f"/api/assessments/{a['id']}/explain", json={"career": val["slug"], "mode": "non_rag"}, headers=h).json()
    assert nr["mode"] == "non_rag" and nr["passages"] == [] and all(not it["cites"] for b in claims.BAGIAN for it in nr[b])
    ref = next((r for r in a["results"] if r["tier"] == "reference"), None)
    if ref:
        rx = client.post(f"/api/assessments/{a['id']}/explain", json={"career": ref["slug"]}, headers=h).json()
        assert rx["mode"] == "system_data" and rx["passages"] == [] and rx["prompt_version"] == "system-data-1"


def test_system_data_has_notebook_fields():
    _, a = _student("rag2@test.id")
    r = next(r for r in a["results"] if r["tier"] == "validated")
    d = assistant.data_sistem(r)
    assert list(d) == ["career", "graduate_profile_career", "fit_score_0_100", "job_ads_analysed_for_career",
                       "curriculum_coverage_percent", "matched_skills", "skill_gaps"]
    assert len(d["skill_gaps"]) <= 5 and set(d["skill_gaps"][0]) == {"skill", "percent_of_ads_requesting", "taught_in_pnj_courses"}
    msg = assistant.pesan(d, [], "en")
    assert msg.startswith("Language: English\n\nSYSTEM DATA:\n") and msg.endswith("PASSAGES:\n(no passages)")
    sys_p = assistant.prompts()["sistem_penjelasan"]
    assert sys_p.startswith("You explain a career recommendation to an Informatics student of Politeknik Negeri Jakarta")


def test_claim_checker_like_notebook():
    st = store()
    c = next(c for c in st.careers.values() if c.name == "Software Developer")
    req = sorted(c.weights, key=lambda s: -c.weights[s])
    S = set(req[:3]); gap = req[3:]
    s1, g1 = req[0], gap[0]
    p1 = c.demand_pct[s1]
    sections = {
        "basis_of_fit": [{"text": "Software Developer fits with a score of 61.5.", "sources": ["DATA"]},
                         {"text": "This is described in SKKNI 282/2016 unit J.620100.004.01.", "sources": ["skkni-x"]}],
        "matched_competencies": [{"text": f"You already have {s1}, requested in {p1}% of ads.", "sources": ["DATA"]}],
        "competencies_to_improve": [{"text": f"Improve {g1} ({c.demand_pct[g1] + 3}% of ads).", "sources": ["DATA"]}],
        "development_advice": [{"text": "Build a portfolio.", "sources": ["DATA"]}]}
    out = claims.check(sections, ["skkni-x"], c, S, S, gap, 61.5, KB)
    assert out["unsupported"] == [f"angka:{round(c.demand_pct[g1] + 3, 1)}%"], out["unsupported"]
    assert out["not_checkable"] == 2 and out["invalid_citations"] == 0 and out["complete"]
    bad = claims.check({**sections, "basis_of_fit": [{"text": "See SKKNI 999/2030.", "sources": ["nope"]}]},
                       [], c, S, S, gap, 61.5, KB)
    assert "standard:SKKNI 999/2030" in bad["unsupported"] and bad["invalid_citations"] == 1
    # "React" inside "React Native" is not a second skill claim (bug fixed on 19 Okt)
    assert claims.skill_disebut("I used React Native") == ["React Native"]


def test_ask_uses_kb_passages():
    h, _ = _student("rag3@test.id")
    old, KB.tau = KB.tau, 0.0
    try:
        r = client.post("/api/ask", json={"question": "What does a Database Administrator do?", "lang": "en"}, headers=h).json()
    finally:
        KB.tau = old
    assert r["mode"] == "rag" and r["passages_retrieved"] >= 1
    kbsrc = [s for s in r["sources"] if s.get("type") != "system"]
    assert kbsrc and kbsrc[0]["n"] == 5 and kbsrc[0]["title"]
