"""LLM client (REST, no SDK) for Groq or Gemini — same providers as notebook Tahap 12.

Configure in backend/.env (never commit it):
    LLM_PROVIDER=groq            # or gemini
    GROQ_API_KEY=...             # when provider = groq
    GEMINI_API_KEY=...           # when provider = gemini
    LLM_MODEL=                   # optional; defaults below
    LLM_MOCK=1                   # optional: fake answers for offline testing

The LLM never ranks careers. It only writes text from the data it is given (the
scores and gaps computed by scoring.py) and, in RAG mode, the retrieved knowledge-base
passages (rag.py).

exact=True reproduces the Tahap 12 call: seed 42, temperature 0, JSON mode, the JSON schema appended to
the system prompt (Groq), and no reasoning_effort override. Used for the career explanation.
"""
import json
import os
import time

import httpx

DEFAULT_MODEL = {"groq": "openai/gpt-oss-120b", "gemini": "gemini-3.8-flash"}
# preference order when the configured model is not available for the key (same list as notebook Tahap 12).
# Groq free-tier limits are per model, so a rate-limited request also moves to the next model in this list.
PREFERRED = {"groq": ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct", "qwen/qwen3.8-27b",
                      "openai/gpt-oss-20b"],
             "gemini": ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-flash-latest"]}
_fallback: dict[str, str] = {}          # provider -> model chosen automatically after "model not found" / rate limit


class LLMError(Exception):
    """code: not_configured | rate_limited | unavailable | bad_output | too_large | model_not_found | json_mode"""
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def config() -> dict:
    provider = os.environ.get("LLM_PROVIDER", "groq").strip().lower()
    key = os.environ.get("GROQ_API_KEY" if provider == "groq" else "GEMINI_API_KEY", "").strip()
    model = _fallback.get(provider) or os.environ.get("LLM_MODEL", "").strip() or DEFAULT_MODEL.get(provider, "")
    mock = os.environ.get("LLM_MOCK", "") == "1"
    return {"provider": provider, "model": model, "has_key": bool(key), "mock": mock, "_key": key}


def status(check: bool = False) -> dict:
    c = config()
    out = {"provider": c["provider"], "model": c["model"], "ready": c["mock"] or c["has_key"], "mock": c["mock"]}
    if check:                                   # /api/llm/status?check=1 lists the models the key can use
        out["available_models"] = available_models()
        out["model_available"] = c["model"] in out["available_models"]
    return out


def _log(msg: str):
    """Short diagnostic line in the backend terminal (never contains the API key)."""
    print(f"[LLM] {msg}", flush=True)


def _post(url, headers, body):
    for attempt in range(3):
        try:
            r = httpx.post(url, headers=headers, json=body, timeout=120)
        except httpx.HTTPError as e:
            _log(f"network error: {type(e).__name__}: {e}")
            raise LLMError("unavailable")
        if r.status_code < 400:
            return r.json()
        _log(f"HTTP {r.status_code} from provider: {r.text[:400]}")
        if r.status_code == 429:
            if attempt < 1:                     # one short retry, then chat_json() moves to the next model
                time.sleep(3)
                continue
            raise LLMError("rate_limited")
        if r.status_code in (401, 403):
            raise LLMError("not_configured")
        if r.status_code == 413:
            raise LLMError("too_large")
        if r.status_code == 400 and ("json_validate_failed" in r.text or "response_format" in r.text):
            raise LLMError("json_mode")
        if r.status_code == 404:
            raise LLMError("model_not_found")
        raise LLMError("unavailable")
    raise LLMError("unavailable")


def available_models() -> list[str]:
    """Models this API key can use (asked from the provider)."""
    c = config()
    if not c["has_key"]:
        return []
    try:
        if c["provider"] == "groq":
            r = httpx.get("https://api.groq.com/openai/v1/models", headers={"Authorization": f"Bearer {c['_key']}"}, timeout=30)
            return sorted(m["id"] for m in r.json().get("data", []))
        r = httpx.get("https://generativelanguage.googleapis.com/v1beta/models", headers={"x-goog-api-key": c["_key"]}, timeout=30)
        return sorted(m["name"].split("/")[-1] for m in r.json().get("models", [])
                      if "generateContent" in m.get("supportedGenerationMethods", []))
    except (httpx.HTTPError, ValueError, KeyError):
        return []


