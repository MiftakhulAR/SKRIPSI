"""Patch 12: weights v2b (Tahap 13 final), O*NET label fixes, FR4 skill suggestions from the experience story.

Run with the other tests: pytest -q. Set SKRIPSI_DIR (folder Skripsi_RAG from Drive) to also check that the web gives
the same ranking metrics as the notebook (logs/tahap13_log.json) and that FR4 finds the same soft skills as Tahap 13.
"""
import csv
import json
import os
from pathlib import Path

import pytest

from test_api import ADMIN_H, _register, client  # same test database and client

from app import catalog_db, extract, scoring
from app.data import reload, store

ART = catalog_db.ARTIFACT_DIR
SK = Path(os.environ.get("SKRIPSI_DIR", "/nonexistent"))


def test_weights_are_v2b():
    rows = list(csv.DictReader(open(ART / "bobot_skill_karier.csv", encoding="utf-8")))
    assert len(rows) == 293
    W = {c.name: c.weights for c in store().careers.values() if c.tier == "validated"}
    assert len(W) == 15 and sum(len(w) for w in W.values()) == 293
    assert "Social Perceptiveness" in W["Cyber Security"] and "Social Orientation" not in W["Cyber Security"]
    for r in rows:
        assert W[r["karier"]][r["skill"]] == pytest.approx(float(r["w"]))
    soft = [r for r in csv.DictReader(open(ART / "kamus_skill_v4.csv", encoding="utf-8")) if r["jenis"] == "soft"]
    assert len(soft) == 29


@pytest.mark.skipif(not (SK / "05_artifacts" / "web" / "bobot_skill_karier.csv").exists(), reason="set SKRIPSI_DIR")
def test_artifacts_equal_drive():
    for f in ("bobot_skill_karier.csv", "kamus_skill_v4.csv"):
        assert (ART / f).read_bytes() == (SK / "05_artifacts" / "web" / f).read_bytes(), f


def test_old_database_is_upgraded():
    """A laptop database from patch 10/11 (pipeline 'tahap13' = v1b weights, old labels) is upgraded at start."""
    with catalog_db.conn() as c:
        c.execute("UPDATE catalog_meta SET value='tahap13' WHERE key='pipeline_version'")
        c.execute("DELETE FROM catalog_meta WHERE key='onet_labels_version'")
        c.execute("INSERT INTO career_skills VALUES ('cyber-security', 'Social Orientation', 0.1, 11.3) ON CONFLICT DO NOTHING")
        c.execute("DELETE FROM career_skills WHERE career_slug='cyber-security' AND skill='Social Perceptiveness'")
        c.execute("UPDATE skills SET name_id='Bahasa ibu (tata bahasa dan komposisi)' WHERE name='English Language'")
    catalog_db.init()
    reload()
    w = store().careers["cyber-security"].weights
    assert "Social Perceptiveness" in w and "Social Orientation" not in w
    sk = {s["skill"]: s for s in store().skills}
    assert sk["English Language"]["name_id"] == "Bahasa Inggris"
    assert sk["Writing"]["kind"] == "soft"


def test_onet_label_files_fixed():
    lab = {r["name"]: r for r in csv.DictReader(open(ART.parent / "tools" / "onet_labels_id.csv", encoding="utf-8"))}
    el = {r["name"]: r for r in csv.DictReader(open(ART / "onet_elements.csv", encoding="utf-8"))}
    for d in (lab, el):
        assert d["Writing"]["kind"] == "soft" and d["English Language"]["name_id"] == "Bahasa Inggris"


def test_extract_examples():
    got = [x["skill"] for x in extract.extract(
        "3-month internship as a web developer at a startup: built a REST API with Laravel and MySQL, used Git with a team of 4.")]
    assert {"REST API", "Laravel", "MySQL", "Git"} <= set(got)
    got = {x["skill"]: x for x in extract.extract("Magang di bank: membuat dashboard Power BI, presentasi ke manajer, "
                                                  "kerja tim lintas divisi, laporan dalam bahasa Inggris.")}
    assert {"Power BI", "Data Visualization", "Cooperation", "Bahasa Inggris"} <= set(got)
    assert "English Language" not in got                       # same phrase as the dictionary skill: suggested once
    assert got["Power BI"]["method"] == "dictionary" and "[[Power BI]]" in got["Power BI"]["snippet"]
    # non-IT: O*NET element names / Indonesian labels
    got = {x["skill"] for x in extract.extract("Volunteer teaching mathematics and psychology to high-school students")}
    assert {"Mathematics", "Psychology"} <= got
    assert extract.extract("   ") == []


