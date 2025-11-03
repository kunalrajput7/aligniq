"""
Stage Unified: Single comprehensive meeting analysis leveraging large context windows.

This stage replaces Stages 1-4 with a single API call that extracts all insights at once:
- Meeting metadata (title, date, participants)
- Executive narrative summary
- Action items with deadlines
- Achievements with evidence
- Blockers with responsible parties
- Six Thinking Hats analysis
- Chapters/themes
- Timeline key points

Leverages modern LLMs' large input context for complete meeting analysis.
"""
from __future__ import annotations
import json
from typing import List, Dict, Optional
from .common import call_ollama_cloud_async, _fmt_local


UNIFIED_SYSTEM_PROMPT = """You are an expert meeting analyst. You will receive a complete meeting transcript and must provide a comprehensive analysis in a single JSON response.

Your analysis should be thorough, accurate, and well-structured. Extract all relevant information and insights from the entire meeting."""


def _build_unified_prompt(utterances: List[Dict]) -> str:
    """Build comprehensive prompt for unified analysis."""

    # Format utterances with timestamps and speakers
    transcript_lines = []
    for utt in utterances:
        timestamp = _fmt_local(utt["start_ms"])
        speaker = utt.get("speaker", "Unknown")
        text = utt["text"]
        transcript_lines.append(f"[{timestamp}] {speaker}: {text}")

    transcript_text = "\n".join(transcript_lines)

    # Calculate meeting duration
    if utterances:
        duration_ms = utterances[-1]["end_ms"]
        duration_formatted = _fmt_local(duration_ms)
    else:
        duration_ms = 0
        duration_formatted = "00:00:00.000"

    prompt = f"""Analyze this complete meeting transcript and provide a comprehensive JSON response.

MEETING TRANSCRIPT:
{transcript_text}

MEETING METADATA:
- Total Duration: {duration_formatted}
- Total Utterances: {len(utterances)}

Provide a JSON response with the following structure:

{{
  "meeting_details": {{
    "title": "Meeting title (infer from content)",
    "date": "YYYY-MM-DD (infer from content or use 'Unknown')",
    "duration_ms": {duration_ms},
    "participants": ["participant1", "participant2", ...]
  }},

  "narrative_summary": "Follow these instructions EXACTLY to build the markdown summary:\n\n**CRITICAL**: Use Markdown formatting with bold section titles and organized content.\n**CRITICAL**: Focus ONLY on the main topics - skip minor issues like connection problems, audio issues, or trivial digressions.\n**CRITICAL**: Be concise but comprehensive - cover the key meeting topics in depth.\n**CRITICAL**: Do NOT create standalone lists of achievements, blockers, or evidence quotes in this summary (those are provided elsewhere). Mention them only if they are essential context within another bullet. You MUST still populate the structured JSON arrays (action_items, achievements, blockers, timeline, chapters, hats, etc.) with all relevant items.\n\nFormat the narrative_summary as follows:\n\n**Meeting Overview**\n- 2-3 sentences covering: What was this meeting about? What were the primary goals or objectives?\n- Skip unnecessary details like connection issues, technical setup, or small talk.\n\n**Key Discussion Topics**\nBreak this into subsections with **Bold Topic Titles** (use ## for major topics in markdown):\n\n## [Topic Name 1]\n- What was discussed about this topic\n- Key points, technical details, numbers, dates\n- Who contributed or led the discussion\n- Any decisions or conclusions reached\n\n## [Topic Name 2]\n- What was discussed about this topic\n- Technical details and specifics\n- Contributors and their perspectives\n- Outcomes or next steps\n\n(Continue for all major topics – typically 2-5 main topics per meeting)\n\n**Decisions Made**\n- List key decisions with decision-makers (if mentioned)\n- Include context: why the decision was made\n- Note any conditions or dependencies\n\n**Concerns & Challenges**\n- Surface any risks, blockers, or challenges discussed (briefly reference only when necessary)\n- Include proposed solutions or mitigation strategies\n- Note unresolved concerns requiring follow-up\n\n**Next Steps**\n- Clear action items and immediate next steps\n- Timelines or deadlines mentioned\n- Expected outcomes or deliverables\n\nFormatting rules:\n1. Use **Bold** for section headers and key terms\n2. Use ## for major topic subsections\n3. Use bullet points (-) for lists and sub-points\n4. Keep paragraphs short (2-4 sentences max)\n5. Group related points together\n6. Skip trivial details (connection issues, \"can you hear me\", technical setup, etc.)\n7. Focus on SUBSTANCE: what decisions were made, what was discussed, what problems were identified, what solutions were proposed.",

  "action_items": [
    {{
      "task": "Clear description of the action item",
      "owner": "Person responsible (or 'Unassigned')",
      "deadline": "YYYY-MM-DD or 'No deadline specified'",
      "status": "pending",
      "timestamp_ms": 123456,
      "confidence": "high/medium/low"
    }}
  ],

  "achievements": [
    {{
      "achievement": "What was accomplished",
      "members": ["person1", "person2"],
      "evidence": [
        {{
          "t": "HH:MM:SS",
          "quote": "Relevant quote from the meeting"
        }}
      ],
      "confidence": "high/medium/low"
    }}
  ],

  "blockers": [
    {{
      "blocker": "Description of the blocker or challenge",
      "affected_members": ["person1"],
      "owner": "Person who will address it (or 'Unassigned')",
      "evidence": [
        {{
          "t": "HH:MM:SS",
          "quote": "Relevant quote from the meeting"
        }}
      ],
      "confidence": "high/medium/low"
    }}
  ],

  "six_thinking_hats": {{
    "participant1": {{
      "white_hat": "Facts and information shared",
      "red_hat": "Emotions and feelings expressed",
      "black_hat": "Critical judgments and risks identified",
      "yellow_hat": "Positive aspects and benefits highlighted",
      "green_hat": "Creative ideas and alternatives proposed",
      "blue_hat": "Process control and meta-thinking demonstrated"
    }},
    "participant2": {{ ... }}
  }},

  "chapters": [
    {{
      "title": "Chapter title describing the topic",
      "summary": "COMPREHENSIVE summary (3-5 paragraphs in markdown format) covering:\n- Main topics and themes discussed\n- Key decisions or outcomes\n- Important details, context, and nuances\n- Participants involved and their contributions\n- Any action items or follow-ups mentioned\n\nUse **bold** for emphasis, bullet points for lists, and proper paragraph breaks.",
      "start_ms": 0,
      "end_ms": 180000,
      "segments": [0, 1, 2]
    }}
  ],

  "timeline": [
    {{
      "timestamp_ms": 123456,
      "text": "Key point or decision made at this time",
      "speakers": ["person1", "person2"]
    }}
  ]
}}

IMPORTANT GUIDELINES:
1. Be comprehensive - extract ALL action items, achievements, and blockers mentioned
2. Use actual quotes for evidence fields
3. Set confidence based on clarity: "high" if explicitly stated, "medium" if inferred from context, "low" if uncertain
4. For Six Thinking Hats, analyze each participant's contributions across all six perspectives
5. Create chapters that group related topics/discussions (typically 3-7 chapters per meeting)
6. Timeline should have 8-15 key moments throughout the meeting
7. If information is not available, use "Unknown" or "Not specified" rather than making assumptions
8. Ensure all timestamps are in milliseconds and valid

**MARKDOWN FORMATTING REQUIREMENTS:**
9. narrative_summary: MUST use proper markdown with ## headings, ### subheadings, **bold**, *italic*, bullet points, and paragraph breaks
10. chapter summaries: MUST be detailed (3-5 paragraphs each) with markdown formatting, covering all nuances and context
11. Make the output readable and well-structured - use whitespace and formatting to enhance clarity

Return ONLY the JSON object, no additional text."""

    return prompt


