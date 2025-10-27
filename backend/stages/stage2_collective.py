"""
Stage 2: Create collective summary from all segment summaries with structured extraction.
"""
from __future__ import annotations
import json
import asyncio
from typing import List, Dict, Any, Optional
from .common import _resolve_model, _truncate, COLLECTIVE_MAX_CHARS, call_ollama_cloud_async


COLLECTIVE_PROMPT = """You are an expert meeting analyst creating an executive summary of the entire meeting.

You will receive segment summaries and timeline key points from throughout the meeting.
Your task: Synthesize these into ONE comprehensive analysis with structured extraction.

Return STRICT JSON (UTF-8), no markdown code fences.

Schema (exact keys):
{
  "narrative_summary": "<comprehensive meeting summary>",
  "action_items": [
    {"task": "...", "owner": "...", "deadline": "...", "status": "...", "confidence": 0.0-1.0}
  ],
  "achievements": [
    {"achievement": "...", "member": "...", "confidence": 0.0-1.0, "evidence": [{"t": "MM:SS", "quote": "..."}]}
  ],
  "blockers": [
    {"blocker": "...", "member": "...", "owner": "...", "confidence": 0.0-1.0, "evidence": [{"t": "MM:SS", "quote": "..."}]}
  ]
}

NARRATIVE SUMMARY STRUCTURE & FORMATTING:

**CRITICAL**: Use Markdown formatting with bold section titles and organized content.
**CRITICAL**: Focus ONLY on the main topics - skip minor issues like connection problems, audio issues, or trivial digressions.
**CRITICAL**: Be concise but comprehensive - cover the key meeting topics in depth.

Format the narrative_summary as follows:

**Meeting Overview**
- 2-3 sentences covering: What was this meeting about? What were the primary goals or objectives?
- Skip unnecessary details like connection issues, technical setup, or small talk.

**Key Discussion Topics**
Break this into subsections with **Bold Topic Titles** (use ## for major topics in markdown):

## [Topic Name 1]
- What was discussed about this topic
- Key points, technical details, numbers, dates
- Who contributed or led the discussion
- Any decisions or conclusions reached

## [Topic Name 2]
- What was discussed about this topic
- Technical details and specifics
- Contributors and their perspectives
- Outcomes or next steps

(Continue for all major topics - typically 2-5 main topics per meeting)

**Decisions Made**
- List key decisions with decision-makers (if mentioned)
- Include context: why the decision was made
- Note any conditions or dependencies

**Concerns & Challenges**
- Surface any risks, blockers, or challenges discussed
- Include proposed solutions or mitigation strategies
- Note unresolved concerns requiring follow-up

**Next Steps**
- Clear action items and immediate next steps
- Timelines or deadlines mentioned
- Expected outcomes or deliverables

**FORMATTING RULES**:
1. Use **Bold** for section headers and key terms
2. Use ## for major topic subsections
3. Use bullet points (-) for lists and sub-points
4. Keep paragraphs short (2-4 sentences max)
5. Group related points together
6. Skip trivial details (connection issues, "can you hear me", technical setup, etc.)
7. Focus on SUBSTANCE: what decisions were made, what was discussed, what problems were identified, what solutions were proposed

STRUCTURED EXTRACTION GUIDELINES:

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
        "action_items": obj.get("action_items", []),
        "achievements": obj.get("achievements", []),
        "blockers": obj.get("blockers", [])
    }


async def summarize_collective_async(
    segment_summaries: List[Dict[str, Any]],
    model: Optional[str] = None,
    max_retries: int = 3,
    sleep_sec: float = 0.8,
) -> Dict[str, Any]:
    """
    Create collective summary from segment summaries with structured extraction asynchronously.

    Args:
        segment_summaries: List of segment summary dicts
        model: Model name (optional)
        max_retries: Max retry attempts
        sleep_sec: Sleep between retries

    Returns:
        Dict with narrative_summary, action_items, achievements, blockers
    """
    model = _resolve_model(model)
    if not segment_summaries:
        return {
            "narrative_summary": "",
            "action_items": [],
            "achievements": [],
            "blockers": []
        }

    bundle = _bundle_segments_for_collective(segment_summaries)
    messages = _build_messages_collective(bundle)

    for attempt in range(1, max_retries + 1):
        try:
            content = await call_ollama_cloud_async(model, messages, json_mode=True)
            return _parse_json_collective(content)
        except Exception as e:
            if attempt == max_retries:
                return {
                    "narrative_summary": "",
                    "action_items": [],
                    "achievements": [],
                    "blockers": [],
                    "error": str(e)
                }
        await asyncio.sleep(sleep_sec)
