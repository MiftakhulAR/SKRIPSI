"""Run: pytest -q   (set SKRIPSI_DIR to also compare with notebook Tahap 10)."""
import csv
import os
from pathlib import Path

TEST_DB = Path(__file__).parent / "_test.db"
TEST_DB.unlink(missing_ok=True)
os.environ["DB_PATH"] = str(TEST_DB)
os.environ["LLM_MOCK"] = "1"
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import scoring  # noqa: E402
from app import db  # noqa: E402
from app.data import store  # noqa: E402
from app.main import app  # noqa: E402

client = TestClient(app)


def test_meta():
    m = client.get("/api/meta").json()
    assert len(m["interest_areas"]) == 50 and m["courses"] and m["skills_by_category"]
    assert m["interest_sources"]["Security"] == "it" and m["interest_sources"]["Law"] == "onet"
    assert m["skill_labels"]["Attention to Detail"] == "Ketelitian" and len(m["groups"]) == 23
    assert "Speaking" in m["soft_skills"] and "Komunikasi" not in m["soft_skills"] and m["course_categories"] == ["university", "faculty", "program", "elective"]
    N = len(m["careers"])
    assert N == 15 + 896 and sum(c["tier"] == "validated" for c in m["careers"]) == 15
    assert m["interest_labels"]["Security"] == "Keamanan siber"


def test_evidence_takes_max():
    code, course = next(iter(store().courses.items()))
    s = course["skills"][0]
    assert scoring.evidence({code: "B"}, {s: "beginner"}, [])[s]["e"] == 0.75              # old format still read
    assert scoring.evidence([{"template": code, "grade": "B"}], {s: "beginner"}, [s])[s]["e"] == 1.0
    # a course typed by the student counts only for the skills the student chose
    ev = scoring.evidence([{"name": "Akuntansi Biaya", "category": "program", "grade": "A", "skills": ["SQL", "Bukan skill"]}], {}, [])
    assert ev["SQL"] == {"e": 1.0, "from": [{"type": "course", "code": "c1", "name": "Akuntansi Biaya", "grade": "A", "category": "program"}]}
    assert set(ev) == {"SQL", "Computers and Electronics"}          # + crosswalk to the O*NET element


def _register(email, name="Test User"):
    r = client.post("/api/auth/register", json={"name": name, "email": email, "password": "rahasia123", "consent": True})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}, r.json()["user"]


STUDENT_H, STUDENT = _register("student@test.id")
_, _admin = _register("admin@test.id", "Admin")
db.update_user(_admin["id"], role="admin")                 # admins are set by seed_accounts.py
ADMIN_H = {"Authorization": f"Bearer {client.post('/api/auth/login', json={'email': 'admin@test.id', 'password': 'rahasia123'}).json()['token']}"}
ADMIN = client.get("/api/auth/me", headers=ADMIN_H).json()
OTHER_H, _ = _register("other@test.id")


def test_roles_and_login():
    assert ADMIN["role"] == "admin" and STUDENT["role"] == "student"
    assert client.post("/api/auth/login", json={"email": "student@test.id", "password": "salah"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "STUDENT@test.id", "password": "rahasia123"}).status_code == 200
    r = client.post("/api/auth/register", json={"name": "X", "email": "x@test.id", "password": "rahasia123", "consent": False})
    assert r.status_code == 422
    assert client.post("/api/auth/register", json={"name": "Dup", "email": "student@test.id", "password": "rahasia123",
                                                     "consent": True}).status_code == 409


def test_access_control():
    assert client.get("/api/assessments").status_code == 401
    assert client.get("/api/kb", headers=STUDENT_H).status_code == 403
    assert client.get("/api/kb", headers=ADMIN_H).status_code == 200
    assert client.get("/api/careers").status_code == 200                       # public browsing


