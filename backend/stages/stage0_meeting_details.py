"""
Stage 0: Extract meeting details (title, date, duration, participants).
"""
from __future__ import annotations
import json
import time
from datetime import datetime
from typing import List, Dict, Any, Optional
from .common import _resolve_model, _fmt_local, call_ollama_cloud


# Types
Utterance = Dict[str, object]
Segment = Dict[str, object]


MEETING_DETAILS_PROMPT = """You are a meeting analyst.
Given partial transcript context and known participant names, infer:
- a concise meeting title (<= 8 words) that best describes the purpose/theme
- the meeting date, only if explicitly present in text (ISO YYYY-MM-DD), else null

Return STRICT JSON (UTF-8), no markdown.

Schema (exact keys):
{
  "title": "string (<= 8 words)",
  "date": "YYYY-MM-DD or null"
}

CONTEXT:
Participants: <<<PARTICIPANTS>>>

Excerpt:
<<<EXCERPT>>>

Rules:
- Do NOT fabricate a date. Only return a date if the transcript explicitly mentions one.
- Title should be human-friendly, not a list of buzzwords.
"""


def _excerpt_from_utterances(utterances: List[Utterance], max_chars: int = 2000) -> str:
    """Extract excerpt from first ~80 utterances."""
    lines = []
    for u in utterances[:80]:
        lines.append(f'{_fmt_local(int(u["start_ms"]))} | {u["speaker"]} | {u["text"]}')
    text = "\n".join(lines)
    return text[:max_chars]


def _parse_details(s: str) -> Dict[str, Any]:
    """Parse LLM response for meeting details."""
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

    title = str(obj.get("title", "")).strip()
    date = obj.get("date", None)
    if isinstance(date, str):
        date = date.strip() or None
    else:
        date = None

    # Cap title to ~8 words
    if title:
        words = title.split()
        if len(words) > 8:
            title = " ".join(words[:8])

    return {"title": title, "date": date}


def infer_meeting_details(
    utterances: List[Utterance],
    model: Optional[str] = None,
    max_retries: int = 3,
    sleep_sec: float = 0.8
) -> Dict[str, Any]:
    """
    Infer meeting details from utterances.

    Returns:
        {
            "title": str,
            "date": "YYYY-MM-DD" | None,
            "duration_ms": int,
            "participants": [str],
            "unknown_count": int
        }
    """
    # Deterministic bits
    duration_ms = int(utterances[-1]["end_ms"]) if utterances else 0
    speakers = [str(u.get("speaker", "")).strip() for u in utterances]
    participants = sorted({s for s in speakers if s and s != "Speaker ?"})
    unknown_count = sum(1 for s in speakers if s == "Speaker ?")

    # LLM inference
    model = _resolve_model(model)
    excerpt = _excerpt_from_utterances(utterances)
    participants_str = ", ".join(participants) if participants else "(none)"

    prompt = MEETING_DETAILS_PROMPT \
        .replace("<<<PARTICIPANTS>>>", participants_str) \
        .replace("<<<EXCERPT>>>", excerpt)

    messages = [
        {"role": "system", "content": "You analyze meetings and return strict JSON that validates."},
        {"role": "user", "content": prompt},
    ]

    details = {"title": "", "date": None}
    for attempt in range(1, max_retries + 1):
        try:
            content = call_ollama_cloud(model, messages, json_mode=True)
            details = _parse_details(content)
            break
        except Exception:
            if attempt == max_retries:
                details = {"title": "", "date": None}
        time.sleep(sleep_sec)

    # Use today's date if no date found
    meeting_date = details["date"] if details["date"] else datetime.now().strftime("%Y-%m-%d")

    return {
        "title": details["title"],
        "date": meeting_date,
        "duration_ms": duration_ms,
        "participants": participants,
        "unknown_count": unknown_count
    }
