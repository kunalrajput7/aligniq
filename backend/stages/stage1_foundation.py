"""
Stage 1: Foundation & Structure
Extract meeting metadata, timeline key moments, and chapter boundaries.
This provides the structural foundation for subsequent stages.
"""
from __future__ import annotations
import json
from typing import List, Dict, Any, Optional
from .common import call_ollama_cloud_async, _resolve_model, _fmt_local


async def run_foundation_stage_async(
    utterances: List[Dict[str, Any]],
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Stage 1: Extract meeting structure and foundation.

    Args:
        utterances: List of {speaker, text, start_ms, end_ms}
        model: Optional model override

    Returns:
        {
            "meeting_details": {title, date, duration_ms, participants, unknown_count},
            "timeline": [{timestamp_ms, text, speakers}],
            "chapters": [{chapter_id, title, start_ms, end_ms, topic_keywords}]
        }
    """
    if not utterances:
        return _empty_foundation()

    # Build full transcript with timestamps
    transcript_lines = []
    for utt in utterances:
        speaker = utt.get("speaker", "Unknown")
        text = utt.get("text", "").strip()
        start_ms = utt.get("start_ms", 0)
        timestamp = _fmt_local(start_ms)
        if text:
            transcript_lines.append(f"[{timestamp}] {speaker}: {text}")

    full_transcript = "\n".join(transcript_lines)

    # Calculate meeting duration
    duration_ms = utterances[-1].get("end_ms", 0) if utterances else 0

    # Build prompt
    system_prompt = """You are an expert meeting analyst specializing in structural analysis.

Your task is to extract the foundational structure of the meeting:
1. Meeting metadata (objective facts)
2. Timeline of key moments (8-15 critical points)
3. Chapter boundaries (3-7 thematic sections)

Be precise with timestamps and focus on objective, structural elements."""

    user_prompt = f"""Analyze this meeting transcript and extract the foundational structure.

TRANSCRIPT:
{full_transcript}

MEETING METADATA:
- Total utterances: {len(utterances)}
- Duration: {_fmt_local(duration_ms)}

Provide a JSON response with the following EXACT structure:

{{
  "meeting_details": {{
    "title": "A concise, descriptive meeting title (3-8 words)",
    "date": "YYYY-MM-DD (use today's date if not mentioned)",
    "duration_ms": {duration_ms},
    "participants": ["Alice", "Bob", "Charlie"],
    "unknown_count": 0
  }},

  "timeline": [
    {{
      "timestamp_ms": 0,
      "text": "Meeting started - introduction and agenda setting",
      "speakers": ["Alice"]
    }},
    {{
      "timestamp_ms": 120000,
      "text": "Key decision point or important discussion",
      "speakers": ["Bob", "Alice"]
    }}
  ],

  "chapters": [
    {{
      "chapter_id": "ch1",
      "title": "Introduction & Agenda",
      "start_ms": 0,
      "end_ms": 180000,
      "topic_keywords": ["agenda", "introductions", "goals"]
    }},
    {{
      "chapter_id": "ch2",
      "title": "Technical Discussion",
      "start_ms": 180000,
      "end_ms": 480000,
      "topic_keywords": ["architecture", "implementation", "requirements"]
    }}
  ]
}}

INSTRUCTIONS:

**Meeting Details:**
- title: Create a concise, professional title that captures the meeting's purpose
- date: Use format YYYY-MM-DD (default to today if not mentioned)
- participants: List all unique speakers (exclude "Unknown")
- unknown_count: Count of "Unknown" speaker utterances

**Timeline (8-15 key moments):**
- Select the MOST IMPORTANT moments that define the meeting flow
- Include: decisions, topic transitions, key announcements, important questions, critical discussions
- Use actual timestamps from the transcript
- Be specific about what happened
- List all speakers involved in that moment

**Chapters (3-7 thematic sections):**
- Divide the meeting into logical thematic chapters based on topic shifts
- Each chapter should represent a distinct discussion topic or meeting phase
- chapter_id: Use format "ch1", "ch2", etc.
- title: Clear, descriptive chapter title (3-6 words)
- start_ms and end_ms: Actual timestamps that define the chapter boundaries
- topic_keywords: 3-5 keywords that characterize this chapter's content

**Quality Guidelines:**
- Use ACTUAL timestamps from the transcript (don't fabricate)
- Chapters should not overlap and should cover the entire meeting
- Timeline moments should be spread throughout the meeting (not clustered)
- Be objective - focus on structure, not interpretation

Return ONLY valid JSON with no additional text."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        response_text = await call_ollama_cloud_async(_resolve_model(model), messages, json_mode=True)
        result = json.loads(response_text)

        # Validate and normalize
        result = _normalize_foundation(result, utterances, duration_ms)

        print(f"[STAGE 1] Foundation extraction complete:")
        print(f"  - Meeting: {result['meeting_details'].get('title', 'N/A')}")
        print(f"  - Participants: {len(result['meeting_details'].get('participants', []))}")
        print(f"  - Timeline points: {len(result.get('timeline', []))}")
        print(f"  - Chapters: {len(result.get('chapters', []))}")

        return result

    except json.JSONDecodeError as e:
        print(f"[STAGE 1] JSON decode error: {e}")
        print(f"[STAGE 1] Response text: {response_text[:500]}")
        return _empty_foundation()
    except Exception as e:
        print(f"[STAGE 1] Error: {e}")
        import traceback
        traceback.print_exc()
        return _empty_foundation()


def _normalize_foundation(result: Dict[str, Any], utterances: List[Dict[str, Any]], duration_ms: int) -> Dict[str, Any]:
    """Normalize and validate foundation stage output."""

    # Normalize meeting_details
    meeting_details = result.get("meeting_details", {})
    if not isinstance(meeting_details, dict):
        meeting_details = {}

    # Extract unique participants from utterances if not provided
    if not meeting_details.get("participants"):
        participants = set()
        unknown_count = 0
        for utt in utterances:
            speaker = utt.get("speaker", "Unknown")
            if speaker.lower() == "unknown":
                unknown_count += 1
            else:
                participants.add(speaker)
        meeting_details["participants"] = sorted(list(participants))
        meeting_details["unknown_count"] = unknown_count

    meeting_details.setdefault("title", "Untitled Meeting")
    meeting_details.setdefault("date", "")
    meeting_details["duration_ms"] = duration_ms

    # Normalize timeline
    timeline = result.get("timeline", [])
    if not isinstance(timeline, list):
        timeline = []

    # Ensure timeline points have required fields
    normalized_timeline = []
    for point in timeline:
        if isinstance(point, dict) and "timestamp_ms" in point and "text" in point:
            normalized_timeline.append({
                "timestamp_ms": int(point.get("timestamp_ms", 0)),
                "text": str(point.get("text", "")).strip(),
                "speakers": point.get("speakers", [])
            })

    # Normalize chapters
    chapters = result.get("chapters", [])
    if not isinstance(chapters, list):
        chapters = []

    # Ensure chapters have required fields
    normalized_chapters = []
    for i, chapter in enumerate(chapters):
        if isinstance(chapter, dict):
            normalized_chapters.append({
                "chapter_id": chapter.get("chapter_id", f"ch{i+1}"),
                "title": str(chapter.get("title", f"Chapter {i+1}")).strip(),
                "start_ms": int(chapter.get("start_ms", 0)),
                "end_ms": int(chapter.get("end_ms", duration_ms)),
                "topic_keywords": chapter.get("topic_keywords", [])
            })

    # If no chapters, create a default one
    if not normalized_chapters:
        normalized_chapters.append({
            "chapter_id": "ch1",
            "title": "Full Meeting",
            "start_ms": 0,
            "end_ms": duration_ms,
            "topic_keywords": []
        })

    return {
        "meeting_details": meeting_details,
        "timeline": normalized_timeline,
        "chapters": normalized_chapters
    }


def _empty_foundation() -> Dict[str, Any]:
    """Return empty foundation structure."""
    return {
        "meeting_details": {
            "title": "Untitled Meeting",
            "date": "",
            "duration_ms": 0,
            "participants": [],
            "unknown_count": 0
        },
        "timeline": [],
        "chapters": []
    }


def run_foundation_stage(utterances: List[Dict[str, Any]], model: Optional[str] = None) -> Dict[str, Any]:
    """Synchronous wrapper for foundation stage."""
    import asyncio
    return asyncio.run(run_foundation_stage_async(utterances, model))
