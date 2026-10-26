"""Copy the knowledge base made in Colab (Tahap 11) into backend/artifacts/kb/.

Usage (once, and again whenever Tahap 11 is re-run):
    py -3.12 tools/build_kb_artifacts.py "G:/My Drive/Skripsi_RAG"
The argument is the Drive folder that contains 03_kb/ (or the 03_kb folder itself, e.g. a downloaded copy).

Reads 03_kb/kb_v2_chunks.jsonl, 03_kb/kb_v2_embeddings.npy and 03_kb/retrieval_config.json and writes
    retrieval_config.json  kb_codes.json           (public, small)
    public_chunks.jsonl    public_emb.npy           (SKKNI / KOMDIGI occupations / career profiles, retrieval = true)
    internal_chunks.jsonl  internal_emb.npy         (all retrievable passages incl. PNJ RPS/courses; git-ignored)
The embedding rows are copied unchanged (no re-embedding), so retrieval scores equal the notebook's.
"""
import json
import re
import sys
from pathlib import Path

import numpy as np

KODE_UNIT = re.compile(r"\b(J\.\d{6}\.\d{3}\.\d{2}|[JK]\.\d{2}[A-Z0-9]{3}\d{2}\.\d{2,3}\.\d|ICA[A-Z]{3}\d{3}[A-Z]?|ICT[A-Z]{3}\d{3}[A-Z]?|TIK\.[A-Z]{3}\d{4}|\d{6}(?= -))")
KEEP = ("chunk_id", "jenis", "judul", "teks", "karier", "akses", "sumber")


def main(src: str, out_dir: Path):
    kb_dir = Path(src)
    if (kb_dir / "03_kb").is_dir():
        kb_dir = kb_dir / "03_kb"
    rows = [json.loads(line) for line in open(kb_dir / "kb_v2_chunks.jsonl", encoding="utf-8")]
    cfg = json.loads((kb_dir / "retrieval_config.json").read_text(encoding="utf-8"))
    emb_path = kb_dir / "kb_v2_embeddings.npy"
    emb = np.load(emb_path) if emb_path.exists() else None
    if emb is not None:
        assert len(emb) == len(rows), f"{emb_path.name} has {len(emb)} rows but there are {len(rows)} chunks"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "retrieval_config.json").write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding="utf-8")
    text = " ".join(r["judul"] for r in rows) + " " + " ".join(r["teks"] for r in rows)
    skkni = sorted({(int(a), b) for a, b in re.findall(r"SKKNI\s+(\d{1,3})/(\d{4})", " ".join(r["judul"] for r in rows))})
    codes = {"unit_codes": sorted(set(KODE_UNIT.findall(text))), "skkni_numbers": skkni,
             "dim": int(emb.shape[1]) if emb is not None else 768, "note": "codes found in all 03_kb chunks (Tahap 11)"}
    (out_dir / "kb_codes.json").write_text(json.dumps(codes, ensure_ascii=False), encoding="utf-8")
    for layer, ok in (("public", lambda r: r["akses"] == "publik"), ("internal", lambda r: True)):
        idx = [i for i, r in enumerate(rows) if r["retrieval"] and ok(r)]
        with open(out_dir / f"{layer}_chunks.jsonl", "w", encoding="utf-8") as f:
            for i in idx:
                f.write(json.dumps({k: rows[i].get(k) for k in KEEP}, ensure_ascii=False) + "\n")
        if emb is not None:
            np.save(out_dir / f"{layer}_emb.npy", emb[idx].astype("float32"))
        print(f"{layer:8s}: {len(idx)} passages" + ("" if emb is not None else " (no embeddings file: the backend embeds them once)"))
    print("unit codes:", len(codes["unit_codes"]), "| SKKNI numbers:", len(skkni), "| ->", out_dir)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], Path(__file__).resolve().parent.parent / "artifacts" / "kb")
