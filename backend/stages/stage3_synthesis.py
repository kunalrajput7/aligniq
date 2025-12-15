"""
Stage 3: Narrative Synthesis
Generate comprehensive executive summary and detailed chapter summaries.
This stage focuses on creating clear, structured documentation that captures all important meeting details.
"""
from __future__ import annotations
import json
from typing import List, Dict, Any, Optional
from .common import call_ollama_cloud_async, _resolve_model, _fmt_local, STAGE3_MODEL, STAGE3_ENDPOINT, STAGE3_KEY


async def run_synthesis_stage_async(
    utterances: List[Dict[str, Any]],
    chapters: List[Dict[str, Any]],
    action_items: List[Dict[str, Any]],
    achievements: List[Dict[str, Any]],
    blockers: List[Dict[str, Any]],
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Stage 3: Generate comprehensive narrative summary and chapter summaries.

    Args:
        utterances: List of {speaker, text, start_ms, end_ms}
        chapters: Chapter boundaries from Stage 1
        action_items: Action items from Stage 2
        achievements: Achievements from Stage 2
        blockers: Blockers from Stage 2
        model: Optional model override

    Returns:
        {
            "narrative_summary": "Comprehensive executive summary in markdown",
            "chapters": [{chapter_id, title, start_ms, end_ms, topic_keywords, summary}]
        }
    """
    if not utterances:
        return _empty_synthesis(chapters)

    # Build transcript with speaker labels
    transcript_lines = []
    for utt in utterances:
        speaker = utt.get("speaker", "Unknown")
        text = utt.get("text", "").strip()
        if text:
            transcript_lines.append(f"{speaker}: {text}")

    full_transcript = "\n".join(transcript_lines)

    # Build chapter context with keywords
    chapter_info = "\n".join([
        f"- {ch.get('chapter_id')}: {ch.get('title')} - Topics: {', '.join(ch.get('topic_keywords', [])[:4])}"
        for ch in chapters
    ])

    # Build action items summary for context
    action_summary = ""
    if action_items:
        action_summary = "\n".join([
            f"- {item.get('task', '')} (Owner: {item.get('owner', 'Unassigned')})"
            for item in action_items[:8]
        ])

    # System prompt focused on comprehensive summaries
    system_prompt = """You are an expert at creating comprehensive, well-structured meeting documentation.

Your goal: Create a COMPLETE executive summary that captures EVERYTHING important from the meeting.

The summary should be detailed enough that someone who missed the meeting understands:
- What was discussed and why
- What decisions were made
- What problems or concerns were raised
- What the key takeaways are
- What happens next

Writing rules:
- Use markdown formatting with clear headings
- Use bullet points (-) for all lists
- Be specific: include names, numbers, dates, details
- Cover ALL major topics discussed
- Make it comprehensive but scannable"""

    user_prompt = f"""Create a comprehensive executive summary of this meeting.

TRANSCRIPT:
{full_transcript}

CHAPTERS COVERED:
{chapter_info}

ACTION ITEMS IDENTIFIED:
{action_summary if action_summary else "No specific action items identified"}

Return JSON with this structure:

{{
  "narrative_summary": "comprehensive markdown summary",
  "chapters": [
    {{"chapter_id": "ch1", "summary": "detailed chapter summary"}}
  ]
}}

=== NARRATIVE SUMMARY FORMAT ===

Create a COMPREHENSIVE summary following this structure:

**Executive Overview**
A 3-4 sentence paragraph summarizing the meeting's purpose, main outcomes, and key decisions. This should give readers the essential context immediately.

**Key Takeaways**
- Most important insight or decision #1
- Most important insight or decision #2
- Most important insight or decision #3
- Most important insight or decision #4
(List 4-6 bullet points capturing the most critical outcomes)

**Discussion Topics**

## [First Major Topic]
- Key point discussed with specific details
- Who contributed and what they said
- Decisions made or conclusions reached
- Any concerns or considerations raised
- Next steps related to this topic

## [Second Major Topic]
- Specific discussion points with details
- Contributors and their perspectives
- Outcomes or agreements
- Open questions or follow-ups needed

## [Third Major Topic]
(Continue for each major topic - typically 3-6 topics)

**Decisions & Agreements**
- Decision 1: What was decided, who made it, rationale
- Decision 2: Details and any conditions
- Decision 3: Context and follow-up required
(List ALL significant decisions made during the meeting)

**Risks & Concerns**
- Concern 1: Description and impact
- Concern 2: Proposed mitigation if discussed
- Concern 3: Owner or follow-up needed
(List ALL risks, concerns, or challenges raised)

**Next Steps**
- Action 1: What needs to happen next
- Action 2: Key follow-up items
- Action 3: Important deadlines or milestones
(Brief list of immediate next steps - detailed action items are tracked separately)

=== FORMATTING RULES ===

1. Use **bold** for section headers (Executive Overview, Key Takeaways, etc.)
2. Use ## for topic subsections under Discussion Topics
3. Use bullet points (-) for ALL lists
4. Each bullet should be 1-2 sentences with specific details
5. Include names when relevant (who said what, who decided)
6. Include numbers/dates when mentioned
7. Be thorough - cover ALL significant discussions

=== CHAPTER SUMMARIES ===

For each chapter, write 2-4 paragraphs covering:
- Main focus and what was discussed
- Key contributors and their points
- Decisions made or conclusions reached
- How it connects to the overall meeting goals

Return ONLY valid JSON."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        import time
        start_time = time.time()

        stage_model = model if model else STAGE3_MODEL
        print(f"[STAGE 3] Starting comprehensive narrative synthesis...")
        print(f"[STAGE 3] Model: {stage_model}")

        response_text = await call_ollama_cloud_async(
            model=stage_model,
            messages=messages,
            json_mode=True,
            endpoint=STAGE3_ENDPOINT,
            api_key=STAGE3_KEY
        )
        result = json.loads(response_text)

        # Normalize and merge with chapter structure
        result = _normalize_synthesis(result, chapters)

        elapsed_time = time.time() - start_time
        print(f"[STAGE 3] ✓ Narrative synthesis complete in {elapsed_time:.2f}s")
        print(f"  - Narrative summary: {len(result.get('narrative_summary', ''))} chars")
        print(f"  - Chapter summaries: {len(result.get('chapters', []))}")

        return result

    except json.JSONDecodeError as e:
        print(f"[STAGE 3] JSON decode error: {e}")
        print(f"[STAGE 3] Response text: {response_text[:500]}")
        return _empty_synthesis(chapters)
    except Exception as e:
        print(f"[STAGE 3] Error: {e}")
        import traceback
        traceback.print_exc()
        return _empty_synthesis(chapters)


def _normalize_synthesis(result: Dict[str, Any], original_chapters: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Normalize and validate synthesis stage output."""

    # Get narrative summary
    narrative_summary = result.get("narrative_summary", "")
    if not isinstance(narrative_summary, str):
        narrative_summary = ""

    # Merge chapter summaries with original chapter structure
    chapter_summaries = result.get("chapters", [])
    if not isinstance(chapter_summaries, list):
        chapter_summaries = []

    # Create a map of chapter_id -> summary
    summary_map = {}
    for ch_summary in chapter_summaries:
        if isinstance(ch_summary, dict):
            chapter_id = ch_summary.get("chapter_id", "")
            summary = ch_summary.get("summary", "")
            if chapter_id and summary:
                summary_map[chapter_id] = summary

    # Merge summaries into original chapter structure
    final_chapters = []
    for ch in original_chapters:
        chapter_id = ch.get("chapter_id", "")
        final_chapters.append({
            "chapter_id": chapter_id,
            "title": ch.get("title", ""),
            "start_ms": ch.get("start_ms", 0),
            "end_ms": ch.get("end_ms", 0),
            "topic_keywords": ch.get("topic_keywords", []),
            "summary": summary_map.get(chapter_id, "No summary available for this chapter.")
        })

    return {
        "narrative_summary": narrative_summary.strip(),
        "chapters": final_chapters
    }


def _empty_synthesis(chapters: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Return empty synthesis structure with chapter placeholders."""
    empty_chapters = []
    for ch in chapters:
        empty_chapters.append({
            "chapter_id": ch.get("chapter_id", ""),
            "title": ch.get("title", ""),
            "start_ms": ch.get("start_ms", 0),
            "end_ms": ch.get("end_ms", 0),
            "topic_keywords": ch.get("topic_keywords", []),
            "summary": ""
        })

    return {
        "narrative_summary": "",
        "chapters": empty_chapters
    }


def run_synthesis_stage(
    utterances: List[Dict[str, Any]],
    chapters: List[Dict[str, Any]],
    action_items: List[Dict[str, Any]],
    achievements: List[Dict[str, Any]],
    blockers: List[Dict[str, Any]],
    model: Optional[str] = None
) -> Dict[str, Any]:
    """Synchronous wrapper for synthesis stage."""
    import asyncio
    return asyncio.run(run_synthesis_stage_async(utterances, chapters, action_items, achievements, blockers, model))
