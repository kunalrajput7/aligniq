"""
Stage 3: Narrative Synthesis (OPTIMIZED)
Generate comprehensive executive summary from STRUCTURED DATA ONLY.
Does NOT require the transcript - uses Stage 1 & 2 outputs exclusively.
"""
from __future__ import annotations
import json
import re
from typing import List, Dict, Any, Optional
from .common import call_ollama_cloud_async, STAGE3_MODEL, STAGE3_ENDPOINT, STAGE3_KEY


async def run_synthesis_stage_async(
    utterances: List[Dict[str, Any]],  # Kept for API compatibility but NOT used
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
    Stage 3: Generate comprehensive narrative summary from STRUCTURED DATA ONLY.
    
    OPTIMIZED ARCHITECTURE:
    - Does NOT use the transcript (already analyzed by Stage 1 & 2)
    - Uses only structured data from previous stages
    - Reduces input tokens from ~25K to ~2K
    
    Args:
        utterances: NOT USED - kept for API compatibility
        chapters: Chapter boundaries from Stage 1
        action_items: Action items from Stage 2
        achievements: Achievements from Stage 2
        blockers: Blockers from Stage 2
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
    """
    if not chapters:
        return _empty_synthesis(chapters)

    # Build chapter context
    chapter_info = []
    for ch in chapters:
        ch_title = ch.get('title', 'Chapter')
        ch_keywords = ', '.join(ch.get('topic_keywords', [])[:5])
        ch_id = ch.get('chapter_id', '')
        chapter_info.append(f"- {ch_id}: {ch_title} (Topics: {ch_keywords})")
    chapters_text = "\n".join(chapter_info) if chapter_info else "No chapters identified"

    # Build tone context
    tone_text = "Not analyzed"
    if tone:
        tone_text = f"{tone.get('overall', 'collaborative')} atmosphere, {tone.get('energy', 'medium')} energy"
        if tone.get('description'):
            tone_text += f". {tone.get('description')}"

    # Build aligned (convergent) points
    aligned_text = "No consensus points identified"
    if convergent_points:
        aligned_items = []
        for cp in convergent_points:
            topic = cp.get('topic', '')
            agreed_by = ', '.join(cp.get('agreed_by', []))
            aligned_items.append(f"- {topic} (Agreed by: {agreed_by})")
        aligned_text = "\n".join(aligned_items)

    # Build divergent points
    divergent_text = "No disagreements identified"
    if divergent_points:
        divergent_items = []
        for dp in divergent_points:
            topic = dp.get('topic', '')
            perspectives = dp.get('perspectives', [])
            resolution = dp.get('resolution', 'Unresolved')
            perspective_str = "; ".join([f"{p.get('speaker', 'Someone')}: {p.get('view', '')}" for p in perspectives])
            divergent_items.append(f"- {topic}: {perspective_str} → Resolution: {resolution}")
        divergent_text = "\n".join(divergent_items)

    # Build participants context
    participants_text = "Not analyzed"
    if six_thinking_hats:
        hats_items = []
        for participant, data in six_thinking_hats.items():
            hat = data.get('dominant_hat', 'white') if isinstance(data, dict) else 'white'
            hats_items.append(f"- {participant}: {hat.capitalize()} Hat thinker")
        participants_text = "\n".join(hats_items)

    # Build key outcomes context
    key_outcomes = []
    if action_items:
        key_outcomes.append(f"ACTION ITEMS ({len(action_items)} total):")
        for item in action_items[:5]:
            key_outcomes.append(f"  - {item.get('task', '')} (Owner: {item.get('owner', 'Unassigned')})")
    if achievements:
        key_outcomes.append(f"ACHIEVEMENTS ({len(achievements)} total):")
        for ach in achievements[:3]:
            key_outcomes.append(f"  - {ach.get('achievement', '')}")
    if blockers:
        key_outcomes.append(f"BLOCKERS ({len(blockers)} total):")
        for blk in blockers[:3]:
            key_outcomes.append(f"  - {blk.get('blocker', '')} ({blk.get('severity', 'major')})")
    outcomes_text = "\n".join(key_outcomes) if key_outcomes else "No specific outcomes extracted"

    # System prompt
    system_prompt = """You are an expert meeting summarizer. Write a professional 6-section narrative summary.

IMPORTANT: You are working from STRUCTURED DATA extracted from the meeting, NOT from the transcript.
Write a coherent narrative that synthesizes this data into readable prose.

OUTPUT FORMAT:
- Use **bold** for section headers
- Use ## for topic subheaders under Discussion Topics
- Use bullet points (-) for lists
- Be concise but comprehensive
- Write in past tense
- Do NOT include Action Items or Decisions sections"""

    # User prompt with ONLY structured data
    user_prompt = f"""Write a 6-section meeting summary from this STRUCTURED DATA:

=== MEETING STRUCTURE ===
CHAPTERS/TOPICS:
{chapters_text}

=== ANALYSIS ===
TONE: {tone_text}

PARTICIPANTS:
{participants_text}

=== AGREEMENTS ===
{aligned_text}

=== DISAGREEMENTS ===
{divergent_text}

=== OUTCOMES (context only, don't include in narrative) ===
{outcomes_text}

=== GENERATE EXACTLY THIS STRUCTURE ===

Return JSON:
{{
  "narrative_summary": "markdown with 6 sections",
  "chapters": [{{"chapter_id": "ch1", "summary": "Detailed paragraph (5-7 sentences)"}}]
}}


=== CRITICAL: ALL 6 SECTIONS ARE MANDATORY ===

Your narrative_summary MUST have EXACTLY these 6 sections IN THIS ORDER:

1. ## Meeting Tone  ← DO NOT SKIP THIS
   1-2 paragraphs describing atmosphere based on the tone data provided above.

2. ## Executive Overview
   3-4 sentences: meeting purpose, attendees, main outcomes.

3. ## Key Takeaways
   - 4-6 bullet points of most important insights

4. ## Discussion Topics
   ### [Topic Title from chapters]
   Brief description of what was discussed.
   (Create section for each chapter listed above)

5. ## Aligned Thinking  ← DO NOT SKIP THIS
   Rewrite the agreements from the AGREEMENTS section above as prose bullet points.
   If no agreements were identified, write "No major consensus points were explicitly noted."

6. ## Divergent Perspectives  ← DO NOT SKIP THIS
   Rewrite disagreements showing each person's view and resolution.
   FORMAT: Use bold for the specific topic.
   Example:
   - **Feature priority**: Alice wanted mobile, Bob wanted API. Resolution: Parallel tracks.
   
   If no disagreements were identified, write "No significant disagreements were observed."

WARNING: Your output is INCOMPLETE if it does not contain all 6 sections!

For chapter summaries, write a DETAILED PARAGRAPH (5-7 sentences) for each chapter.

Return ONLY valid JSON."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        import time
        start_time = time.time()

        stage_model = model if model else STAGE3_MODEL
        print(f"[STAGE 3] Starting OPTIMIZED synthesis (no transcript!)...")
        print(f"[STAGE 3] Model: {stage_model}")
        print(f"[STAGE 3] Input: {len(chapters)} chapters, {len(convergent_points)} agreements, {len(divergent_points)} disagreements")

        response_text = await call_ollama_cloud_async(
            model=stage_model,
            messages=messages,
            json_mode=True,
            endpoint=STAGE3_ENDPOINT,
            api_key=STAGE3_KEY
        )
        result = json.loads(response_text)

        # Normalize and fix markdown headers
        narrative = result.get("narrative_summary", "")
        narrative = _fix_markdown_headers(narrative)

        result["narrative_summary"] = narrative
        result = _normalize_synthesis(result, chapters)

        elapsed_time = time.time() - start_time
        print(f"[STAGE 3] ✓ Narrative synthesis complete in {elapsed_time:.2f}s")
        print(f"[STAGE 3] - Narrative summary: {len(result.get('narrative_summary', ''))} chars")
        print(f"[STAGE 3] - Chapter summaries: {len(result.get('chapters', []))}")

        return result

    except json.JSONDecodeError as e:
        print(f"[STAGE 3] JSON decode error: {e}")
        print(f"[STAGE 3] Response text: {response_text[:500] if response_text else 'empty'}")
        return _empty_synthesis(chapters)
    except Exception as e:
        print(f"[STAGE 3] Error: {e}")
        import traceback
        traceback.print_exc()
        return _empty_synthesis(chapters)


def _fix_markdown_headers(text: str) -> str:
    """Fix markdown headers and remove timestamps."""
    if not text:
        return ""
    
    # Remove timestamp patterns
    text = re.sub(r'\(\d{2}:\d{2}:\d{2}(?:–\d{2}:\d{2}:\d{2})?\)', '', text)

    # 1. Promote "**Section Name**" to "## Section Name" for main sections
    # This prevents validation from failing if LLM uses bold instead of H2
    sections_to_fix = [
        "Meeting Tone", "Executive Overview", "Key Takeaways", 
        "Discussion Topics", "Aligned Thinking", "Divergent Perspectives"
    ]
    for section in sections_to_fix:
        # Replace **Section** or just Section (on its own line) with ## Section
        # Case insensitive match, but preserve Proper Case in replacement
        pattern = re.compile(r'^\s*(?:\*\*|##)?\s*' + re.escape(section) + r'(?:\*\*)?\s*$', re.MULTILINE | re.IGNORECASE)
        text = pattern.sub(f'## {section}', text)

    # Remove stray Decisions Made or Action Items sections (Legacy cleanup)
    text = re.sub(r'\n(?:\*\*|##)?\s*(?:\d+\.\s*)?(?:Decisions Made|Action Items)(?:\*\*|)?[\s\S]*?(?=\n(?:##|\*\*)|$)', '', text, flags=re.IGNORECASE)
    
    return text.strip()


def _normalize_synthesis(result: Dict[str, Any], original_chapters: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Normalize and validate synthesis output. Ensures all 6 sections exist."""
    
    REQUIRED_SECTIONS = [
        "Meeting Tone",
        "Executive Overview",
        "Key Takeaways",
        "Discussion Topics",
        "Aligned Thinking",
        "Divergent Perspectives"
    ]

    narrative_summary = result.get("narrative_summary", "")
    if not isinstance(narrative_summary, str):
        narrative_summary = ""
    
    # Check for missing sections
    missing_sections = []
    for section in REQUIRED_SECTIONS:
        # Check for ## Header
        patterns = [f"## {section}", f"# {section}"]
        found = any(p.lower() in narrative_summary.lower() for p in patterns)
        if not found:
            missing_sections.append(section)
    
    # Add placeholders for missing sections
    if missing_sections:
        print(f"[STAGE 3] WARNING: Missing sections: {missing_sections}")
        for section in missing_sections:
            if section == "Executive Overview":
                narrative_summary = f"## Executive Overview\n\nThis meeting covered key topics.\n\n" + narrative_summary
            else:
                narrative_summary += f"\n\n## {section}\n\n_Section content not available._"

    # Merge chapter summaries
    chapter_summaries = result.get("chapters", [])
    if not isinstance(chapter_summaries, list):
        chapter_summaries = []

    summary_map = {}
    for ch_summary in chapter_summaries:
        if isinstance(ch_summary, dict):
            chapter_id = ch_summary.get("chapter_id", "")
            summary = ch_summary.get("summary", "")
            if chapter_id and summary:
                summary_map[chapter_id] = summary

    final_chapters = []
    for ch in original_chapters:
        chapter_id = ch.get("chapter_id", "")
        # Priority: Stage 1 summary (from original_chapters) > Stage 3 summary > fallback
        stage1_summary = ch.get("summary", "")
        stage3_summary = summary_map.get(chapter_id, "")
        final_summary = stage1_summary or stage3_summary or "No summary available."
        
        final_chapters.append({
            "chapter_id": chapter_id,
            "title": ch.get("title", ""),
            "start_ms": ch.get("start_ms", 0),
            "end_ms": ch.get("end_ms", 0),
            "topic_keywords": ch.get("topic_keywords", []),
            "summary": final_summary
        })

    return {
        "narrative_summary": narrative_summary.strip(),
        "chapters": final_chapters
    }


def _empty_synthesis(chapters: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Return empty synthesis with chapter placeholders."""
    empty_chapters = []
    for ch in (chapters or []):
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
