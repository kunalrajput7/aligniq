"""
Common utilities shared across all stages.
"""
from __future__ import annotations
import os
import time
from typing import List, Dict, Optional
from ollama import Client, ResponseError


# ---------- Defaults / Tunables ----------
DEFAULT_MODEL = os.getenv("SEGMENTS_LLM_MODEL", "gpt-oss:120b-cloud")
MAX_CHARS = int(os.getenv("SEGMENTS_MAX_CHARS", "14000"))
COLLECTIVE_MAX_CHARS = int(os.getenv("SEGMENTS_COLLECTIVE_MAX_CHARS", "16000"))
ITEMS_MAX_CHARS = int(os.getenv("SEGMENTS_ITEMS_MAX_CHARS", "16000"))
CHAPTERS_MAX_CHARS = int(os.getenv("SEGMENTS_CHAPTERS_MAX_CHARS", "20000"))

BAD_MODEL_LITERALS = {"string", "model", ""}


def _fmt_local(ms: int) -> str:
    """Format milliseconds to HH:MM:SS.mmm"""
    s, ms = divmod(int(ms), 1000)
    m, s = divmod(s, 60)
    h, m = divmod(m, 60)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def _truncate(text: str, limit: int) -> str:
    """Truncate text to limit, keeping beginning and end."""
    if len(text) <= limit:
        return text
    half = limit // 2
    return text[:half] + "\n...\n" + text[-half:]


def _resolve_model(model: Optional[str]) -> str:
    """Resolve model name, fallback to default."""
    if model is None:
        return DEFAULT_MODEL
    m = model.strip().lower()
    if m in BAD_MODEL_LITERALS:
        return DEFAULT_MODEL
    return model


def _ollama_client() -> Client:
    """Create Ollama client with API key."""
    api_key = os.getenv("OLLAMA_API_KEY")
    if not api_key:
        raise RuntimeError("OLLAMA_API_KEY is not set")
    return Client(host="https://ollama.com", headers={'Authorization': 'Bearer ' + api_key})


def call_ollama_cloud(
    model: str,
    messages: List[Dict[str, str]],
    json_mode: bool = True
) -> str:
    """
    Call Ollama Cloud API and return response content.

    Args:
        model: Model name
        messages: List of message dicts with 'role' and 'content'
        json_mode: Whether to use JSON output format

    Returns:
        Response content string
    """
    client = _ollama_client()
    try:
        resp = client.chat(
            model,
            messages=messages,
            stream=False,
            format=("json" if json_mode else None),
            options={"temperature": 0.1}
        )
        return resp.get("message", {}).get("content", "") or "{}"
    except ResponseError as re:
        msg = getattr(re, "message", None) or str(re)
        raise RuntimeError(f"Ollama Cloud error: {msg}")
    except Exception as e:
        raise RuntimeError(f"Ollama Cloud unexpected error: {e}")