def test_extract_endpoint_and_acceptance_stats():
    h, _ = _register("fr4@test.id")
    assert client.post("/api/profile/academic", json={"self_rated": {"Python": "advanced"}, "interests": ["Security"]},
                       headers=h).json()["account"]["profile_complete"] is True
    r = client.post("/api/experience/extract", json={"text": "Built a Flutter app with Firebase; worked under pressure."}, headers=h)
    assert r.status_code == 200, r.text
    found = [x["skill"] for x in r.json()["skills"]]
    assert {"Flutter", "Firebase", "Stress Tolerance"} <= set(found)
    assert client.post("/api/experience/extract", json={"text": "x"}).status_code == 401
    r = client.post("/api/assessments", json={"experience": ["Flutter", "Firebase"], "notes": "story",
                                              "suggested": found}, headers=h)
    assert r.status_code == 200, r.text
    a = client.get(f"/api/assessments/{r.json()['id']}", headers=h).json()
    assert set(a["input"]["experience_suggested"]) == set(found) and a["input"]["experience"] == ["Flutter", "Firebase"]
    fr4 = client.get("/api/admin/feedback", headers=ADMIN_H).json()["fr4"]
    assert fr4["assessments_with_story"] >= 1 and fr4["accepted"] >= 2 and fr4["suggested"] >= len(found)


HOLD = SK / "02_processed" / "holdout_uji.csv"


@pytest.mark.skipif(not (HOLD.exists() and (SK / "logs" / "tahap13_log.json").exists()), reason="set SKRIPSI_DIR")
def test_metrics_and_fr4_equal_notebook_tahap13():
    """Web ranking on the hold-out ads = notebook Tahap 13 (macro Hit@1/Hit@3/MRR, both profiles).
    Profile 'lengkap' adds the soft skills and English found by the FR4 extractor in the ad text, so this also
    checks that FR4 detects them exactly like the pipeline."""
    log = json.load(open(SK / "logs" / "tahap13_log.json"))["makro"]
    ti = {}
    for r in csv.DictReader(open(SK / "02_processed" / "lowongan_ti.csv", encoding="utf-8")):
        ti[f"{r['sumber']}|{r['id_lowongan']}"] = r["teks"]
    rows = [r for r in csv.DictReader(open(HOLD, encoding="utf-8")) if r["layak_uji"] == "True"]
    assert len(rows) == 1766
    soft = {s["skill"] for s in store().skills if s["kind"] == "soft"} | {"Bahasa Inggris"}
    W = {c.name: c.weights for c in store().careers.values() if c.tier == "validated"}
    out = {}
    for prof in ("teknis", "lengkap"):
        per = {}
        for r in rows:
            S = set(r["skill_teknis"].split(";"))
            if prof == "lengkap":
                S |= {x["skill"] for x in extract.extract(ti[r["iid"]], limit=None) if x["skill"] in soft}
            data = {"courses": {}, "self_rated": {}, "experience": list(S), "interests": []}
            ranked = [x["name"] for x in scoring.recommend(data, alpha=1.0, tiers=("validated",), top=15)]
            k = ranked.index(r["karier"]) + 1 if r["karier"] in ranked else 16
            per.setdefault(r["karier"], []).append(k)
        mac = lambda f: round(sum(sum(map(f, v)) / len(v) for v in per.values()) / len(per), 3)
        out[prof] = {"Hit@1": mac(lambda k: k == 1), "Hit@3": mac(lambda k: k <= 3), "MRR": mac(lambda k: 1 / k)}
    assert out["teknis"] == log["v3_teknis"], out
    assert out["lengkap"] == log["v3_lengkap"], out
