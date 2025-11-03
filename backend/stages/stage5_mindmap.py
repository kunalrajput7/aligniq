"""
Stage 5: Extract mindmap structure from meeting analysis.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Dict, List, Optional

from .common import _resolve_model, call_ollama_cloud_async

CONFIDENCE_KEYWORDS = {
    "very high": 0.95,
    "high": 0.9,
    "medium": 0.6,
    "mid": 0.6,
    "moderate": 0.6,
    "low": 0.35,
    "very low": 0.2,
    "uncertain": 0.35,
}


MINDMAP_PROMPT = """You are an expert meeting analyst creating a hierarchical mindmap structure.

You will receive:
1. Chapter summaries (topic clusters)
2. Collective summary with action items, achievements, and blockers

Your task: Create a mindmap that shows the hierarchical relationship between topics, decisions, action items, achievements, and blockers.

Return STRICT JSON (UTF-8), no markdown code fences.

Schema (exact keys):
{
  "center_node": {
    "id": "root",
    "label": "string (meeting title or main theme, <= 8 words)",
    "type": "root"
  },
  "nodes": [
    {
      "id": "string (unique node identifier)",
      "label": "string (node title, <= 10 words)",
      "type": "topic|decision|action|achievement|blocker|concern",
      "parent_id": "string (parent node id)",
      "description": "string (optional 1-2 sentence description)",
      "timestamp": "MM:SS or null",
      "confidence": 0.0-1.0
    }
  ],
  "edges": [
    {
      "from": "string (source node id)",
      "to": "string (target node id)",
      "type": "hierarchy|causes|leads_to|relates_to"
    }
  ]
}

MINDMAP STRUCTURE GUIDELINES:

**ROOT NODE**:
- Create ONE root node representing the entire meeting
- Label should be the meeting's main theme or title (concise, <= 8 words)

**TOPIC NODES (from chapters)**:
- Create a topic node for each major chapter/discussion area
- These connect directly to the root node
- Type: "topic"
- Include chapter title as label

**DECISION NODES**:
- Extract key decisions made during the meeting
- Connect to the relevant topic node
- Type: "decision"
- Include who made the decision if mentioned

**ACTION ITEM NODES**:
- Extract from action_items in collective summary
- Connect to the topic or decision that spawned them
- Type: "action"
- Include owner if available

**ACHIEVEMENT NODES**:
- Extract from achievements in collective summary
- Connect to relevant topic
- Type: "achievement"
- Include who achieved it

**BLOCKER NODES**:
- Extract from blockers in collective summary
- Connect to the topic or decision they're blocking
- Type: "blocker"
- May have edges to action items that resolve them

**CONCERN NODES**:
- Extract concerns, risks, or challenges mentioned
- Type: "concern"
- Connect to relevant topics

**EDGE TYPES**:
- "hierarchy": Parent-child relationships (topic -> subtopic)
- "causes": Causal relationships (blocker causes concern)
- "leads_to": Sequential relationships (decision leads_to action)
- "relates_to": General associations

**QUALITY STANDARDS**:
- Keep the mindmap focused - aim for 10-25 nodes total
- Prioritize the most important topics, decisions, and actions
- Don't create nodes for trivial or redundant information
- Ensure every node (except root) has a parent_id
- Use clear, concise labels (no full sentences)
- Include timestamps when available for timeline context
- Confidence: 0.8-1.0 for explicit items, 0.6-0.7 for inferred

**NODE HIERARCHY EXAMPLE**:
Root (Meeting Theme)
├── Topic 1 (Chapter 1)
│   ├── Decision 1.1
│   │   └── Action 1.1.1
│   └── Blocker 1.2
│       └── Action 1.2.1 (resolves blocker)
├── Topic 2 (Chapter 2)
│   ├── Achievement 2.1
│   └── Concern 2.2
└── Topic 3 (Chapter 3)
    └── Decision 3.1

