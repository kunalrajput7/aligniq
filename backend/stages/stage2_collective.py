"""
Stage 2: Create collective summary from all segment summaries with structured extraction.
Includes meeting details (title, date) extraction.
"""
from __future__ import annotations
import json
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from .common import _resolve_model, _truncate, _fmt_local, COLLECTIVE_MAX_CHARS, call_ollama_cloud_async


# Types
Utterance = Dict[str, object]


COLLECTIVE_PROMPT = """You are an expert meeting analyst creating an executive summary of the entire meeting.

You will receive segment summaries, timeline key points, and meeting context (participants, excerpt).
Your task: Synthesize these into ONE comprehensive analysis with structured extraction.

Return STRICT JSON (UTF-8), no markdown code fences.

Schema (exact keys):
{
  "meeting_title": "string (<= 8 words, human-friendly meeting theme/purpose)",
  "meeting_date": "YYYY-MM-DD or null (only if explicitly mentioned in transcript)",
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

MEETING TITLE & DATE:
- **meeting_title**: Concise theme/purpose of the meeting (<= 8 words). Should be human-friendly, not buzzwords.
  Examples: "Product Roadmap Planning", "Q3 Budget Review", "Engineering Team Sync"
- **meeting_date**: ONLY if the transcript explicitly mentions a date, return it as YYYY-MM-DD. Otherwise return null.
  Do NOT fabricate dates. Do NOT use today's date unless explicitly mentioned.

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
- What was completed or accomplished (mentioned in past tense)
- Who accomplished it (member name or team)
- Confidence based on how explicitly stated
- Evidence: timestamp + brief quote from the meeting showing the achievement

BLOCKERS:
- What is blocking progress or causing delays
- Who raised the blocker (member name)
- Who owns resolving it (owner - may be different from member who raised it)
- Confidence based on how critical it was presented
- Evidence: timestamp + brief quote describing the blocker

QUALITY STANDARDS:
1. Be thorough - don't skip items even if confidence is medium
2. Use exact names when people are mentioned
3. Preserve specific numbers, dates, and technical terms
4. Link evidence to claims (especially for achievements and blockers)
5. Think step-by-step through the entire meeting
6. Any mention of future work or next steps

Missing action items can lead to tasks falling through the cracks. Be thorough and err on the side of inclusion.

INPUT:
<<<MEETING_BUNDLE>>>
"""


def _excerpt_from_utterances(utterances: List[Utterance], max_chars: int = 2000) -> str:
    """Extract excerpt from first ~80 utterances for context."""
    lines = []
    for u in utterances[:80]:
        lines.append(f'{_fmt_local(int(u["start_ms"]))} | {u["speaker"]} | {u["text"]}')
    text = "\n".join(lines)
    return text[:max_chars]


def _bundle_for_collective(
    utterances: List[Utterance],
    segment_summaries: List[Dict[str, Any]]
) -> str:
    """Bundle meeting context and segment summaries into a single text."""
    parts: List[str] = []

    # Add meeting context from utterances
    speakers = [str(u.get("speaker", "")).strip() for u in utterances]
    participants = sorted({s for s in speakers if s and s != "Speaker ?"})
    participants_str = ", ".join(participants) if participants else "(none)"

    excerpt = _excerpt_from_utterances(utterances)

    parts.append("=== MEETING CONTEXT ===")
    parts.append(f"Participants: {participants_str}")
    parts.append(f"\nTranscript Excerpt (first few minutes):\n{excerpt}")
    parts.append("\n=== SEGMENT SUMMARIES ===\n")

    # Add segment summaries
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

    # Extract and validate meeting title
    title = str(obj.get("meeting_title", "")).strip()
    if title:
        words = title.split()
        if len(words) > 8:
            title = " ".join(words[:8])

    # Extract and validate meeting date
    date = obj.get("meeting_date", None)
    if isinstance(date, str):
        date = date.strip() or None
    else:
        date = None

    # Return structured object with defaults
    return {
        "meeting_title": title,
        "meeting_date": date,
        "narrative_summary": str(obj.get("narrative_summary", "")).strip(),
        "action_items": obj.get("action_items", []),
        "achievements": obj.get("achievements", []),
        "blockers": obj.get("blockers", [])
    }


async def summarize_collective_async(
    utterances: List[Utterance],
    segment_summaries: List[Dict[str, Any]],
    model: Optional[str] = None,
    max_retries: int = 3,
    sleep_sec: float = 0.8,
) -> Dict[str, Any]:
    """
    Create collective summary from utterances and segment summaries with structured extraction asynchronously.
    Also extracts meeting title and date.

    Args:
        utterances: List of utterance dicts (for meeting context and title/date extraction)
        segment_summaries: List of segment summary dicts
        model: Model name (optional)
        max_retries: Max retry attempts
        sleep_sec: Sleep between retries

    Returns:
        Dict with meeting_title, meeting_date, narrative_summary, action_items, achievements, blockers
    """
    model = _resolve_model(model)
    if not segment_summaries or not utterances:
        return {
            "meeting_title": "",
            "meeting_date": None,
            "narrative_summary": "",
            "action_items": [],
            "achievements": [],
            "blockers": []
        }

    bundle = _bundle_for_collective(utterances, segment_summaries)
    messages = _build_messages_collective(bundle)

    for attempt in range(1, max_retries + 1):
        try:
            content = await call_ollama_cloud_async(model, messages, json_mode=True)
            return _parse_json_collective(content)
        except Exception as e:
            if attempt == max_retries:
                return {
                    "meeting_title": "",
                    "meeting_date": None,
                    "narrative_summary": "",
                    "action_items": [],
                    "achievements": [],
                    "blockers": [],
                    "error": str(e)
                }
        await asyncio.sleep(sleep_sec)