def test_profile_then_assessment():
    code = next(iter(store().courses))
    assert client.get("/api/auth/me", headers=STUDENT_H).json()["profile_complete"] is False
    # assessment needs a complete profile first
    assert client.post("/api/assessments", json={"experience": ["Python"]}, headers=STUDENT_H).status_code == 409
    # each part is saved on its own; the others keep their saved values
    r = client.post("/api/profile/academic", json={"self_rated": {"Python": "advanced", "NotASkill": "advanced"}}, headers=STUDENT_H)
    assert r.status_code == 200 and r.json()["account"]["profile_complete"] is False
    assert client.post("/api/assessments", json={"experience": []}, headers=STUDENT_H).status_code == 409
    assert client.post("/api/profile/academic", json={"interests": ["Security", "Security"] + ["UI/UX design", "Quality assurance", "Systems analysis"]},
                       headers=STUDENT_H).status_code == 422
    courses = [{"template": code, "grade": "A"}, {"template": "XXX", "grade": "A"},
               {"name": "Pengantar Akuntansi", "category": "faculty", "sks": 3, "grade": "B+", "skills": ["Excel"]},
               {"name": "Tanpa nilai", "category": "elective", "skills": []}]
    r = client.post("/api/profile/academic", json={"courses": courses}, headers=STUDENT_H)
    assert r.status_code == 200, r.text
    got = r.json()["profile"]["courses"]
    assert [c["name"] for c in got][1] == "Pengantar Akuntansi" and len(got) == 2 and got[0]["template"] == code
    assert r.json()["profile"]["self_rated"] == {"Python": "advanced"} and r.json()["account"]["profile_complete"] is False
    r = client.post("/api/profile/academic", json={"interests": ["sains data dan ai", "Akuntansi manajemen"],
                                                   "custom_skills": [{"name": "python", "level": "beginner"},
                                                                     {"name": "Jurnal umum", "level": "intermediate"}],
                                                   "target_career": {"name": "data scientist"}}, headers=STUDENT_H)
    assert r.status_code == 200 and r.json()["account"]["profile_complete"] is True
    p = r.json()["profile"]
    assert p["interests"] == ["Data science and AI", "Akuntansi manajemen"]      # EN/ID name -> area; free text kept
    assert p["custom_skills"] == [{"name": "Jurnal umum", "level": "intermediate"}] and p["self_rated"] == {"Python": "advanced"}
    assert p["target_career"] == {"slug": "data-scientist-ml-ai-engineer", "name": "Data Scientist / ML / AI Engineer"}
    assert client.get("/api/meta").json()["courses"][0]["semester"] == 1
    assert len(p["courses"]) == 2 and list(p["self_rated"]) == ["Python"]

    assert client.post("/api/assessments", json={"experience": ["Python"]}).status_code == 401
    aid = client.post("/api/assessments", json={"experience": ["Python"], "notes": "magang"}, headers=STUDENT_H).json()["id"]
    a = client.get(f"/api/assessments/{aid}", headers=STUDENT_H).json()
    assert a["input"]["courses"][0]["template"] == code and a["input"]["experience"] == ["Python"]
    assert len(a["results"]) == 30 and a["results"][0]["M"] == 1.0 and 15 < a["input"]["n_ranked"] < 911
    assert [r["rank"] for r in a["results"][:3]] == [1, 2, 3]
    assert [r["slug"] for r in a["results"] if r["is_target"]] == ["data-scientist-ml-ai-engineer"]
    assert client.get(f"/api/assessments/{aid}", headers=OTHER_H).status_code == 404   # not your assessment
    slug = a["results"][0]["slug"]
    assert client.post(f"/api/assessments/{aid}/ratings", json={"career": slug, "value": 4}, headers=STUDENT_H).json() == {slug: 4}
    assert client.get("/api/assessments", headers=STUDENT_H).json()[0]["id"] == aid
    assert client.get("/api/assessments", headers=OTHER_H).json() == []
    fb = client.get("/api/admin/feedback", headers=ADMIN_H).json()
    assert fb["mean_top3"] == 4.0 and fb["ratings"] == 1

    # live preview (nothing saved) and LLM features (mock)
    pv = client.post("/api/assessments/preview", json={"experience": ["Python"]}, headers=STUDENT_H).json()
    assert len(pv) == 10 and pv[0]["slug"] == slug
    ex = client.post(f"/api/assessments/{aid}/explain", json={"career": slug, "lang": "id"}, headers=STUDENT_H).json()
    assert ex["model"] == "mock" and ex["basis_of_fit"] and ex["complete"]
    assert client.post(f"/api/assessments/{aid}/explain", json={"career": slug}, headers=OTHER_H).status_code == 404
    r = client.post("/api/ask", json={"question": "Apa yang harus saya pelajari?", "lang": "id"}, headers=STUDENT_H).json()
    assert r["answer"] and [x["n"] for x in r["sources"]] == [1, 3] and r["sources"][0]["title"].startswith("Hasil")
    assert client.post("/api/ask", json={"question": "hai apa"}).status_code == 401
    # admins do not take assessments
    assert client.post("/api/assessments", json={"experience": []}, headers=ADMIN_H).status_code == 403


