"""
Stage 3: Narrative Synthesis
Generate comprehensive executive summary with structured sections and detailed chapter summaries.
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
    six_thinking_hats: Dict[str, Any],
    tone: Dict[str, Any],
    convergent_points: List[Dict[str, Any]],
    divergent_points: List[Dict[str, Any]],
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Stage 3: Generate comprehensive narrative summary and chapter summaries.

    Args:
        utterances: List of {speaker, text, start_ms, end_ms}
        chapters: Chapter boundaries from Stage 1
        action_items: Action items from Stage 2 (for context, not included in narrative)
        achievements: Achievements from Stage 2 (for context)
        blockers: Blockers from Stage 2 (for context)
        six_thinking_hats: Six Thinking Hats analysis from Stage 2
        tone: Meeting tone analysis from Stage 2
        convergent_points: Points of agreement from Stage 2
        divergent_points: Points of disagreement from Stage 2
        model: Optional model override

    Returns:
        {
            "narrative_summary": "Executive summary in markdown with 6 sections",
            "chapters": [{chapter_id, title, start_ms, end_ms, topic_keywords, summary}]
        }
    
    NOTE: Action items, decisions, achievements, blockers are displayed separately in the UI,
    so they are NOT included in the narrative summary.
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

    # Build action items summary for context (not included in narrative, but helps LLM understand meeting)
    # Note: We pass ALL items now, no truncation
    action_summary = ""
    if action_items:
        action_summary = "\n".join([
            f"- {item.get('task', '')} (Owner: {item.get('owner', 'Unassigned')})"
            for item in action_items  # No truncation - pass all
        ])

    # Build tone context
    tone_context = ""
    if tone:
        tone_context = f"Overall: {tone.get('overall', 'collaborative')}, Energy: {tone.get('energy', 'medium')}"
        if tone.get('description'):
            tone_context += f"\nDescription: {tone.get('description')}"

    # Build convergent points context - pass ALL, no truncation
    convergent_context = ""
    if convergent_points:
        convergent_context = "\n".join([
            f"- {cp.get('topic', '')} (Agreed by: {', '.join(cp.get('agreed_by', []))})"
            for cp in convergent_points  # No truncation
        ])

    # Build divergent points context - pass ALL, no truncation
    divergent_context = ""
    if divergent_points:
        divergent_items = []
        for dp in divergent_points:  # No truncation
            topic = dp.get('topic', '')
            perspectives = dp.get('perspectives', [])
            perspective_str = "; ".join([f"{p.get('speaker', '')} → {p.get('view', '')}" for p in perspectives])
            resolution = dp.get('resolution', 'Unresolved')
            divergent_items.append(f"- {topic}: {perspective_str} (Resolution: {resolution})")
        divergent_context = "\n".join(divergent_items)

    # Build hats context
    hats_context = ""
    if six_thinking_hats:
        hats_items = []
        for participant, data in list(six_thinking_hats.items())[:6]:
            hat = data.get('dominant_hat', 'white') if isinstance(data, dict) else 'white'
            hats_items.append(f"- {participant}: {hat.capitalize()} Hat")
        hats_context = "\n".join(hats_items)

    # System prompt focused on 6-section narrative summaries
    # Note: Action items, decisions, achievements, blockers are displayed separately in UI
    system_prompt = """You are an expert at creating comprehensive, well-structured meeting documentation.

Your goal: Create a narrative executive summary with 6 KEY SECTIONS that captures the meeting's essence.

IMPORTANT: Do NOT include Action Items or Decisions sections - these are displayed separately in the application.

The summary should help someone who missed the meeting understand:
- What was discussed and why (Executive Overview)
- The most important outcomes (Key Takeaways)
- Major topics covered (Discussion Topics)
- The overall tone and energy (Meeting Tone)
- Where the team aligned (Aligned Thinking)
- Where opinions differed (Divergent Perspectives)

Writing rules:
- Use markdown formatting with **bold** section headers (no numbers)
- Use bullet points (-) for all lists
- Be specific: include names, numbers, dates, details
- Cover ALL major topics discussed
- Make it comprehensive but scannable"""

    user_prompt = f"""Create a meeting summary with EXACTLY 6 SECTIONS.

TRANSCRIPT:
{full_transcript}

CONTEXT DATA (for your understanding, NOT to be copied into sections):
- Chapters: {chapter_info}
- Tone: {tone_context if tone_context else "collaborative, productive"}
- Agreements: {convergent_context if convergent_context else "See transcript"}
- Disagreements: {divergent_context if divergent_context else "See transcript"}

Return JSON:
{{
  "narrative_summary": "markdown with EXACTLY 6 sections as specified below",
  "chapters": [{{"chapter_id": "ch1", "summary": "detailed summary"}}]
}}

