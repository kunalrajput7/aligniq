"""
Stage 3: Extract thinking hats (cognitive modes) for each speaker.
"""
from __future__ import annotations
import json
import asyncio
from typing import List, Dict, Any, Optional
from .common import _resolve_model, _truncate, ITEMS_MAX_CHARS, call_ollama_cloud_async


HATS_PROMPT = """You are an expert meeting analyst extracting cognitive thinking modes using the Six Thinking Hats framework.

You will receive segment summaries with timeline key points from the entire meeting.
Your task: Identify the SINGLE MOST DOMINANT thinking hat for each speaker.

Return STRICT JSON (UTF-8), no markdown code fences.

Schema (exact keys):
{
  "hats": [
    { "speaker":"string", "hat":"white|red|black|yellow|green|blue", "evidence":"1-2 sentence reasoning for why this is their dominant hat", "confidence": 0.0 }
  ]
}

NOTE: Return ONLY ONE hat per speaker (their most dominant thinking hat throughout the meeting)

SIX THINKING HATS EXTRACTION GUIDELINES:
   **CRITICAL**: Determine the SINGLE MOST DOMINANT thinking hat each speaker wore throughout the ENTIRE meeting

   - **Analysis Approach**:
     * Review ALL contributions from each speaker across all segments
     * Identify the PREDOMINANT cognitive mode they displayed most frequently
     * Return ONLY ONE hat per speaker (the most characteristic)
     * Provide a brief reasoning explaining why this hat best describes their overall approach

   - **Hat Definitions**:
     * **White Hat** (Facts & Data): Neutral, objective, presenting data/metrics/reports
       - Indicators: "Here are the metrics", "The data shows", "According to the report"
     * **Red Hat** (Emotions & Intuition): Expressing feelings, gut reactions, concerns
       - Indicators: "I'm concerned about", "I feel like", "This makes me uncomfortable"
     * **Black Hat** (Critical Thinking): Cautious, identifying risks and problems
       - Indicators: "What about the risk of", "This could fail if", "I see a problem with"
     * **Yellow Hat** (Optimism & Benefits): Positive, enthusiastic, seeing opportunities
       - Indicators: "This will improve", "Great idea!", "The benefit is"
     * **Green Hat** (Creativity & Ideas): Creative, proposing alternatives, brainstorming
       - Indicators: "What if we tried", "Another approach", "I have an idea"
     * **Blue Hat** (Process Management): Organizing, facilitating, summarizing
       - Indicators: "Let's move on to", "To summarize", "Next steps are"

   - **Output Format**:
     * speaker: Person's name
     * hat: ONE of [white, red, black, yellow, green, blue]
     * evidence: 1-2 sentence reasoning explaining why this hat best represents their overall thinking style
     * confidence: 0.8-1.0 for clear patterns, 0.6-0.7 for moderate patterns

   - **Important**: Return ONLY ONE hat per unique speaker (their most dominant thinking mode)

QUALITY STANDARDS:
- **ACCURACY**: ONLY extract information explicitly present in the source material
- **COMPLETENESS**: Analyze all speakers in the meeting
- **CONFIDENCE SCORING**:
  * 0.9-1.0: Explicitly stated with clear evidence
  * 0.7-0.8: Strongly implied with solid context
  * 0.6-0.7: Moderate patterns observed
  * DO NOT extract items with confidence < 0.6
- **NAMES**: Preserve exact names as mentioned
- **EMPTY ARRAY**: If no speakers identified, return empty array []

INPUT:
<<<HATS_BUNDLE>>>
"""


def _bundle_segments_for_hats(segment_summaries: List[Dict[str, Any]]) -> str:
    """Bundle segment summaries for hats extraction."""
    parts: List[str] = []
    for seg in segment_summaries:
        seg_id = seg.get("segment_id", "")
        summary = (seg.get("summary") or "").strip()
        kp = seg.get("key_points") or {}

        lines = [f"Segment {seg_id}", f"Summary: {summary}", "Key Points:"]
        if isinstance(kp, dict) and kp:
            items = list(kp.items())[:14]
            for t, p in items:
                lines.append(f"- {t}: {p}")
        parts.append("\n".join(lines))

    text = "\n\n".join(parts)
    if len(text) > ITEMS_MAX_CHARS:
        text = _truncate(text, ITEMS_MAX_CHARS)
    return text


def _build_messages_hats(bundle: str) -> List[Dict[str, str]]:
    """Build messages for hats extraction."""
    return [
        {"role": "system", "content": "You analyze meetings and return strict JSON that validates."},
        {"role": "user", "content": HATS_PROMPT.replace("<<<HATS_BUNDLE>>>", bundle)},
    ]


def _parse_json_hats(s: str) -> Dict[str, Any]:
    """Parse hats extraction JSON response."""
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

    def _list(v): return v if isinstance(v, list) else []
    def _flt(v):
        try: return float(v)
        except: return 0.0

    # Parse hats
    hats = []
    for it in _list(obj.get("hats", [])):
        hats.append({
            "speaker": str(it.get("speaker", "")).strip(),
            "hat": str(it.get("hat", "")).strip().lower(),
            "t": str(it.get("t", "")).strip(),
            "evidence": str(it.get("evidence", "")).strip(),
            "confidence": _flt(it.get("confidence", 0.0))
        })

    return {
        "hats": hats
    }


async def extract_hats_async(
    segment_summaries: List[Dict[str, Any]],
    model: Optional[str] = None,
    max_retries: int = 3,
    sleep_sec: float = 0.8,
) -> Dict[str, Any]:
    """
    Extract thinking hats from segment summaries asynchronously.

    Args:
        segment_summaries: List of segment summary dicts
        model: Model name (optional)
        max_retries: Max retry attempts
        sleep_sec: Sleep between retries

    Returns:
        Dict with hats array
    """
    model = _resolve_model(model)
    if not segment_summaries:
        return {
            "hats": []
        }

    bundle = _bundle_segments_for_hats(segment_summaries)
    messages = _build_messages_hats(bundle)

    for attempt in range(1, max_retries + 1):
        try:
            content = await call_ollama_cloud_async(model, messages, json_mode=True)
            return _parse_json_hats(content)
        except Exception as e:
            if attempt == max_retries:
                return {
                    "hats": [],
                    "error": str(e)
                }
        await asyncio.sleep(sleep_sec)
