"""
Stage 3: Extract items (tasks, decisions, who did what, hats, achievements, blockers).
"""
from __future__ import annotations
import json
import time
from typing import List, Dict, Any, Optional
from .common import _resolve_model, _truncate, ITEMS_MAX_CHARS, call_ollama_cloud


ITEMS_PROMPT = """You are a meeting analyst.

You will receive PER-SEGMENT SUMMARIES (Stage-1) with sparse timeline key points.
Extract the following for the ENTIRE meeting.

Return STRICT JSON (UTF-8), no markdown code fences.

Schema (exact keys):
{
  "who_did_what": [
    { "actor": "string", "what": "string", "when": "seg-XXXX or MM:SS or ''", "evidence": [{"t":"MM:SS","quote":"short"}], "confidence": 0.0 }
  ],
  "tasks": [
    { "task": "string", "owner": "string or null", "assignee": "string or null", "due_date": "YYYY-MM-DD or null", "status": "string or null", "evidence": [{"t":"MM:SS","quote":"short"}], "confidence": 0.0 }
  ],
  "decisions": [
    { "decision": "string", "decider": ["string"], "impact": "string or null", "evidence": [{"t":"MM:SS","quote":"short"}], "confidence": 0.0 }
  ],
  "hats": [
    { "speaker":"string", "hat":"white|red|black|yellow|green|blue", "t":"MM:SS or ''", "evidence":"short reason" }
  ],
  "achievements": [
    { "member": "string", "achievement": "string", "evidence": [{"t":"MM:SS","quote":"short"}], "confidence": 0.0 }
  ],
  "blockers": [
    { "member": "string", "blocker": "string", "owner": "string or null", "evidence": [{"t":"MM:SS","quote":"short"}], "confidence": 0.0 }
  ]
}

Guidelines:
- Use only facts in the provided inputs. If uncertain, set confidence ≤ 0.5.
- Prefer using segment ids (seg-XXXX) or provided MM:SS from key points for "when".
- Hats: classify moments by the Six Thinking Hats. It's okay if multiple hats appear per speaker.
  * White Hat: data, facts, information
  * Red Hat: emotions, feelings, intuition
  * Black Hat: caution, difficulties, critical thinking
  * Yellow Hat: positivity, benefits, optimism
  * Green Hat: creativity, alternatives, new ideas
  * Blue Hat: process, control, organization, planning
- Achievements: concrete outcomes reached in or before this meeting (wins, deliveries, approvals).
- Blockers: obstacles impeding progress; owner is the person/group responsible to remove it, if mentioned.
- Evidence snippets should be short, directly traceable to the inputs.
- If a list is empty, return [] for that list.

INPUT:
<<<ITEMS_BUNDLE>>>
"""


def _bundle_segments_for_items(segment_summaries: List[Dict[str, Any]]) -> str:
    """Bundle segment summaries for items extraction."""
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


def _build_messages_items(bundle: str) -> List[Dict[str, str]]:
    """Build messages for items extraction."""
    return [
        {"role": "system", "content": "You analyze meetings and return strict JSON that validates."},
        {"role": "user", "content": ITEMS_PROMPT.replace("<<<ITEMS_BUNDLE>>>", bundle)},
    ]


def _parse_json_items(s: str) -> Dict[str, Any]:
    """Parse items JSON response."""
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

    # Parse who_did_what
    who = []
    for it in _list(obj.get("who_did_what", [])):
        who.append({
            "actor": str(it.get("actor", "")).strip(),
            "what": str(it.get("what", "")).strip(),
            "when": str(it.get("when", "")).strip(),
            "evidence": it.get("evidence", []) or [],
            "confidence": _flt(it.get("confidence", 0.0))
        })

    # Parse tasks
    tasks = []
    for it in _list(obj.get("tasks", [])):
        tasks.append({
            "task": str(it.get("task", "")).strip(),
            "owner": (str(it.get("owner")) if it.get("owner") not in [None, ""] else None),
            "assignee": (str(it.get("assignee")) if it.get("assignee") not in [None, ""] else None),
            "due_date": (str(it.get("due_date")) if it.get("due_date") not in [None, ""] else None),
            "status": (str(it.get("status")) if it.get("status") not in [None, ""] else None),
            "evidence": it.get("evidence", []) or [],
            "confidence": _flt(it.get("confidence", 0.0))
        })

    # Parse decisions
    decisions = []
    for it in _list(obj.get("decisions", [])):
        decider = it.get("decider", [])
        if not isinstance(decider, list):
            decider = [str(decider)]
        decisions.append({
            "decision": str(it.get("decision", "")).strip(),
            "decider": [str(x).strip() for x in decider if str(x).strip()],
            "impact": (str(it.get("impact")) if it.get("impact") not in [None, ""] else None),
            "evidence": it.get("evidence", []) or [],
            "confidence": _flt(it.get("confidence", 0.0))
        })

    # Parse hats
    hats = []
    for it in _list(obj.get("hats", [])):
        hats.append({
            "speaker": str(it.get("speaker", "")).strip(),
            "hat": str(it.get("hat", "")).strip().lower(),
            "t": str(it.get("t", "")).strip(),
            "evidence": str(it.get("evidence", "")).strip()
        })

    # Parse achievements
    achievements = []
    for it in _list(obj.get("achievements", [])):
        achievements.append({
            "member": str(it.get("member", "")).strip(),
            "achievement": str(it.get("achievement", "")).strip(),
            "evidence": it.get("evidence", []) or [],
            "confidence": _flt(it.get("confidence", 0.0))
        })

    # Parse blockers
    blockers = []
    for it in _list(obj.get("blockers", [])):
        blockers.append({
            "member": str(it.get("member", "")).strip(),
            "blocker": str(it.get("blocker", "")).strip(),
            "owner": (str(it.get("owner")) if it.get("owner") not in [None, ""] else None),
            "evidence": it.get("evidence", []) or [],
            "confidence": _flt(it.get("confidence", 0.0))
        })

    return {
        "who_did_what": who,
        "tasks": tasks,
        "decisions": decisions,
        "hats": hats,
        "achievements": achievements,
        "blockers": blockers,
    }


def extract_items(
    segment_summaries: List[Dict[str, Any]],
    model: Optional[str] = None,
    max_retries: int = 3,
    sleep_sec: float = 0.8,
) -> Dict[str, Any]:
    """
    Extract items from segment summaries.

    Args:
        segment_summaries: List of segment summary dicts
        model: Model name (optional)
        max_retries: Max retry attempts
        sleep_sec: Sleep between retries

    Returns:
        Dict with who_did_what, tasks, decisions, hats, achievements, blockers
    """
    model = _resolve_model(model)
    if not segment_summaries:
        return {
            "who_did_what": [],
            "tasks": [],
            "decisions": [],
            "hats": [],
            "achievements": [],
            "blockers": []
        }

    bundle = _bundle_segments_for_items(segment_summaries)
    messages = _build_messages_items(bundle)

    for attempt in range(1, max_retries + 1):
        try:
            content = call_ollama_cloud(model, messages, json_mode=True)
            return _parse_json_items(content)
        except Exception as e:
            if attempt == max_retries:
                return {
                    "who_did_what": [],
                    "tasks": [],
                    "decisions": [],
                    "hats": [],
                    "achievements": [],
                    "blockers": [],
                    "error": str(e)
                }
        time.sleep(sleep_sec)