=== MANDATORY 6 SECTIONS (YOU MUST INCLUDE ALL 6) ===

Your narrative_summary MUST contain these EXACT 6 sections in this EXACT order:

**Executive Overview**
[3-4 sentences: meeting purpose, main outcomes, key context]

**Key Takeaways**
- Takeaway 1
- Takeaway 2
- Takeaway 3
- Takeaway 4
[4-6 most important outcomes and insights]

**Discussion Topics**
## Topic Name 1
- What was discussed
- Key contributors and their points
- Outcomes or conclusions

## Topic Name 2
- Details...
[Cover 3-6 main topics with ## subheaders]

**Meeting Tone**
[1-2 paragraphs describing the atmosphere: Was it collaborative, tense, productive? High/medium/low energy? How did participants interact? Did the tone shift during the meeting?]

**Aligned Thinking**
Points where the team reached consensus:
- Everyone agreed that...
- Unanimous support for...
- Shared conclusion about...
[3-5 points where the team was in agreement]

**Divergent Perspectives**
Areas where viewpoints differed:
- **[Topic]**: [Person A] → [their view], [Person B] → [their view]
  - Resolution: [How resolved or "Still under discussion"]
[2-4 areas of disagreement with different perspectives shown]

=== CRITICAL RULES ===

1. Include EXACTLY 6 sections - no more, no less
2. Do NOT include "Decisions Made" or "Action Items" sections - these are displayed separately
3. Use **bold** for section headers (e.g., **Executive Overview**) - NO numbers
4. Use ## for sub-topics under Discussion Topics only
5. Use - for bullet points
6. For Divergent Perspectives, use → to show each person's view
7. If no disagreements, write "No significant disagreements were observed"

=== CHAPTER SUMMARIES ===

For each chapter, write 2-3 paragraphs covering key points discussed.

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
            api_key=STAGE3_KEY,
            max_tokens=16000  # Ensure full response without truncation
        )
        result = json.loads(response_text)

        # Normalize and merge with chapter structure
        result = _normalize_synthesis(result, chapters)
        
        # Post-process to fix markdown formatting
        result["narrative_summary"] = _fix_markdown_headers(result.get("narrative_summary", ""))

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


def _fix_markdown_headers(text: str) -> str:
    """
    Post-process narrative summary to ensure consistent markdown formatting.
    Converts various header formats to consistent **bold** for main sections.
    
    Expected 6 sections (without numbers):
    - Executive Overview
    - Key Takeaways
    - Discussion Topics
    - Meeting Tone
    - Aligned Thinking
    - Divergent Perspectives
    """
    import re
    
    if not text:
        return text
    
    # Define the 6 main section patterns to fix (with or without numbers)
    section_patterns = [
        # Match numbered versions and convert to non-numbered
        (r'^##?\s*\*?\*?(?:1\.\s*)?Executive Overview\*?\*?', '**Executive Overview**'),
        (r'^##?\s*\*?\*?(?:2\.\s*)?Key Takeaways\*?\*?', '**Key Takeaways**'),
        (r'^##?\s*\*?\*?(?:3\.\s*)?Discussion Topics\*?\*?', '**Discussion Topics**'),
        (r'^##?\s*\*?\*?(?:4\.\s*)?Meeting Tone\*?\*?', '**Meeting Tone**'),
        (r'^##?\s*\*?\*?(?:5\.\s*)?Aligned Thinking\*?\*?', '**Aligned Thinking**'),
        (r'^##?\s*\*?\*?(?:6\.\s*)?Divergent Perspectives\*?\*?', '**Divergent Perspectives**'),
    ]
    
    # Apply all pattern fixes
    for pattern, replacement in section_patterns:
        text = re.sub(pattern, replacement, text, flags=re.MULTILINE | re.IGNORECASE)
    
    # Clean up any double asterisks that might have been created
    text = re.sub(r'\*\*\*\*', '**', text)
    
    # Remove any stray "Decisions Made" or "Action Items" sections that LLM might add
    # These should be displayed separately in the UI
    text = re.sub(r'\n\*\*(?:\d+\.\s*)?(?:Decisions Made|Action Items)\*\*[\s\S]*?(?=\n\*\*|$)', '', text, flags=re.IGNORECASE)
    
    return text.strip()


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
    six_thinking_hats: Dict[str, Any] = None,
    tone: Dict[str, Any] = None,
    convergent_points: List[Dict[str, Any]] = None,
    divergent_points: List[Dict[str, Any]] = None,
    model: Optional[str] = None
) -> Dict[str, Any]:
    """Synchronous wrapper for synthesis stage."""
    import asyncio
    return asyncio.run(run_synthesis_stage_async(
        utterances, chapters, action_items, achievements, blockers,
        six_thinking_hats or {}, tone or {}, convergent_points or [], divergent_points or [], model
    ))