def test_account_and_password():
    h, u = _register("edit@test.id", "Edit Me")
    r = client.post("/api/profile/account", json={"name": "Edited", "email": "edited@test.id", "status": "graduate", "cohort": "2021"}, headers=h)
    assert r.json()["name"] == "Edited" and r.json()["email"] == "edited@test.id"
    assert client.post("/api/profile/account", json={"name": "X2", "email": "student@test.id"}, headers=h).status_code == 409
    assert client.post("/api/profile/password", json={"current": "salah", "new": "barubaru1"}, headers=h).status_code == 401
    assert client.post("/api/profile/password", json={"current": "rahasia123", "new": "barubaru1"}, headers=h).json()["ok"]
    assert client.post("/api/auth/login", json={"email": "edited@test.id", "password": "barubaru1"}).status_code == 200


def test_old_profile_format_is_converted():
    h, u = _register("old@test.id")
    code = next(iter(store().courses))
    db.save_profile(u["id"], {"courses": {code: "A"}, "self_rated": {"Python": "advanced"}, "interests": ["Security"]})
    p = client.get("/api/profile", headers=h).json()
    assert p["profile"]["courses"][0]["template"] == code and p["account"]["profile_complete"] is True
    assert client.post("/api/assessments", json={"experience": []}, headers=h).status_code == 200


def test_admin_catalogue_crud():
    assert client.get("/api/admin/catalog", headers=STUDENT_H).status_code == 403
    cat = client.get("/api/admin/catalog", headers=ADMIN_H).json()
    assert len(cat["careers"]) == 911 and cat["careers"][0]["n_skills"] == sum(1 for r in csv.DictReader(open(Path(__file__).parent.parent / "artifacts" / "bobot_skill_karier.csv")) if r["karier"] == cat["careers"][0]["name"])
    assert client.get(f"/api/admin/careers/{cat['careers'][0]['slug']}", headers=ADMIN_H).json()["skills"]
    # new interest area, soft skill and a reference (non-IT) career
    assert client.post("/api/admin/interests", json={"name": "Accounting and finance", "name_id": "Akuntansi dan keuangan"},
                       headers=ADMIN_H).status_code == 200
    assert client.post("/api/admin/skills", json={"name": "Akuntansi", "category": "Bisnis", "kind": "hard"}, headers=ADMIN_H).status_code == 200
    bad = client.post("/api/admin/careers", json={"name": "Accountant", "interest_areas": ["Nope"],
                                                  "skills": [{"skill": "Akuntansi", "w": 1}]}, headers=ADMIN_H)
    assert bad.status_code == 422
    r = client.post("/api/admin/careers", json={"name": "Accountant", "tier": "reference", "source": "O*NET 13-2011.00",
                                                "onet_soc": "13-2011.00", "interest_areas": ["Accounting and finance"],
                                                "skills": [{"skill": "akuntansi", "w": 0.9}, {"skill": "Excel", "demand_pct": 40},
                                                           {"skill": "Komunikasi", "w": 0.5}]}, headers=ADMIN_H)
    assert r.status_code == 200, r.text
    assert client.post("/api/admin/careers", json={"name": "accountant", "interest_areas": ["Security"],
                                                   "skills": [{"skill": "SQL", "w": 1}]}, headers=ADMIN_H).status_code == 409
    assert len(client.get("/api/careers").json()) == 912
    # an accounting student now gets a non-IT recommendation
    h, _ = _register("akt@test.id", "Mahasiswa Akuntansi")
    client.post("/api/profile/academic", json={"courses": [{"name": "Akuntansi Dasar", "category": "program", "grade": "A",
                                                            "skills": ["Akuntansi"]}],
                                               "self_rated": {"Excel": "intermediate", "Komunikasi": "advanced"},
                                               "interests": ["Akuntansi dan keuangan"]}, headers=h)
    res = client.get(f"/api/assessments/{client.post('/api/assessments', json={'experience': []}, headers=h).json()['id']}",
                     headers=h).json()["results"]
    top = res[0]
    assert top["slug"] == "accountant" and top["tier"] == "reference" and top["sources"][0]["key"] == "reference"
    assert top["skills"][1]["demand_pct"] in (40, None)
    # in-use items cannot be deleted
    assert client.delete("/api/admin/skills/Akuntansi", headers=ADMIN_H).status_code == 409
    assert client.delete("/api/admin/interests/Accounting and finance", headers=ADMIN_H).status_code == 409
    # course template
    r = client.post("/api/admin/courses", json={"code": "AK101", "name": "Akuntansi Dasar", "program": "D3 Akuntansi PNJ",
                                                "semester": 1, "category": "program", "sks": 3, "skills": ["Akuntansi"]}, headers=ADMIN_H)
    assert any(c["code"] == "AK101" for c in r.json()["courses"])
    assert client.delete("/api/admin/courses/AK101", headers=ADMIN_H).status_code == 200
    assert client.delete("/api/admin/careers/accountant", headers=ADMIN_H).status_code == 200
    assert client.delete("/api/admin/skills/Akuntansi", headers=ADMIN_H).status_code == 200
    # reset puts back the Colab data
    r = client.post("/api/admin/catalog/reset", headers=ADMIN_H).json()
    assert len(r["careers"]) == 911 and len(r["interest_areas"]) == 50