def _pick_fallback(reason: str, tried: set) -> bool:
    c = config()
    avail = available_models()
    if reason == "model_not_found":
        _log(f"model '{c['model']}' not available. Models for this key: {', '.join(avail[:30]) or '(none / key invalid)'}")
    else:
        _log(f"model '{c['model']}' reached the provider rate limit.")
    choice = next((m for m in PREFERRED.get(c["provider"], []) if m in avail and m not in tried), None)
    if choice:
        _fallback[c["provider"]] = choice
        tip = f" Put LLM_MODEL={choice} in backend/.env to make it permanent." if reason == "model_not_found" else ""
        _log(f"switching to '{choice}'.{tip}")
        return True
    return False


SEED = 42      # same seed as notebook Tahap 12


def chat_json(system: str, user: str, mock: dict | None = None, schema: dict | None = None,
              exact: bool = False) -> tuple[dict, str]:
    # A "model not found" switch is kept. A rate-limit switch lasts for this request only, so the next request
    # tries the locked model (gpt-oss-120b, Tahap 12/14) again; the model actually used is returned and saved.
    provider = config()["provider"]
    keep = _fallback.get(provider)
    tried = set()
    try:
        while True:
            try:
                return _chat_json(system, user, mock, schema, exact)
            except LLMError as e:
                if e.code not in ("model_not_found", "rate_limited"):
                    raise
                tried.add(config()["model"])
                if not _pick_fallback(e.code, tried):
                    raise
                if e.code == "model_not_found":
                    keep = _fallback[provider]
    finally:
        if keep:
            _fallback[provider] = keep
        else:
            _fallback.pop(provider, None)


def _chat_json(system: str, user: str, mock: dict | None = None, schema: dict | None = None,
               exact: bool = False) -> tuple[dict, str]:
    """Returns (parsed JSON object, model id). Temperature 0 for reproducibility."""
    c = config()
    if c["mock"]:
        return (mock or {}), "mock"
    if not c["has_key"]:
        raise LLMError("not_configured")
    if schema is not None:                            # as in the notebook: schema written in the instruction, then validated
        system = system + " Reply with one JSON object that follows this JSON schema: " + json.dumps(schema)
    if c["provider"] == "groq":
        body = {"model": c["model"], "temperature": 0, "response_format": {"type": "json_object"},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        if exact:
            body["seed"] = SEED
        elif c["model"].startswith("openai/gpt-oss"):
            body["reasoning_effort"] = "low"          # chat only: faster answers, fewer tokens
        try:
            data = _post("https://api.groq.com/openai/v1/chat/completions", {"Authorization": f"Bearer {c['_key']}"}, body)
        except LLMError as e:
            if e.code != "json_mode":
                raise
            body.pop("response_format")               # retry once without strict JSON mode; parsed below
            data = _post("https://api.groq.com/openai/v1/chat/completions", {"Authorization": f"Bearer {c['_key']}"}, body)
        text = data["choices"][0]["message"]["content"] or ""
    elif c["provider"] == "gemini":
        data = _post(f"https://generativelanguage.googleapis.com/v1beta/models/{c['model']}:generateContent",
                     {"x-goog-api-key": c["_key"]},
                     {"systemInstruction": {"parts": [{"text": system}]},
                      "contents": [{"role": "user", "parts": [{"text": user}]}],
                      "generationConfig": {"temperature": 0, "responseMimeType": "application/json",
                                           **({"seed": SEED} if exact else {})}})
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise LLMError("bad_output")
    else:
        raise LLMError("not_configured")
    try:
        out = json.loads(text)
    except json.JSONDecodeError:
        _log(f"answer was not pure JSON, trying to extract it: {text[:200]!r}")
        s, e = text.find("{"), text.rfind("}")
        try:
            out = json.loads(text[s:e + 1])
        except (ValueError, json.JSONDecodeError):
            raise LLMError("bad_output")
    if not isinstance(out, dict) or (schema and not all(k in out for k in schema.get("required", []))):
        raise LLMError("bad_output")
    return out, c["model"]
