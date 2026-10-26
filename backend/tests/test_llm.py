"""Model fallback: a rate limit moves one request to the next model; the next request starts from the locked model again."""
from app import llm


def test_rate_limit_switch_is_per_request(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "x")
    monkeypatch.delenv("LLM_MOCK", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.setattr(llm, "available_models", lambda: ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"])
    monkeypatch.setattr(llm, "_fallback", {})
    calls = []

    def fake(system, user, mock=None, schema=None, exact=False):
        model = llm.config()["model"]
        calls.append(model)
        if model == "openai/gpt-oss-120b" and len(calls) == 1:
            raise llm.LLMError("rate_limited")
        return {"answer": "ok"}, model

    monkeypatch.setattr(llm, "_chat_json", fake)
    assert llm.chat_json("s", "u")[1] == "qwen/qwen3.8-27b"          # first request: limited -> backup model
    assert llm.chat_json("s", "u")[1] == "openai/gpt-oss-120b"       # next request: locked model again
    assert calls == ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-120b"]
