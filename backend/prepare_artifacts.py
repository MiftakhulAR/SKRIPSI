"""Copy the public scoring tables from the Colab project into backend/artifacts.

Usage:  python prepare_artifacts.py "/path/to/Skripsi_RAG"
(e.g. the Google Drive for Desktop folder, or a downloaded copy of 02_processed)

mk_skill_terverifikasi.csv is reduced to code, course name, semester and skill for valid rows,
so RPS evidence notes (internal) never enter the web repo. The semester comes from
mk_skill_kandidat.csv (read from each RPS); for courses added later without an RPS
semester, it is inferred from the course code (TI21SSnn -> SS) and marked as inferred.
"""
import csv
import re
import shutil
import sys
from pathlib import Path

src = Path(sys.argv[1]) / "02_processed"
dst = Path(__file__).resolve().parent / "artifacts"
dst.mkdir(exist_ok=True)

for name in ["bobot_skill_karier.csv", "katalog_karier.csv", "kamus_skill_v3.csv",
             "cakupan_kurikulum_karier_v2.csv"]:
    shutil.copy(src / name, dst / name)
    print("copied", name)

semester = {}
with open(src / "mk_skill_kandidat.csv", newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        if r.get("semester"):
            semester[r["kode"]] = str(int(float(r["semester"])))


def sem_of(code):
    if code in semester:
        return semester[code], "rps"
    m = re.match(r"TI21(\d\d)\d\d$", code)
    return (str(int(m.group(1))), "inferred") if m else ("", "unknown")


with open(src / "mk_skill_terverifikasi.csv", newline="", encoding="utf-8") as fi, \
        open(dst / "mk_skill_web.csv", "w", newline="", encoding="utf-8") as fo:
    w = csv.writer(fo)
    w.writerow(["kode", "nama_mata_kuliah", "semester", "semester_source", "skill"])
    n = 0
    for r in csv.DictReader(fi):
        if str(r["valid"]).strip() == "1":
            sem, how = sem_of(r["kode"])
            w.writerow([r["kode"], r["nama_mata_kuliah"], sem, how, r["skill"]])
            n += 1
print("mk_skill_web.csv rows:", n)
