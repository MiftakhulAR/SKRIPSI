"""FR4 (patch 12): skill suggestions from the student's experience story; the student confirms them.

Method (deterministic, no LLM, so every suggestion can be traced to a phrase in the text):
  1. Skills with a pattern in the skill dictionary v4 (kamus_skill_v4.csv, Tahap 8 + Tahap 13 v2b): the same
     regular expressions and flags (case-insensitive) that the Colab pipeline used to detect skills in job ads.
     Soft skills and English: also the same text normalisation (joined camelCase words are split), so FR4 finds
     exactly what Tahap 13 found (tested on the 1,766 hold-out ads). Technical skills: the text is NOT split,
     because splitting breaks camelCase product names typed by students ("MySQL" -> "My SQL" would suggest
     SQL instead of MySQL, "JavaScript" -> "Java Script" would suggest Java).
  2. Other catalogue skills (O*NET general elements, skills added by the admin): whole-word match of the English
     name or the Indonesian label (names of 3 letters or less are matched case-sensitively, e.g. "SQL", "Go").
Nothing is scored until the student ticks a suggestion; ticked skills become "experience" evidence (e = 1).
The list of suggestions is stored with the assessment so the share of accepted suggestions can be reported.
"""
import csv
import re
from functools import lru_cache

from .catalog_db import ARTIFACT_DIR
from .data import store

MAX_TEXT = 3000
SNIPPET = 60
CAMEL = re.compile(r"([a-z])([A-Z])")          # Tahap 13: teks.str.replace(r"([a-z])([A-Z])", r"\1 \2")


def normalise(text: str, limit: int | None = MAX_TEXT) -> str:
    """Same normalisation as Tahap 13 (only joined camelCase words are split; whitespace is kept)."""
    t = str(text or "")
    return CAMEL.sub(r"\1 \2", t[:limit] if limit else t)


@lru_cache(maxsize=1)
def _dictionary_patterns() -> dict:
    out = {}
    f = ARTIFACT_DIR / "kamus_skill_v4.csv"
    if f.exists():
        for r in csv.DictReader(open(f, encoding="utf-8")):
            if r.get("pola"):
                out[r["skill"]] = re.compile(r["pola"], re.I)
    return out


def _name_pattern(name: str):
    name = name.strip()
    if len(name) < 2:
        return None
    return re.compile(r"(?<![A-Za-z0-9])" + re.escape(name) + r"(?![A-Za-z0-9])", 0 if len(name) <= 3 else re.I)


def _snippet(text: str, m: re.Match) -> str:
    a, b = max(0, m.start() - SNIPPET), min(len(text), m.end() + SNIPPET)
    out = ("…" if a else "") + text[a:m.start()] + "[[" + m.group(0) + "]]" + text[m.end():b] + ("…" if b < len(text) else "")
    return re.sub(r"\s+", " ", out)


def extract(text: str, limit: int | None = MAX_TEXT) -> list[dict]:
    """Skills of the current catalogue mentioned in the text, in order of first mention."""
    t = normalise(text, limit)
    if not t.strip():
        return []
    st = store()
    pats = _dictionary_patterns()
    raw = str(text or "")[:limit] if limit else str(text or "")
    found = []
    for s in st.skills:
        name = s["skill"]
        m, method = None, None
        src = t if (s["kind"] == "soft" or s["category"] == "Bahasa") else raw
        if name in pats:
            m, method = pats[name].search(src), "dictionary"
            if m and src is t:                    # found as in Tahap 13; show the phrase as the student typed it
                m_raw = pats[name].search(raw)
                m, src = (m_raw, raw) if m_raw else (m, src)
        else:
            src = raw
            for label in (name, s.get("name_id") or ""):
                p = _name_pattern(label) if label else None
                m = p.search(src) if p else None
                if m:
                    method = "name"
                    break
        if m:
            found.append({"skill": name, "kind": s["kind"], "category": s["category"], "method": method,
                          "pos": m.start(), "match": m.group(0).lower(), "snippet": _snippet(src, m)})
    # an O*NET element whose label is the same phrase as a dictionary skill (e.g. "English Language" = "Bahasa
    # Inggris") is not suggested twice: the dictionary skill is the one the IT careers are weighted on
    seen = {x["match"] for x in found if x["method"] == "dictionary"}
    found = [x for x in found if x["method"] == "dictionary" or x["match"] not in seen]
    found.sort(key=lambda x: (x["pos"], x["skill"]))
    for x in found:
        x.pop("pos"), x.pop("match")
    return found
