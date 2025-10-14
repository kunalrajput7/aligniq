"""
Stage 1: Summarize individual segments with key points.
"""
from __future__ import annotations
import json
import time
from typing import List, Dict, Any, Optional
from .common import _resolve_model, _truncate, MAX_CHARS, call_ollama_cloud


# Types
Segment = Dict[str, object]


SUMMARY_PROMPT_STAGE1 = """You are an expert meeting analyst specializing in creating actionable meeting summaries.

Your task is to analyze this 10-minute transcript segment and produce:
1. A COMPREHENSIVE SUMMARY capturing all key discussions, decisions, and context
2. TIMELINE KEY POINTS for visual timeline representation

Return STRICT JSON (UTF-8), no markdown code fences.

Schema (exact keys):
{
  "segment_id": "seg-XXXX",
  "summary": "<detailed narrative with full context>",
  "key_points": { "MM:SS": "concise, impactful point", "...": "..." }
}

Transcript (local time | speaker | sentence):
<<<SEGMENT_TEXT>>>

SUMMARY GUIDELINES:
- Write a detailed, flowing narrative that captures the full context and nuance
- Include WHO said or did WHAT, and WHY when mentioned
- Highlight key decisions, action items, concerns, and blockers
- Preserve important technical details, numbers, and specific terminology
- Connect related points to show the flow of discussion
- Use clear paragraphs to organize different topics discussed in this segment
- DO NOT invent information not present in the transcript
- Aim for clarity and completeness over brevity

KEY POINTS GUIDELINES:
- Select 3-8 most significant moments that would be useful as timeline markers
- Each key point should be impactful, specific, and self-contained
- Prefer: decisions made, action items assigned, problems raised, achievements mentioned
- Use exact MM:SS timestamps from the transcript
- Keep each point concise (1 sentence max) but meaningful
- If no significant events occurred, return empty object for key_points
"""


def _build_messages_stage1(segment_id: str, segment_text: str) -> List[Dict[str, str]]:
    """Build messages for stage 1 summarization."""
    return [
        {"role": "system", "content": "You analyze meetings and return strict JSON that validates."},
        {
            "role": "user",
            "content": SUMMARY_PROMPT_STAGE1
                .replace("<<<SEGMENT_TEXT>>>", segment_text)
                .replace("seg-XXXX", segment_id)
        },
    ]


def _parse_json_stage1(s: str) -> Dict[str, Any]:
    """Parse stage 1 JSON response."""
    s = s.strip()
    if s.startswith("```"):
        s = s.strip("`")
        s = s[s.find("\n")+1:] if "\n" in s else s
    first = s.find("{")
    last = s.rfind("}")
    if first != -1 and last != -1 and last > first:
        s = s[first:last+1]
    try:
        obj = json.loads(s)
    except Exception:
        obj = {}

    segment_id = str(obj.get("segment_id", "")).strip()
    summary = str(obj.get("summary", "")).strip()
    key_points = obj.get("key_points") or {}
    if not isinstance(key_points, dict):
        key_points = {}
    key_points = {str(k): str(v) for k, v in key_points.items()}

    return {
        "segment_id": segment_id,
        "summary": summary,
        "key_points": key_points
    }


def summarize_segments(
    segments: List[Segment],
    model: Optional[str] = None,
    max_retries: int = 3,
    sleep_sec: float = 0.8
) -> List[Dict[str, Any]]:
    """
    Summarize each segment individually.

    Args:
        segments: List of segment dicts with 'text' field
        model: Model name (optional)
        max_retries: Max retry attempts
        sleep_sec: Sleep between retries

    Returns:
        List of dicts with segment_id, summary, key_points
    """
    model = _resolve_model(model)
    out: List[Dict[str, Any]] = []

    for seg in segments:
        raw_text = str(seg.get("text") or "").strip()
        if not raw_text:
            out.append({
                "segment_id": seg["id"],
                "summary": "",
                "key_points": {}
            })
            continue

        # Truncate if needed
        segment_text = _truncate(raw_text, MAX_CHARS)
        messages = _build_messages_stage1(seg["id"], segment_text)

        for attempt in range(1, max_retries + 1):
            try:
                content = call_ollama_cloud(model, messages, json_mode=True)
                result = _parse_json_stage1(content)
                if not result.get("segment_id"):
                    result["segment_id"] = seg["id"]
                out.append(result)
                break
            except Exception as e:
                if attempt == max_retries:
                    out.append({
                        "segment_id": seg["id"],
                        "summary": "",
                        "key_points": {},
                        "error": str(e)
                    })
                time.sleep(sleep_sec)

    return out
