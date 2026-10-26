"""Retrieval for the knowledge base (RAG) - same retriever as notebook Tahap 11/12.

  embedding  intfloat/multilingual-e5-base, prefixes "query: " / "passage: ", vectors normalised (cosine = dot)
  query      "{career}. Kompetensi yang dimiliki: {matched}. Kompetensi yang perlu ditingkatkan: {gap[:3]}."
  candidates chunks with retrieval = true that are tagged with the career
  result     top_k = 5 after removing duplicate titles, then only passages with score >= tau (0.8401, Tahap 11)

Knowledge-base layer (backend/.env):
  KB_LAYER=public     SKKNI units, KOMDIGI occupations, career profiles. Safe for a public deployment. (default)
  KB_LAYER=internal   public + PNJ curriculum, courses and RPS. Same layer as the Tahap 12 evaluation.
                      Only on your own laptop: the internal files are git-ignored and must not be deployed.

Files in artifacts/kb/ (made by tools/build_kb_artifacts.py from the Drive folder 03_kb):
  retrieval_config.json, kb_codes.json, {layer}_chunks.jsonl, {layer}_emb.npy
If {layer}_emb.npy is missing, the passages are embedded once at start-up with the same model and saved.
"""
import json
import os
import threading
import zlib
from pathlib import Path

import numpy as np

KB_DIR = Path(os.environ.get("KB_DIR", Path(__file__).resolve().parent.parent / "artifacts" / "kb"))
LAYERS = ("public", "internal")


def _log(msg: str):
    print(f"[RAG] {msg}", flush=True)


class _Embedder:
    """Lazy sentence-transformers model. KB_EMBED_MOCK=1 gives a deterministic hashing embedder (tests only)."""

    def __init__(self, model: str, dim: int):
        self.model_name, self.dim, self._m = model, dim, None
        self.mock = os.environ.get("KB_EMBED_MOCK") == "1"

    def encode(self, texts: list[str], prefix: str) -> np.ndarray:
        if self.mock:
            out = np.zeros((len(texts), self.dim), dtype="float32")
            for i, t in enumerate(texts):
                for w in (prefix + t).lower().split():
                    out[i, zlib.crc32(w.encode()) % self.dim] += 1.0
            return out / np.maximum(np.linalg.norm(out, axis=1, keepdims=True), 1e-9)
        if self._m is None:
            from sentence_transformers import SentenceTransformer
            _log(f"loading embedding model {self.model_name} (first time: download ~1 GB)")
            self._m = SentenceTransformer(self.model_name, device="cpu")
        return self._m.encode([prefix + t for t in texts], normalize_embeddings=True, convert_to_numpy=True,
                              batch_size=32).astype("float32")


