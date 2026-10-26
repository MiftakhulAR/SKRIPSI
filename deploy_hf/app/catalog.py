"""Knowledge-base document list shown on the admin page (status only, never the content).

Scoring data (careers, skill weights, course-skill mapping, skill dictionary) is loaded
from artifacts/ (see data.py). Internal document texts are not stored in this repo.
Columns: title, doc_type, format, year, access (public/private), chunks (0 = not reported), status.
"""

KB_SEED = [
    ("Kurikulum D4 Teknik Informatika", "Curriculum", "PDF", "—", "private", 0, "Indexed"),
    ("Capaian Pembelajaran Lulusan (CPL) Prodi TI", "CPL", "PDF", "—", "private", 0, "Indexed"),
    ("RPS mata kuliah Prodi TI (collection)", "RPS", "PDF", "—", "private", 0, "Indexed"),
    ("Profil & kompetensi lulusan D4 TI", "Graduate profile", "PDF", "—", "private", 0, "Indexed"),
    ("Career profiles — 15 careers (industry needs; curriculum & standards)", "Career profiles", "MD", "2026", "public", 30, "Indexed"),
    ("SKKNI / KKNI occupational standards (ICT)", "Competency standard", "PDF", "—", "public", 0, "Indexed"),
    ("Indonesian IT job ads — 4 public datasets", "Industry data", "CSV", "2015–2025", "public", 0, "Used for scoring"),
    ("O*NET occupation profiles", "Industry data", "CSV", "—", "public", 0, "Triangulation only"),
    ("Tracer study CDC PNJ", "Graduate outcomes", "PDF", "2024", "private", 0, "Aggregate figures only"),
]