INPUT:
<<<MINDMAP_BUNDLE>>>
"""


def _clean_string(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text or default


def _coerce_confidence(value: Any, default: float = 0.8) -> float:
    if isinstance(value, (int, float)):
        numeric = float(value)
    elif isinstance(value, str):
        s = value.strip().lower()
        if not s:
            return default
        if s in CONFIDENCE_KEYWORDS:
            return CONFIDENCE_KEYWORDS[s]
        s = s.replace("%", "")
        try:
            numeric = float(s)
        except ValueError:
            return default
    else:
        return default

    if numeric > 1:
        numeric = numeric / 100 if numeric > 100 else min(numeric, 1.0)
    if numeric < 0:
        numeric = 0.0
    return max(0.0, min(numeric, 1.0))


def _format_timestamp_ms(ms: Any) -> str:
    try:
        ms_int = int(float(ms))
    except (TypeError, ValueError):
        return ""

    seconds_total = ms_int // 1000
    seconds = seconds_total % 60
    minutes = (seconds_total // 60) % 60
    hours = seconds_total // 3600
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def _bundle_for_mindmap(
    chapters: List[Dict[str, Any]],
    collective_summary: Dict[str, Any]
) -> str:
    """Bundle chapters and collective summary for mindmap generation."""
    lines: List[str] = []

    # Add chapters
    lines.append("=== CHAPTERS (TOPICS) ===")
    for chapter in chapters:
        chapter_id = chapter.get("chapter_id", "")
        title = chapter.get("title", "")
        summary = chapter.get("summary", "")
        segment_ids = chapter.get("segment_ids", [])

        lines.append(f"\nChapter: {chapter_id}")
        lines.append(f"Title: {title}")
        lines.append(f"Summary: {summary}")
        lines.append(f"Segments: {', '.join(segment_ids)}")

    # Add collective summary items
    lines.append("\n\n=== ACTION ITEMS ===")
    for item in collective_summary.get("action_items", []):
        task = item.get("task", "")
        owner = item.get("owner", "")
        deadline = item.get("deadline", "")
        lines.append(f"- {task} (Owner: {owner}, Deadline: {deadline})")

    lines.append("\n=== ACHIEVEMENTS ===")
    for item in collective_summary.get("achievements", []):
        achievement = item.get("achievement", "")
        member = item.get("member", "")
        evidence = item.get("evidence", [])
        timestamp = evidence[0].get("t", "") if evidence else ""
        lines.append(f"- {achievement} (Member: {member}, Time: {timestamp})")

    lines.append("\n=== BLOCKERS ===")
    for item in collective_summary.get("blockers", []):
        blocker = item.get("blocker", "")
        member = item.get("member", "")
        owner = item.get("owner", "")
        evidence = item.get("evidence", [])
        timestamp = evidence[0].get("t", "") if evidence else ""
        lines.append(f"- {blocker} (Raised by: {member}, Owner: {owner}, Time: {timestamp})")

    text = "\n".join(lines)
    # No truncation needed - modern models have large context windows
    return text


def _build_messages_mindmap(bundle: str) -> List[Dict[str, str]]:
    """Build messages for mindmap generation."""
    return [
        {"role": "system", "content": "You analyze meetings and return strict JSON that validates."},
        {"role": "user", "content": MINDMAP_PROMPT.replace("<<<MINDMAP_BUNDLE>>>", bundle)},
    ]


def _parse_json_mindmap(s: str) -> Dict[str, Any]:
    """Parse mindmap JSON response."""
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

    raw_center = obj.get("center_node", {})
    if not isinstance(raw_center, dict):
        raw_center = {}
    center_node = {
        "id": _clean_string(raw_center.get("id"), "root") or "root",
        "label": _clean_string(raw_center.get("label"), "Meeting") or "Meeting",
        "type": _clean_string(raw_center.get("type"), "root") or "root",
    }

    nodes: List[Dict[str, Any]] = []
    for node in obj.get("nodes", []):
        if not isinstance(node, dict):
            continue
        node_id = _clean_string(node.get("id"))
        label = _clean_string(node.get("label"))
        if not node_id or not label:
            continue
        node_type = _clean_string(node.get("type"), "topic") or "topic"
        parent_id = _clean_string(node.get("parent_id"), "root") or "root"
        description = _clean_string(node.get("description"))
        timestamp_raw = node.get("timestamp")
        if not timestamp_raw and node.get("timestamp_ms") is not None:
            timestamp_raw = _format_timestamp_ms(node.get("timestamp_ms"))
        timestamp = _clean_string(timestamp_raw)
        timestamp_value = timestamp or None
        confidence = _coerce_confidence(node.get("confidence"), default=0.8)

        nodes.append(
            {
                "id": node_id,
                "label": label,
                "type": node_type,
                "parent_id": parent_id,
                "description": description,
                "timestamp": timestamp_value,
                "confidence": confidence,
            }
        )

    edges: List[Dict[str, Any]] = []
    for edge in obj.get("edges", []):
        if not isinstance(edge, dict):
            continue
        source = _clean_string(edge.get("from"))
        target = _clean_string(edge.get("to"))
        if not source or not target:
            continue
        edge_type = _clean_string(edge.get("type"), "hierarchy") or "hierarchy"
        edges.append(
            {
                "from": source,
                "to": target,
                "type": edge_type,
            }
        )

    return {
        "center_node": center_node,
        "nodes": nodes,
        "edges": edges
    }


async def build_mindmap_async(
    chapters: List[Dict[str, Any]],
    collective_summary: Dict[str, Any],
    model: Optional[str] = None,
    max_retries: int = 3,
    sleep_sec: float = 0.8,
) -> Dict[str, Any]:
    """
    Build mindmap structure from chapters and collective summary asynchronously.

    Args:
        chapters: List of chapter dicts
        collective_summary: Collective summary dict with action_items, achievements, blockers
        model: Model name (optional)
        max_retries: Max retry attempts
        sleep_sec: Sleep between retries

    Returns:
        Dict with center_node, nodes, edges
    """
    model = _resolve_model(model)

    if not chapters and not collective_summary:
        return {
            "center_node": {"id": "root", "label": "Meeting", "type": "root"},
            "nodes": [],
            "edges": []
        }

    bundle = _bundle_for_mindmap(chapters, collective_summary)
    messages = _build_messages_mindmap(bundle)

    for attempt in range(1, max_retries + 1):
        try:
            content = await call_ollama_cloud_async(model, messages, json_mode=True)
            return _parse_json_mindmap(content)
        except Exception as e:
            if attempt == max_retries:
                return {
                    "center_node": {"id": "root", "label": "Meeting", "type": "root"},
                    "nodes": [],
                    "edges": [],
                    "error": str(e)
                }
        await asyncio.sleep(sleep_sec)