class KnowledgeBase:
    def __init__(self, layer: str):
        cfg_path = KB_DIR / "retrieval_config.json"
        if not cfg_path.exists():
            raise FileNotFoundError(cfg_path)
        self.cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        self.tau, self.top_k = float(self.cfg["tau"]), int(self.cfg["top_k"])
        want = layer if layer in LAYERS else "public"
        if want == "internal" and not (KB_DIR / "internal_chunks.jsonl").exists():
            _log("KB_LAYER=internal but artifacts/kb/internal_chunks.jsonl is missing -> using the public layer")
            want = "public"
        self.layer = want
        self.chunks = [json.loads(line) for line in open(KB_DIR / f"{want}_chunks.jsonl", encoding="utf-8")]
        codes = json.loads((KB_DIR / "kb_codes.json").read_text(encoding="utf-8"))
        self.unit_codes, self.skkni_numbers = set(codes["unit_codes"]), {tuple(x) for x in codes["skkni_numbers"]}
        self.embedder = _Embedder(self.cfg["model_embedding"], int(codes.get("dim", 768)))
        emb_path = KB_DIR / f"{want}_emb.npy"
        if self.embedder.mock:
            self.emb = self.embedder.encode([c["teks"] for c in self.chunks], self.cfg["prefix_passage"])
        elif emb_path.exists():
            self.emb = np.load(emb_path).astype("float32")
        else:
            _log(f"{emb_path.name} not found: embedding {len(self.chunks)} passages once (a few minutes on CPU)")
            self.emb = self.embedder.encode([c["teks"] for c in self.chunks], self.cfg["prefix_passage"])
            np.save(emb_path, self.emb)
        assert len(self.emb) == len(self.chunks), "embeddings and chunks do not match - rebuild artifacts/kb"
        self.careers = [set(c.get("karier") or []) for c in self.chunks]
        self.by_id = {c["chunk_id"]: c for c in self.chunks}
        _log(f"layer={self.layer} passages={len(self.chunks)} tau={self.tau} top_k={self.top_k}")

    # ---- retrieval ----
    @staticmethod
    def career_query(career: str, matched: list, gaps: list) -> str:
        return (f"{career}. Kompetensi yang dimiliki: {', '.join(matched) or '-'}. "
                f"Kompetensi yang perlu ditingkatkan: {', '.join(gaps[:3]) or '-'}.")

    def _search(self, q: np.ndarray, idx: np.ndarray, k: int, tau: float) -> list[dict]:
        if not len(idx):
            return []
        score = self.emb[idx] @ q
        order = np.argsort(-score, kind="stable")
        out, seen = [], set()
        for j in order:                                   # drop_duplicates("judul").head(k), then score >= tau
            c = self.chunks[idx[j]]
            if c["judul"] in seen:
                continue
            seen.add(c["judul"])
            out.append({**c, "skor": round(float(score[j]), 4)})
            if len(out) == k:
                break
        return [p for p in out if p["skor"] >= tau]

    def for_career(self, career: str, matched: list, gaps: list) -> list[dict]:
        """Passages for the explanation of one validated career (notebook Tahap 12, ambil())."""
        q = self.embedder.encode([self.career_query(career, matched, gaps)], self.cfg["prefix_query"])[0]
        idx = np.array([i for i, s in enumerate(self.careers) if career in s], dtype=int)
        return self._search(q, idx, self.top_k, self.tau)

    def for_question(self, question: str, careers: list[str] | None = None, k: int = 4) -> list[dict]:
        """Passages for Ask AI: the question itself is the query; candidates = passages of the given careers
        (or all passages when none is given). Same tau. Not part of the Tahap 12 evaluation."""
        q = self.embedder.encode([question], self.cfg["prefix_query"])[0]
        want = set(careers or [])
        idx = np.array([i for i, s in enumerate(self.careers) if not want or (s & want)], dtype=int)
        return self._search(q, idx, k, self.tau)

    def status(self) -> dict:
        kinds: dict[str, int] = {}
        for c in self.chunks:
            kinds[c["jenis"]] = kinds.get(c["jenis"], 0) + 1
        return {"ready": True, "layer": self.layer, "passages": len(self.chunks), "by_type": kinds, "tau": self.tau,
                "top_k": self.top_k, "embedding_model": self.cfg["model_embedding"], "embedding_mock": self.embedder.mock,
                "kb_version": self.cfg.get("kb_versi")}


_kb: KnowledgeBase | None = None
_err: str | None = None
_lock = threading.Lock()


def get() -> KnowledgeBase | None:
    """The loaded knowledge base, or None when artifacts/kb is missing (the web then runs without RAG)."""
    global _kb, _err
    if _kb is None and _err is None:
        with _lock:
            if _kb is None and _err is None:
                try:
                    _kb = KnowledgeBase(os.environ.get("KB_LAYER", "public").strip().lower())
                except Exception as e:                    # noqa: BLE001 - reported in /api/rag/status
                    _err = f"{type(e).__name__}: {e}"
                    _log(f"knowledge base not loaded ({_err}). Explanations fall back to system data only.")
    return _kb


def status() -> dict:
    kb = get()
    return kb.status() if kb else {"ready": False, "error": _err, "layer": os.environ.get("KB_LAYER", "public")}


def public_passage(p: dict, n: int, lang: str) -> dict:
    """What the browser may see of a passage. Private (PNJ internal) passages show their title only."""
    out = {"n": n, "chunk_id": p["chunk_id"], "type": p["jenis"], "title": p["judul"], "source": p.get("sumber"),
           "access": "public" if p.get("akses") == "publik" else "internal", "score": p.get("skor")}
    if out["access"] == "public":
        body = p["teks"].split("\n", 1)[-1].strip()
        out["excerpt"] = body[:600] + ("…" if len(body) > 600 else "")
    return out
