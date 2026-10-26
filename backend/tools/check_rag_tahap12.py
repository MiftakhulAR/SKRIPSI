"""Check that the web retriever returns the same passages as the Tahap 12 evaluation (real e5 model).

Usage (after tools/build_kb_artifacts.py):
    set KB_LAYER=internal
    py -3.12 tools/check_rag_tahap12.py "G:/My Drive/Skripsi_RAG"
Reads 04_eval/penjelasan_profil_uji.csv (60 test profiles) and 04_eval/penjelasan_hasil.jsonl (passages used
in the RAG condition) and compares them with app.rag for every profile. Tahap 12 ran on the internal layer,
so run this with KB_LAYER=internal; on the public layer only the public passages can match.
Writes logs/cek_rag_web_tahap12.json in the Drive folder.
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pandas as pd  # noqa: E402

from app import rag  # noqa: E402


def main(project: Path):
    P = pd.read_csv(project / "04_eval" / "penjelasan_profil_uji.csv", keep_default_na=False)
    used = {}
    for line in open(project / "04_eval" / "penjelasan_hasil.jsonl", encoding="utf-8"):
        h = json.loads(line)
        if h["kondisi"] == "rag":
            used[h["pid"]] = h["passage"]
    kb = rag.get()
    assert kb, rag.status()
    print(f"layer={kb.layer} passages={len(kb.chunks)} tau={kb.tau}")
    rows = []
    for p in P.itertuples():
        cocok, gap = [s for s in p.cocok.split(";") if s], [s for s in p.gap.split(";") if s]
        got = kb.for_career(p.karier_top1, cocok, gap)
        web, nb = [x["chunk_id"] for x in got], used.get(p.pid, [])
        rows.append({"pid": p.pid, "career": p.karier_top1, "same": web == nb, "web": web, "notebook": nb,
                     "scores": [x["skor"] for x in got]})
        if web != nb:
            print(f"  {p.pid} {p.karier_top1}: web={web} notebook={nb}")
    same = sum(r["same"] for r in rows)
    out = {"layer": kb.layer, "profiles": len(rows), "same_passages": same, "rows": rows}
    (project / "logs").mkdir(exist_ok=True)
    (project / "logs" / "cek_rag_web_tahap12.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"same passages as Tahap 12: {same}/{len(rows)}  -> logs/cek_rag_web_tahap12.json")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    os.environ.setdefault("KB_LAYER", "internal")
    main(Path(sys.argv[1]))
