"""
Stage 5: Extract mindmap structure from meeting analysis.
"""
from __future__ import annotations
import json
import asyncio
from typing import List, Dict, Any, Optional
from .common import _resolve_model, _truncate, COLLECTIVE_MAX_CHARS, call_ollama_cloud_async


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
    if len(text) > COLLECTIVE_MAX_CHARS:
        text = _truncate(text, COLLECTIVE_MAX_CHARS)
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

    # Parse center node
    center_node = obj.get("center_node", {})
    if not isinstance(center_node, dict):
        center_node = {"id": "root", "label": "Meeting", "type": "root"}

    # Parse nodes
    nodes = []
    for node in obj.get("nodes", []):
        if isinstance(node, dict):
            nodes.append({
                "id": str(node.get("id", "")).strip(),
                "label": str(node.get("label", "")).strip(),
                "type": str(node.get("type", "topic")).strip(),
                "parent_id": str(node.get("parent_id", "")).strip(),
                "description": str(node.get("description", "")).strip(),
                "timestamp": str(node.get("timestamp", "")).strip() or None,
                "confidence": float(node.get("confidence", 0.8))
            })

    # Parse edges
    edges = []
    for edge in obj.get("edges", []):
        if isinstance(edge, dict):
            edges.append({
                "from": str(edge.get("from", "")).strip(),
                "to": str(edge.get("to", "")).strip(),
                "type": str(edge.get("type", "hierarchy")).strip()
            })

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
