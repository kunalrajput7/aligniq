"""
Stage 3: Extract items (tasks, decisions, who did what, hats, achievements, blockers).
"""
from __future__ import annotations
import json
import time
from typing import List, Dict, Any, Optional
from .common import _resolve_model, _truncate, ITEMS_MAX_CHARS, call_ollama_cloud


ITEMS_PROMPT = """You are an expert meeting analyst extracting structured, actionable information.

You will receive segment summaries with timeline key points from the entire meeting.
Your task: Extract and structure all actionable items, decisions, contributions, and insights.

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

DETAILED EXTRACTION GUIDELINES:

1. WHO DID WHAT (Contributions):
   - Document significant contributions, presentations, or demonstrations
   - Include what the person accomplished, shared, or contributed
   - Use timestamps from key points or segment IDs for "when"
   - Set confidence based on how explicitly this was stated (0.8-1.0 for explicit, 0.4-0.7 for implicit)

2. TASKS (Action Items):
   - Extract all action items, todos, and commitments
   - Task: Clear, specific description of what needs to be done
   - Owner: Person who mentioned/suggested the task (if different from assignee)
   - Assignee: Person responsible for completing the task
   - Due date: Extract explicit dates mentioned (YYYY-MM-DD format)
   - Status: "assigned", "in-progress", "pending", or null
   - Be thorough - capture even small action items if explicitly mentioned

3. DECISIONS:
   - Document all decisions made during the meeting
   - Decision: Clear statement of what was decided
   - Decider: List all people involved in making the decision
   - Impact: Expected consequences or affected areas (if discussed)
   - Include both major decisions and smaller tactical choices
   - Confidence: 0.8-1.0 for explicit decisions, 0.4-0.7 for implicit agreement

4. SIX THINKING HATS (Cognitive Modes):
   - Classify significant moments by thinking mode:
     * White Hat: Presenting data, facts, figures, objective information
     * Red Hat: Expressing feelings, emotions, gut reactions, intuition
     * Black Hat: Raising concerns, risks, problems, critical analysis
     * Yellow Hat: Highlighting benefits, optimism, positive outcomes
     * Green Hat: Proposing new ideas, creative alternatives, brainstorming
     * Blue Hat: Managing process, organizing discussion, planning next steps
   - Focus on notable moments that exemplify these thinking modes
   - A speaker may wear multiple hats throughout the meeting

5. ACHIEVEMENTS (Wins & Accomplishments):
   - Completed milestones, successful deliveries, approvals received
   - Personal or team accomplishments mentioned
   - Problems solved, goals reached
   - Include context about why this is significant

6. BLOCKERS (Obstacles & Issues):
   - Problems preventing progress
   - Dependencies waiting on others
   - Technical or resource constraints
   - Blocker: Clear description of the obstacle
   - Member: Person/team affected by the blocker
   - Owner: Person/team responsible for resolving it (if mentioned)

QUALITY STANDARDS:
- ONLY extract information explicitly present in the source material
- Be comprehensive - extract all relevant items, don't arbitrarily limit
- Set confidence scores honestly:
  * 0.9-1.0: Explicitly stated with clear evidence
  * 0.7-0.8: Strongly implied with good context
  * 0.5-0.6: Reasonably inferred but not explicit
  * 0.3-0.4: Uncertain inference
- Evidence quotes should be short but meaningful snippets
- If a category has no items, return empty array []
- Preserve exact names, don't normalize or guess spellings

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
