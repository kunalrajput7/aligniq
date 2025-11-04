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
    system_prompt = """You are an expert meeting analyst specializing in structured markdown documentation.

Your task is to:
1. Create a comprehensive EXECUTIVE SUMMARY in STRUCTURED MARKDOWN with BULLET POINTS
2. Write detailed 3-5 paragraph SUMMARIES for each chapter

**CRITICAL FORMATTING REQUIREMENTS:**
- ✅ MUST use bullet points (-) for all lists - this is MANDATORY
- ✅ DO NOT write flowing paragraph text under topic sections
- ✅ Each bullet = one specific, concrete point with details (names, dates, numbers)
- ✅ Use ## headings for topic subsections within Key Discussion Topics
- ✅ Use **bold** for main section headers
- ✅ Be specific: include WHO said/decided WHAT, WHEN, WHY, HOW

**CONTENT INSTRUCTIONS:**
- Action items, achievements, and blockers are ALREADY EXTRACTED - don't duplicate them
- Reference them naturally if needed (e.g., "Bob was assigned deployment task")
- Focus on SUBSTANCE: decisions, discussions, problems, solutions, technical details
- Skip trivial details: connection issues, "can you hear me", setup problems
- Make it comprehensive and detailed with concrete specifics"""

    user_prompt = f"""Analyze this meeting transcript and create narrative summaries.

⚠️ IMPORTANT: The narrative_summary MUST use BULLET POINTS (-) for all lists. DO NOT write flowing paragraphs under topic sections. Follow the format EXACTLY as shown in the examples below.

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

The narrative_summary MUST follow this EXACT structure. DO NOT write flowing paragraphs - use BULLET POINTS:

```markdown
**Meeting Overview**
A brief 2-3 sentence paragraph describing the meeting's purpose and primary objectives. Skip trivial details like connection issues.

**Key Discussion Topics**
Break discussions into clear subsections with ## headings. Each topic MUST use bullet points:

## [Topic Name 1]
- Specific point about what was discussed
- Key technical details, numbers, dates, or metrics
- Who led or contributed significantly to this discussion
- Any decisions, conclusions, or outcomes from this topic
- Additional relevant details or context

## [Topic Name 2]
- Specific point about this topic area
- Technical details and concrete specifics
- Contributors and their key perspectives or proposals
- Outcomes, next steps, or unresolved questions
- Additional insights or connections to other topics

(Continue for all major topics – typically 2-5 main discussion areas)

**Decisions Made**
- Decision 1: Brief description with who made it and why
- Decision 2: Include context and rationale for the decision
- Decision 3: Note any conditions, dependencies, or follow-up required
- (Continue for all significant decisions)

**Concerns & Challenges**
- Concern 1: Brief description of the risk or challenge
- Proposed solution or mitigation approach (if discussed)
- Concern 2: Another risk or blocker mentioned
- Any unresolved concerns requiring follow-up action
- (Continue for all concerns raised)
```

**CRITICAL FORMATTING RULES - FOLLOW EXACTLY:**
1. ✅ Use **Bold** for main section headers: **Meeting Overview**, **Key Discussion Topics**, **Decisions Made**, **Concerns & Challenges**
2. ✅ Use ## for topic subsections ONLY within Key Discussion Topics (e.g., ## Project Timeline, ## Budget Discussion)
3. ✅ Use bullet points (-) for ALL lists in ALL sections - MANDATORY
4. ✅ Each bullet point should be ONE clear, complete idea (1-2 sentences max)
5. ✅ DO NOT write flowing narrative paragraphs under topics - ONLY bullet points
6. ✅ DO NOT write multi-paragraph text blocks - break into bullets
7. ✅ Skip trivial details: connection issues, "can you hear me", technical setup problems
8. ✅ Focus on SUBSTANCE: decisions, discussions, problems, solutions, technical details
9. ✅ Reference action items/achievements naturally if needed (e.g., "Bob was assigned to deploy the API") but don't create duplicate lists
10. ✅ Make every bullet count - include specific details, names, dates, numbers

**EXAMPLE OF CORRECT FORMAT:**
```markdown
**Meeting Overview**
The team discussed Q4 product launch timeline and resource allocation. Primary goal was to align engineering and marketing on deliverables and identify blockers.

**Key Discussion Topics**

## Product Launch Timeline
- Target launch date confirmed as December 15, 2024
- Engineering team (led by Sarah) needs 6 weeks for final testing
- Marketing (Bob) requires 2 weeks advance notice for campaign prep
- Risk identified: holiday season may impact customer onboarding
- Decision to add buffer week for contingencies

## Resource Allocation
- Current team: 3 engineers, 2 designers, 1 PM
- Need to hire additional QA engineer by November 1
- Budget approved for contractor support ($50K)
- Design team requested Figma enterprise license
- Agreement reached to reallocate sprint capacity

**Decisions Made**
- Launch date set for December 15, 2024 (decision by VP Product)
- Hire QA engineer with budget approval from Finance
- Approve Figma enterprise license ($500/month)
- Reallocate 30% of sprint capacity to launch prep starting next week

**Concerns & Challenges**
- Holiday timing may reduce initial user engagement (Sarah)
- Proposed solution: extend onboarding period to January
- QA hiring timeline is tight (only 3 weeks)
- Budget constraints may limit contractor hours
- API integration with legacy system still unresolved
```

**WHAT NOT TO DO - EXAMPLES OF WRONG FORMAT:**
❌ Writing paragraphs: "The team engaged in a comprehensive discussion about the product launch timeline. They explored various aspects including the target date, resource requirements, and potential risks. Sarah from engineering provided valuable input..."
❌ NO BULLET POINTS: Just writing flowing text
❌ Vague bullets: "Discussed timeline" (too vague - be specific!)
❌ Missing names: "Someone mentioned budget" (who? be specific!)
❌ Missing details: "Date was decided" (what date? when? by whom?)

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
