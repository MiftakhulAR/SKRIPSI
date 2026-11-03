"""Regression tests for Render memory limits and concurrent RAG requests."""
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import numpy as np
import pytest

from app import rag


def test_container_limits_v1_and_v2(monkeypatch):
    values = {"/sys/fs/cgroup/memory.max": "max",
              "/sys/fs/cgroup/memory/memory.limit_in_bytes": str(512 * 1024 * 1024),
              "/sys/fs/cgroup/memory.limit_in_bytes": str(1 << 62)}
    monkeypatch.setattr(rag.Path, "read_text", lambda p: values[str(p).replace(chr(92), "/")])
    assert rag._memory_limit_mb() == 512
    values["/sys/fs/cgroup/memory.max"] = str(256 * 1024 * 1024)
    assert rag._memory_limit_mb() == 256


def test_insufficient_memory_does_not_load_model(monkeypatch):
    monkeypatch.delenv("KB_EMBED_MOCK", raising=False)
    monkeypatch.setattr(rag, "_memory_limit_mb", lambda: 512)
    loaded = []
    monkeypatch.setitem(sys.modules, "sentence_transformers", SimpleNamespace(
        SentenceTransformer=lambda *a, **kw: loaded.append(True)))
    e = rag._Embedder("intfloat/multilingual-e5-base", 768)
    with pytest.raises(rag.EmbeddingCapacityError):
        e.encode(["hello"], "query: ")
    assert loaded == [] and not e.capacity()["capacity_ready"]


def test_concurrent_load_and_inference_are_serialized(monkeypatch):
    monkeypatch.delenv("KB_EMBED_MOCK", raising=False)
    monkeypatch.setattr(rag, "_memory_limit_mb", lambda: 2048)
    state = {"loads": 0, "active": 0, "peak": 0}
    lock = threading.Lock()
    start = threading.Barrier(6)

    class Model:
        def __init__(self, *args, **kwargs):
            with lock:
                state["loads"] += 1
            time.sleep(0.03)

        def encode(self, texts, **kwargs):
            assert kwargs["batch_size"] == 1
            with lock:
                state["active"] += 1
                state["peak"] = max(state["peak"], state["active"])
            time.sleep(0.01)
            with lock:
                state["active"] -= 1
            return np.zeros((len(texts), 768), dtype="float32")

    monkeypatch.setitem(sys.modules, "sentence_transformers", SimpleNamespace(SentenceTransformer=Model))
    e = rag._Embedder("intfloat/multilingual-e5-base", 768)
    def encode(i):
        start.wait(timeout=5)
        return e.encode([str(i)], "query: ")
    with ThreadPoolExecutor(max_workers=6) as pool:
        output = list(pool.map(encode, range(6)))
    assert state["loads"] == 1 and state["peak"] == 1
    assert all(x.shape == (1, 768) for x in output)


def test_capacity_error_is_503_and_core_api_survives(monkeypatch):
    from fastapi.testclient import TestClient
    from app import auth, db, assistant
    from app.main import app
    def fail(*args, **kwargs):
        raise rag.EmbeddingCapacityError("test capacity")
    monkeypatch.setattr(assistant, "ask", fail)
    monkeypatch.setattr(db, "latest_assessment", lambda uid: None)
    monkeypatch.setattr(auth, "user_profile", lambda user: {})
    app.dependency_overrides[auth.current_user] = lambda: {"id": -1}
    try:
        client = TestClient(app)
        r = client.post("/api/ask", json={"question": "Test capacity", "history": [], "lang": "id"})
        assert r.status_code == 503 and r.json()["detail"] == "llm_insufficient_memory"
        assert client.get("/api/health").status_code == 200
    finally:
        app.dependency_overrides.pop(auth.current_user, None)
