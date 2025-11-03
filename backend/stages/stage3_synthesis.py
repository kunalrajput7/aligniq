"""
Stage 3: Narrative Synthesis
Generate executive narrative summary and detailed chapter summaries.
This stage focuses on storytelling and markdown formatting.
"""
from __future__ import annotations
import json
from typing import List, Dict, Any, Optional
from .common import call_ollama_cloud_async, _resolve_model, _fmt_local


async def run_synthesis_stage_async(
    utterances: List[Dict[str, Any]],
    chapters: List[Dict[str, Any]],
    action_items: List[Dict[str, Any]],
    achievements: List[Dict[str, Any]],
    blockers: List[Dict[str, Any]],
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Stage 3: Generate narrative summary and chapter summaries.

    Args:
        utterances: List of {speaker, text, start_ms, end_ms}
        chapters: Chapter boundaries from Stage 1
        action_items: Action items from Stage 2
        achievements: Achievements from Stage 2
        blockers: Blockers from Stage 2
        model: Optional model override

    Returns:
        {
            "narrative_summary": "Executive summary in markdown",
            "chapters": [{chapter_id, title, start_ms, end_ms, topic_keywords, summary}]
        }
    """
    if not utterances:
        return _empty_synthesis(chapters)

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

    # Build context from previous stages
    chapter_info = "\n".join([
        f"- {ch.get('chapter_id', 'ch')}: {ch.get('title', 'Chapter')} "
        f"({_fmt_local(ch.get('start_ms', 0))} - {_fmt_local(ch.get('end_ms', 0))}) "
        f"Keywords: {', '.join(ch.get('topic_keywords', []))}"
        for ch in chapters
    ])

    # Summarize extracted items for context (don't need full details)
    action_summary = f"{len(action_items)} action items extracted (you don't need to list them - they're already structured)"
    achievement_summary = f"{len(achievements)} achievements identified"
    blocker_summary = f"{len(blockers)} blockers/concerns documented"

    # Build prompt
    system_prompt = """You are an expert meeting analyst specializing in narrative synthesis and storytelling.

Your task is to:
1. Create a comprehensive EXECUTIVE SUMMARY in rich markdown format
2. Write detailed 3-5 paragraph SUMMARIES for each chapter

**CRITICAL INSTRUCTIONS:**
- Action items, achievements, and blockers are ALREADY EXTRACTED and structured separately
- DO NOT create standalone bullet lists of them in the narrative
- Reference them naturally when providing context (e.g., "Several deployment tasks were assigned...")
- Focus on the STORY, FLOW, and CONTEXT of the meeting
- Use proper markdown formatting: ##, **bold**, bullet points
- Make it readable and comprehensive"""

    user_prompt = f"""Analyze this meeting transcript and create narrative summaries.

TRANSCRIPT:
{full_transcript}

CHAPTER STRUCTURE:
{chapter_info}

CONTEXT FROM STAGE 2 (already extracted - don't duplicate):
- {action_summary}
- {achievement_summary}
- {blocker_summary}

Provide a JSON response with the following EXACT structure:

{{
  "narrative_summary": "...",
  "chapters": [
    {{
      "chapter_id": "ch1",
      "summary": "Detailed 3-5 paragraph markdown summary of this chapter"
    }}
  ]
}}

**NARRATIVE SUMMARY FORMAT:**

The narrative_summary should be a comprehensive executive summary in MARKDOWN with the following structure:

```markdown
**Meeting Overview**
2-3 sentences: What was this meeting about? What were the primary goals? Skip trivial details like connection issues.

**Key Discussion Topics**
Break this into subsections with **Bold Topic Titles**:

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

(Continue for all major topics – typically 2-5 main topics)

**Decisions Made**
- List key decisions with decision-makers
- Include context: why the decision was made
- Note any conditions or dependencies

**Concerns & Challenges**
- Surface risks, blockers, or challenges (briefly - they're detailed in structured blockers)
- Proposed solutions or mitigation strategies
- Unresolved concerns requiring follow-up
```

**IMPORTANT GUIDELINES FOR NARRATIVE SUMMARY:**
1. Use **Bold** for section headers like **Meeting Overview**, **Decisions Made**
2. Use ## for major topic subsections within Key Discussion Topics
3. Use bullet points (-) for lists and sub-points
4. Keep paragraphs short (2-4 sentences max)
5. Skip trivial details (connection issues, "can you hear me", technical setup)
6. Focus on SUBSTANCE: decisions, discussions, problems, solutions
7. You may REFERENCE action items/achievements/blockers naturally (e.g., "Several deployment tasks were assigned to Bob") but DON'T create standalone lists of them
8. Tell the STORY of what happened in the meeting

**CHAPTER SUMMARIES:**

For EACH chapter in the chapters array, provide a detailed summary (3-5 paragraphs in markdown):
- What was the main focus of this chapter?
- What were the key points discussed?
- Who were the main contributors?
- What decisions or outcomes emerged?
- How does this connect to other chapters?

Format each chapter summary with:
- Clear topic sentences
- Specific details from the transcript
- Natural flow and transitions
- Markdown formatting where appropriate (**bold** for emphasis)

**QUALITY GUIDELINES:**
- Be comprehensive but concise
- Use proper markdown syntax
- Focus on substance over process
- Tell a coherent story
- Make it easy to understand for someone who wasn't in the meeting
- Don't duplicate the structured data (action items, achievements, blockers) - they're already available separately

Return ONLY valid JSON with no additional text."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        response_text = await call_ollama_cloud_async(_resolve_model(model), messages, json_mode=True)
        result = json.loads(response_text)

        # Normalize and merge with chapter structure
        result = _normalize_synthesis(result, chapters)

        print(f"[STAGE 3] Synthesis complete:")
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
