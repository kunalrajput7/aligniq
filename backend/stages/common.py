"""
Common utilities shared across all stages.
"""
from __future__ import annotations
import os
import time
from typing import List, Dict, Optional
import httpx


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


async def call_ollama_cloud_async(
    model: str,
    messages: List[Dict[str, str]],
    json_mode: bool = True
) -> str:
    """
    Call Ollama Cloud API asynchronously and return response content.

    Args:
        model: Model name
        messages: List of message dicts with 'role' and 'content'
        json_mode: Whether to use JSON output format

    Returns:
        Response content string
    """
    api_key = os.getenv("OLLAMA_API_KEY")
    if not api_key:
        raise RuntimeError("OLLAMA_API_KEY is not set")

    url = "https://ollama.com/api/chat"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": 0.1}
    }

    if json_mode:
        payload["format"] = "json"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("message", {}).get("content", "") or "{}"
    except httpx.HTTPStatusError as e:
        raise RuntimeError(f"Ollama Cloud HTTP error: {e.response.status_code} - {e.response.text}")
    except httpx.RequestError as e:
        raise RuntimeError(f"Ollama Cloud request error: {str(e)}")
    except Exception as e:
        raise RuntimeError(f"Ollama Cloud unexpected error: {e}")
