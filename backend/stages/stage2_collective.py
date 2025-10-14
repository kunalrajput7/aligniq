"""
Stage 2: Create collective summary from all segment summaries.
"""
from __future__ import annotations
import json
import time
from typing import List, Dict, Any, Optional
from .common import _resolve_model, _truncate, COLLECTIVE_MAX_CHARS, call_ollama_cloud


COLLECTIVE_PROMPT = """You are an expert meeting analyst creating an executive summary of the entire meeting.

You will receive segment summaries and timeline key points from throughout the meeting.
Your task: Synthesize these into ONE comprehensive, executive-level summary.

Return STRICT JSON (UTF-8), no markdown code fences.

Schema (exact keys):
{
  "collective_summary": "<comprehensive meeting summary>"
}

SUMMARY STRUCTURE & GUIDELINES:

1. OPENING CONTEXT (1-2 paragraphs):
   - What was the meeting about and what were the main goals?
   - Who were the key participants and their roles (if mentioned)?
   - Set the stage for the discussion

2. MAIN DISCUSSION POINTS (organized thematically):
   - Group related topics together, even if discussed across different segments
   - For each major topic, include: what was discussed, who contributed, what was decided
   - Preserve the logical flow and evolution of ideas
   - Include important technical details, numbers, dates, and specific commitments
   - Highlight any disagreements, concerns, or alternative viewpoints raised

3. DECISIONS & ACTION ITEMS:
   - Clearly state what decisions were made and by whom
   - List action items with owners and deadlines (if mentioned)
   - Note any pending decisions or follow-ups needed

4. CONCERNS & BLOCKERS:
   - Surface any risks, blockers, or challenges discussed
   - Include proposed solutions or mitigation strategies

5. OUTCOMES & NEXT STEPS:
   - Summarize what was accomplished in the meeting
   - State clear next steps and expectations

QUALITY STANDARDS:
- Write in clear, professional language suitable for stakeholders who weren't present
- Synthesize information intelligently - avoid simply concatenating segment summaries
- Show connections between related points discussed at different times
- Maintain factual accuracy - never invent details not in the source material
- Use proper paragraphs and structure with section headings where helpful
- Be comprehensive but avoid unnecessary repetition
- Focus on "what matters" - decisions, commitments, problems, and solutions

INPUT:
<<<MEETING_BUNDLE>>>
"""


def _bundle_segments_for_collective(segment_summaries: List[Dict[str, Any]]) -> str:
    """Bundle segment summaries into a single text."""
    parts: List[str] = []
    for seg in segment_summaries:
        seg_id = seg.get("segment_id", "")
        summary = (seg.get("summary") or "").strip()
        kp = seg.get("key_points") or {}

        lines = [f"Segment {seg_id}", f"Summary: {summary}", "Key Points:"]
        if isinstance(kp, dict) and kp:
            items = list(kp.items())[:12]
            for t, p in items:
                lines.append(f"- {t}: {p}")
        parts.append("\n".join(lines))

    text = "\n\n".join(parts)
    if len(text) > COLLECTIVE_MAX_CHARS:
        text = _truncate(text, COLLECTIVE_MAX_CHARS)
    return text


def _build_messages_collective(meeting_bundle: str) -> List[Dict[str, str]]:
    """Build messages for collective summary."""
    return [
        {"role": "system", "content": "You analyze meetings and return strict JSON that validates."},
        {"role": "user", "content": COLLECTIVE_PROMPT.replace("<<<MEETING_BUNDLE>>>", meeting_bundle)},
    ]


def _parse_json_collective(s: str) -> Dict[str, Any]:
    """Parse collective summary JSON response."""
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
    return {"collective_summary": str(obj.get("collective_summary", "")).strip()}


def summarize_collective(
    segment_summaries: List[Dict[str, Any]],
    model: Optional[str] = None,
    max_retries: int = 3,
    sleep_sec: float = 0.8,
) -> Dict[str, Any]:
    """
    Create collective summary from segment summaries.

    Args:
        segment_summaries: List of segment summary dicts
        model: Model name (optional)
        max_retries: Max retry attempts
        sleep_sec: Sleep between retries

    Returns:
        Dict with collective_summary
    """
    model = _resolve_model(model)
    if not segment_summaries:
        return {"collective_summary": ""}

    bundle = _bundle_segments_for_collective(segment_summaries)
    messages = _build_messages_collective(bundle)

    for attempt in range(1, max_retries + 1):
        try:
            content = call_ollama_cloud(model, messages, json_mode=True)
            return _parse_json_collective(content)
        except Exception as e:
            if attempt == max_retries:
                return {"collective_summary": "", "error": str(e)}
        time.sleep(sleep_sec)
