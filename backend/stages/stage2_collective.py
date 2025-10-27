"""
Stage 2: Create collective summary from all segment summaries with structured extraction.
"""
from __future__ import annotations
import json
import time
from typing import List, Dict, Any, Optional
from .common import _resolve_model, _truncate, COLLECTIVE_MAX_CHARS, call_ollama_cloud


COLLECTIVE_PROMPT = """You are an expert meeting analyst creating an executive summary of the entire meeting.

You will receive segment summaries and timeline key points from throughout the meeting.
Your task: Synthesize these into ONE comprehensive analysis with structured extraction.

Return STRICT JSON (UTF-8), no markdown code fences.

Schema (exact keys):
{
  "narrative_summary": "<comprehensive meeting summary>",
  "decisions": [
    {"decision": "...", "owner": "...", "deadline": "...", "impact": "...", "confidence": 0.0-1.0}
  ],
  "action_items": [
    {"task": "...", "owner": "...", "deadline": "...", "status": "...", "confidence": 0.0-1.0}
  ],
  "achievements": [
    {"achievement": "...", "member": "...", "confidence": 0.0-1.0, "evidence": [{"t": "MM:SS", "quote": "..."}]}
  ],
  "blockers": [
    {"blocker": "...", "member": "...", "owner": "...", "confidence": 0.0-1.0, "evidence": [{"t": "MM:SS", "quote": "..."}]}
  ],
  "concerns": [
    {"concern": "...", "raised_by": "...", "mitigation": "...", "confidence": 0.0-1.0}
  ]
}

NARRATIVE SUMMARY STRUCTURE & GUIDELINES:

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

STRUCTURED EXTRACTION GUIDELINES:

DECISIONS:
- Extract all firm decisions made during the meeting
- Include decision maker(s), timeline if mentioned, and impact/importance
- Confidence: 0.9-1.0 for explicit decisions, 0.6-0.8 for implicit/inferred

ACTION ITEMS (CRITICAL - BE EXTREMELY THOROUGH):
- **Extract EVERY single task, to-do, commitment, or follow-up mentioned**
- Look for explicit phrases like: "I'll...", "We need to...", "Someone should...", "Let's...", "Will do...", "Going to...", "Should...", "Must..."
- Look for implicit commitments: promises to investigate, review, send, share, update, fix, implement, test, document, etc.
- Include follow-up actions: "follow up with", "reach out to", "check on", "get back to", "circle back", "touch base"
- Include information requests: "need to find out", "have to check", "will look into", "going to research"
- Include scheduled activities: "will have a meeting", "need to schedule", "set up", "organize"
- **DO NOT MISS**: Review requests, approval needs, sharing documents, sending updates, creating reports
- Owner: The person who will do it (name if mentioned, or "TBD" if unclear)
- Deadline: Extract any mentioned date, time reference ("by Friday", "next week", "end of month") or leave empty
- Status: Use "pending", "in-progress", or "to-do" (default to "to-do")
- Confidence: 0.9-1.0 for explicit assignments ("John will do X"), 0.7-0.8 for implied ("We should do X"), 0.5-0.6 for unclear ownership
- **IMPORTANT**: It's better to include a potential action item with lower confidence than to miss it entirely

ACHIEVEMENTS:
- Extract accomplishments, wins, milestones, or positive outcomes mentioned
- Include who achieved it and supporting evidence with timestamps
- Only include if explicitly mentioned or clearly celebrated
- Confidence: 0.8-1.0 for direct mentions, 0.5-0.7 for inferred

BLOCKERS:
- Extract obstacles, impediments, risks, or challenges mentioned
- Include who raised it, who owns resolution, and evidence
- Confidence: 0.8-1.0 for explicit blockers, 0.5-0.7 for concerns

CONCERNS:
- Extract worries, questions, or potential issues raised
- Include who raised it and any proposed mitigation
- Confidence: 0.8-1.0 for direct concerns, 0.5-0.7 for subtle indicators

QUALITY STANDARDS:
- Write in clear, professional language suitable for stakeholders who weren't present
- Synthesize information intelligently - avoid simply concatenating segment summaries
- Show connections between related points discussed at different times
- Maintain factual accuracy - never invent details not in the source material
- Use proper paragraphs and structure with section headings where helpful
- Be comprehensive but avoid unnecessary repetition
- Focus on "what matters" - decisions, commitments, problems, and solutions
- For structured fields: only include items with confidence >= 0.5
- If no items found for a category, return empty array []

**CRITICAL PRIORITY - ACTION ITEMS EXTRACTION**:
Your PRIMARY GOAL is to extract ALL action items comprehensively. Read through the entire meeting transcript MULTIPLE TIMES if needed to catch:
1. Direct assignments and commitments
2. Follow-up promises and pending work
3. Information gathering requests
4. Scheduled future activities
5. Review and approval needs
6. Any mention of future work or next steps

Missing action items can lead to tasks falling through the cracks. Be thorough and err on the side of inclusion.

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

    # Return structured object with defaults
    return {
        "narrative_summary": str(obj.get("narrative_summary", "")).strip(),
        "decisions": obj.get("decisions", []),
        "action_items": obj.get("action_items", []),
        "achievements": obj.get("achievements", []),
        "blockers": obj.get("blockers", []),
        "concerns": obj.get("concerns", [])
    }


def summarize_collective(
    segment_summaries: List[Dict[str, Any]],
    model: Optional[str] = None,
    max_retries: int = 3,
    sleep_sec: float = 0.8,
) -> Dict[str, Any]:
    """
    Create collective summary from segment summaries with structured extraction.

    Args:
        segment_summaries: List of segment summary dicts
        model: Model name (optional)
        max_retries: Max retry attempts
        sleep_sec: Sleep between retries

    Returns:
        Dict with narrative_summary, decisions, action_items, achievements, blockers, concerns
    """
    model = _resolve_model(model)
    if not segment_summaries:
        return {
            "narrative_summary": "",
            "decisions": [],
            "action_items": [],
            "achievements": [],
            "blockers": [],
            "concerns": []
        }

    bundle = _bundle_segments_for_collective(segment_summaries)
    messages = _build_messages_collective(bundle)

    for attempt in range(1, max_retries + 1):
        try:
            content = call_ollama_cloud(model, messages, json_mode=True)
            return _parse_json_collective(content)
        except Exception as e:
            if attempt == max_retries:
                return {
                    "narrative_summary": "",
                    "decisions": [],
                    "action_items": [],
                    "achievements": [],
                    "blockers": [],
                    "concerns": [],
                    "error": str(e)
                }
        time.sleep(sleep_sec)