async def run_unified_analysis_async(
    utterances: List[Dict],
    model: Optional[str] = None
) -> Dict:
    """
    Run comprehensive unified analysis on complete meeting transcript.

    Args:
        utterances: Complete list of meeting utterances
        model: Optional model name override

    Returns:
        Dictionary with all meeting insights
    """
    print("\n[UNIFIED STAGE] Starting comprehensive meeting analysis...")
    print(f"[UNIFIED STAGE] Processing {len(utterances)} utterances")

    # Build comprehensive prompt
    user_prompt = _build_unified_prompt(utterances)

    messages = [
        {"role": "system", "content": UNIFIED_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]

    # Log prompt statistics
    total_chars = len(UNIFIED_SYSTEM_PROMPT) + len(user_prompt)
    estimated_tokens = total_chars // 4  # Rough estimate: 1 token ≈ 4 chars
    print(f"[UNIFIED STAGE] Prompt size: {total_chars:,} chars (~{estimated_tokens:,} tokens)")
    print(f"[UNIFIED STAGE] Within model's context limit: {estimated_tokens < 100_000}")

    try:
        print("[UNIFIED STAGE] Sending single API call for comprehensive analysis...")

        # Add retry logic for transient 503 errors
        max_retries = 3
        retry_delay = 5  # seconds

        for attempt in range(1, max_retries + 1):
            try:
                response_text = await call_ollama_cloud_async(
                    model=model,
                    messages=messages,
                    json_mode=True
                )
                break  # Success, exit retry loop
            except RuntimeError as e:
                error_msg = str(e)
                if "503" in error_msg and attempt < max_retries:
                    print(f"[UNIFIED STAGE] Attempt {attempt} failed with 503, retrying in {retry_delay}s...")
                    import asyncio
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    raise  # Re-raise if not 503 or last attempt

        print(f"[UNIFIED STAGE] Received response ({len(response_text)} chars)")

        # Parse JSON response
        try:
            result = json.loads(response_text)
            print("[UNIFIED STAGE] Successfully parsed JSON response")
        except json.JSONDecodeError as e:
            print(f"[UNIFIED STAGE] JSON parsing error: {e}")
            print(f"[UNIFIED STAGE] Response preview: {response_text[:500]}")
            raise ValueError(f"Failed to parse LLM response as JSON: {e}")

        # Validate structure
        required_keys = [
            "meeting_details", "narrative_summary", "action_items",
            "achievements", "blockers", "six_thinking_hats", "chapters", "timeline"
        ]

        missing_keys = [key for key in required_keys if key not in result]
        if missing_keys:
            print(f"[UNIFIED STAGE] Warning: Missing keys in response: {missing_keys}")
            # Add empty structures for missing keys
            defaults = {
                "meeting_details": {
                    "title": "Meeting Analysis",
                    "date": "Unknown",
                    "duration_ms": utterances[-1]["end_ms"] if utterances else 0,
                    "participants": list(set(u.get("speaker", "Unknown") for u in utterances))
                },
                "narrative_summary": "Analysis not available",
                "action_items": [],
                "achievements": [],
                "blockers": [],
                "six_thinking_hats": {},
                "chapters": [],
                "timeline": []
            }
            for key in missing_keys:
                result[key] = defaults.get(key, {})

        # Log statistics
        print(f"[UNIFIED STAGE] Extracted:")
        print(f"  - Meeting: {result['meeting_details'].get('title', 'N/A')}")
        print(f"  - Participants: {len(result['meeting_details'].get('participants', []))}")
        print(f"  - Action Items: {len(result.get('action_items', []))}")
        print(f"  - Achievements: {len(result.get('achievements', []))}")
        print(f"  - Blockers: {len(result.get('blockers', []))}")
        print(f"  - Six Thinking Hats: {len(result.get('six_thinking_hats', {}))}")
        print(f"  - Chapters: {len(result.get('chapters', []))}")
        print(f"  - Timeline Points: {len(result.get('timeline', []))}")

        print("[UNIFIED STAGE] Comprehensive analysis complete!")
        return result

    except Exception as e:
        print(f"[UNIFIED STAGE] Error during analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        raise RuntimeError(f"Unified analysis failed: {str(e)}")


def run_unified_analysis(
    utterances: List[Dict],
    model: Optional[str] = None
) -> Dict:
    """
    Synchronous wrapper for unified analysis.

    Args:
        utterances: Complete list of meeting utterances
        model: Optional model name override

    Returns:
        Dictionary with all meeting insights
    """
    import asyncio
    return asyncio.run(run_unified_analysis_async(utterances, model))


