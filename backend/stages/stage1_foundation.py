"""
Stage 1: Foundation & Structure
Extract meeting metadata, timeline key moments, and chapter boundaries.
This provides the structural foundation for subsequent stages.
"""
from __future__ import annotations
import json
from typing import List, Dict, Any, Optional
from .common import call_ollama_cloud_async, _resolve_model, _fmt_local, STAGE1_MODEL, STAGE1_ENDPOINT, STAGE1_KEY


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
            "timeline": [{timestamp_ms, event, speakers}],
            "chapters": [{chapter_id, title, start_ms, end_ms, topic_keywords}]
        }
    """
    if not utterances:
        return _empty_foundation()

    # Build full transcript with speaker labels (no timestamps in output)
    transcript_lines = []
    for utt in utterances:
        speaker = utt.get("speaker", "Unknown")
        text = utt.get("text", "").strip()
        start_ms = utt.get("start_ms", 0)
        if text:
            transcript_lines.append(f"[{_fmt_local(start_ms)}] {speaker}: {text}")

    full_transcript = "\n".join(transcript_lines)

    # Calculate meeting duration
    duration_ms = utterances[-1].get("end_ms", 0) if utterances else 0

    # Build optimized prompt using best practices
    system_prompt = """You are an expert meeting analyst. Extract the structural foundation of meetings with precision and clarity.

Your role: Identify meeting metadata, key moments, and thematic chapters.

Output requirements:
- Be factual and objective
- Use actual content from the transcript
- Create clear, professional labels
- Ensure complete coverage of the meeting"""

    user_prompt = f"""Analyze this meeting transcript and extract its structure.

TRANSCRIPT:
{full_transcript}

MEETING INFO:
- Utterances: {len(utterances)}
- Duration: {_fmt_local(duration_ms)}

Return a JSON object with this EXACT structure:

{{
  "meeting_details": {{
    "title": "Professional 3-8 word title capturing the meeting's purpose",
    "date": "YYYY-MM-DD format (today if not mentioned)",
    "duration_ms": {duration_ms},
    "participants": ["List", "of", "unique", "speaker", "names"],
    "unknown_count": 0
  }},
  "timeline": [
    {{
      "timestamp_ms": 0,
      "event": "Brief description of what happened at this moment",
      "speakers": ["Who was involved"]
    }}
  ],
  "chapters": [
    {{
      "chapter_id": "ch1",
      "title": "Clear 3-6 word chapter title",
      "start_ms": 0,
      "end_ms": 180000,
      "topic_keywords": ["keyword1", "keyword2", "keyword3"]
    }}
  ]
}}

EXTRACTION GUIDELINES:

Meeting Details:
- title: Capture the main purpose (e.g., "Q4 Product Launch Planning")
- participants: Extract all unique speaker names, exclude "Unknown"
- unknown_count: Count utterances from "Unknown" speakers

Timeline (8-15 key moments):
- Select defining moments: decisions, announcements, topic shifts, key questions
- Spread events across the entire meeting duration
- event: Write clear, specific descriptions of what happened
- speakers: List who was speaking at that moment

Chapters (3-7 thematic sections):
- Group discussion into logical topic areas
- Chapters must not overlap and should cover the full meeting
- title: Create descriptive titles (e.g., "Budget Review", "Technical Architecture")
- topic_keywords: 3-5 words that characterize the chapter content

Return ONLY valid JSON."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        import time
        start_time = time.time()

        stage_model = model if model else STAGE1_MODEL
        print(f"[STAGE 1] Starting foundation extraction...")
        print(f"[STAGE 1] Model: {stage_model}")

        response_text = await call_ollama_cloud_async(
            model=stage_model,
            messages=messages,
            json_mode=True,
            endpoint=STAGE1_ENDPOINT,
            api_key=STAGE1_KEY
        )
        result = json.loads(response_text)

        # Validate and normalize
        result = _normalize_foundation(result, utterances, duration_ms)

        elapsed_time = time.time() - start_time
        print(f"[STAGE 1] ✓ Foundation extraction complete in {elapsed_time:.2f}s")
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

    normalized_timeline = []
    for point in timeline:
        if isinstance(point, dict) and "timestamp_ms" in point:
            normalized_timeline.append({
                "timestamp_ms": int(point.get("timestamp_ms", 0)),
                "event": str(point.get("event", point.get("text", ""))).strip(),
                "speakers": point.get("speakers", [])
            })

    # Normalize chapters
    chapters = result.get("chapters", [])
    if not isinstance(chapters, list):
        chapters = []

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