def test_all_fields_students():
    """Students outside IT get careers of their own field (O*NET reference pack)."""
    cases = {
        "law": ({"Law and Government": "advanced", "Writing": "advanced", "Speaking": "advanced", "Critical Thinking": "intermediate"},
                ["Law"], ("23-", "43-6012", "25-1112")),
        "nursing": ({"Medicine and Dentistry": "advanced", "Biology": "advanced", "Service Orientation": "advanced",
                     "Empathy": "advanced", "Psychology": "intermediate"}, ["Health Care Service"], ("29-",)),
        "teacher": ({"Education and Training": "advanced", "Instructing": "advanced", "Speaking": "advanced",
                     "Learning Strategies": "advanced"}, ["Teaching/Education"], ("25-",)),
    }
    for name, (skills, interests, soc) in cases.items():
        rows = scoring.recommend({"courses": [], "self_rated": skills, "experience": [], "interests": interests,
                                  "education_level": "d4s1"}, top=5)
        assert rows[0]["tier"] == "reference" and store().careers[rows[0]["slug"]].onet_soc.startswith(soc), (name, rows[0]["name"])
    # IT skills count for O*NET occupations through the crosswalk; Indonesian labels are accepted as input
    ev = scoring.evidence([], {"Python": "advanced", "Ketelitian": "beginner"}, [])
    assert ev["Programming"]["e"] == 1.0 and ev["Programming"]["from"][0] == {"type": "via", "skill": "Python"}
    from app import profile as prof
    assert prof.clean_skills({"ketelitian": "beginner"}, [])[0] == {"Attention to Detail": "beginner"}


HOLDOUT = Path(os.environ.get("SKRIPSI_DIR", "/nonexistent")) / "02_processed" / "holdout_uji.csv"


@pytest.mark.skipif(not HOLDOUT.exists(), reason="set SKRIPSI_DIR to compare with notebook Tahap 10")
def test_same_rank_as_notebook_tahap10():
    """Same ranking as the notebook (Tahap 10 rule; weights from Tahap 13, technical profile = v3_teknis)."""
    rows = [r for r in csv.DictReader(open(HOLDOUT, encoding="utf-8")) if r["layak_uji"] == "True"]
    W = {c.name: c.weights for c in store().careers.values() if c.tier == "validated"}
    for r in rows[:300]:
        S = set(r["skill_teknis"].split(";"))
        K = {c: sum(w for s, w in W[c].items() if s in S) / sum(W[c].values()) for c in W}
        expected = sorted(W, key=lambda c: (-K[c], c))[0]
        data = {"courses": {}, "self_rated": {}, "experience": list(S), "interests": []}
        assert scoring.recommend(data, alpha=1.0, tiers=("validated",), top=1)[0]["name"] == expected
