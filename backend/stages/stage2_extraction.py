"""
Stage 2: Deep Content Extraction
Extract action items, achievements, blockers, and Six Thinking Hats analysis.
This stage focuses on exhaustive extraction with evidence quotes.
CRITICAL FOCUS: Finding ALL action items comprehensively.
"""
from __future__ import annotations
import json
from typing import List, Dict, Any, Optional
from .common import call_ollama_cloud_async, _resolve_model, _fmt_local, STAGE2_MODEL, STAGE2_ENDPOINT, STAGE2_KEY


async def run_extraction_stage_async(
    utterances: List[Dict[str, Any]],
    chapters: List[Dict[str, Any]],
    model: Optional[str] = None
) -> Dict[str, Any]:
    """
    Stage 2: Extract action items, achievements, blockers, and Six Thinking Hats.

    Args:
        utterances: List of {speaker, text, start_ms, end_ms}
        chapters: Chapter boundaries from Stage 1
        model: Optional model override

    Returns:
        {
            "action_items": [{task, owner, deadline, status, confidence, chapter_id, evidence}],
            "achievements": [{achievement, members, confidence, evidence}],
            "blockers": [{blocker, affected_members, owner, confidence, evidence}],
            "six_thinking_hats": {participant: {white_hat, red_hat, black_hat, yellow_hat, green_hat, blue_hat}}
        }
    """
    if not utterances:
        return _empty_extraction()

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

    # Build chapter reference for context
    chapter_info = "\n".join([
        f"- {ch.get('chapter_id', 'ch')}: {ch.get('title', 'Chapter')} "
        f"({_fmt_local(ch.get('start_ms', 0))} - {_fmt_local(ch.get('end_ms', 0))})"
        for ch in chapters
    ])

    # Build prompt
    system_prompt = """You are an expert meeting analyst specializing in comprehensive extraction.

Your task is to perform EXHAUSTIVE extraction of:
1. **ACTION ITEMS** - Your MOST CRITICAL task - find EVERY commitment, task, and follow-up
2. Achievements - what was completed or accomplished
3. Blockers - challenges, obstacles, or concerns raised
4. Six Thinking Hats - identify the DOMINANT thinking style of each participant

**CRITICAL FOR ACTION ITEMS:**
- Review EVERY SINGLE utterance for commitments
- Look for patterns: "I will", "We should", "Need to", "Going to", "Let's", "Have to", "Must", "Should", "Can you", "Could you", "Would you"
- Include vague commitments (better to over-extract)
- Include both explicit and implicit action items
- If someone says they'll "look into it" or "check" something - that's an action item

**BETTER TO FIND 20 ACTION ITEMS THAN MISS 2 CRITICAL ONES.**"""

    user_prompt = f"""Analyze this meeting transcript and perform comprehensive extraction.

TRANSCRIPT:
{full_transcript}

CHAPTER STRUCTURE (for context):
{chapter_info}

Provide a JSON response with the following EXACT structure:

{{
  "action_items": [
    {{
      "task": "Clear, actionable description of what needs to be done",
      "owner": "Person Name" or "Unknown" or "Team",
      "deadline": "YYYY-MM-DD" or "Next week" or "ASAP" or "" (if not specified),
      "evidence": [
        {{"timestamp_ms": 120000, "quote": "Exact quote from transcript showing this commitment"}}
      ]
    }}
  ],

  "achievements": [
    {{
      "achievement": "Clear description of what was accomplished or completed",
      "members": ["Alice", "Bob"]
    }}
  ],

  "blockers": [
    {{
      "blocker": "Clear description of the challenge, obstacle, or concern",
      "affected_members": ["Alice"] or []
    }}
  ],

  "six_thinking_hats": {{
    "Alice": {{
      "dominant_hat": "white",
      "evidence": "Brief explanation of why this is their dominant thinking style based on their contributions"
    }},
    "Bob": {{
      "dominant_hat": "green",
      "evidence": "Brief explanation of why this is their dominant thinking style"
    }}
  }}
}}

DETAILED INSTRUCTIONS:

**ACTION ITEMS (MOST CRITICAL):**
1. **Review EVERY single line** of the transcript for commitments
2. Look for these patterns:
   - Explicit: "I will send the report by Friday"
   - Implicit: "Let me check with the team" (action = check with team, owner = speaker)
   - Questions: "Can you review this?" (action = review, owner = person asked)
   - Assignments: "Bob should handle deployment" (action = handle deployment, owner = Bob)
   - Group: "We need to fix the bug" (action = fix bug, owner = Team/Unknown)

3. For EACH action item:
   - task: Make it clear and actionable ("Send Q4 report to stakeholders")
   - owner: WHO will do it (extract from context, use "Unknown" if unclear)
   - deadline: WHEN it's due (extract if mentioned, "" if not)
   - evidence: Array of timestamp + exact quote showing this commitment

**ACHIEVEMENTS:**
- What was COMPLETED, FINISHED, or ACCOMPLISHED (past tense)
- Examples: "We shipped the feature", "The bug is fixed", "I finished the analysis"
- Include who was involved (members)

**BLOCKERS:**
- Challenges, obstacles, concerns, risks, problems discussed
- Examples: "We're blocked on API access", "Budget constraint", "Technical debt"
- Who is affected (affected_members)

**SIX THINKING HATS:**
Identify the ONE DOMINANT thinking style for each participant based on their overall contributions:
- **White Hat**: Focuses on data, facts, and information (analytical and objective)
- **Red Hat**: Focuses on emotions, feelings, and intuition (expressive and instinctive)
- **Black Hat**: Focuses on caution, difficulties, and critical thinking (risk-aware)
- **Yellow Hat**: Focuses on positivity, benefits, and optimism (highlights opportunities)
- **Green Hat**: Focuses on creativity, alternatives, and new ideas (innovative thinking)
- **Blue Hat**: Focuses on process, control, and organization (strategic planning)

For each participant, determine which ONE hat best describes their primary contribution style throughout the meeting.

**QUALITY GUIDELINES:**
- Quote EXACT text from transcript (don't paraphrase)
- Be comprehensive (especially for action items!)
- Better to include borderline items than miss them
- Each evidence quote should clearly support the extracted item

Return ONLY valid JSON with no additional text."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        import time
        start_time = time.time()

        # Use stage-specific model configuration
        # Stage 2: Extraction with reasoning (GPT-5 Mini for better Six Thinking Hats analysis)
        stage_model = model if model else STAGE2_MODEL
        print(f"[STAGE 2] Starting structured extraction...")
        print(f"[STAGE 2] Model: {stage_model}")

        # GPT-5 Nano and GPT-5 Mini only support default temperature (1.0)
        # Skip temperature parameter for both models
        temp = None if ("nano" in stage_model.lower() or "mini" in stage_model.lower()) else 0.3

        response_text = await call_ollama_cloud_async(
            model=stage_model,
            messages=messages,
            json_mode=True,
            endpoint=STAGE2_ENDPOINT,
            api_key=STAGE2_KEY,
            temperature=temp  # Moderate temperature for consistent extraction with some reasoning (if supported)
            # No max_tokens limit - let model use as many tokens as needed for reasoning + output
        )
        result = json.loads(response_text)

        # Normalize and validate
        result = _normalize_extraction(result)

        elapsed_time = time.time() - start_time
        print(f"[STAGE 2] ✓ Structured extraction complete in {elapsed_time:.2f}s")
        print(f"  - Action items: {len(result.get('action_items', []))}")
        print(f"  - Achievements: {len(result.get('achievements', []))}")
        print(f"  - Blockers: {len(result.get('blockers', []))}")
        print(f"  - Participants analyzed: {len(result.get('six_thinking_hats', {}))}")

        return result

    except json.JSONDecodeError as e:
        print(f"[STAGE 2] JSON decode error: {e}")
        print(f"[STAGE 2] Response text: {response_text[:500]}")
        return _empty_extraction()
    except Exception as e:
        print(f"[STAGE 2] Error: {e}")
        import traceback
        traceback.print_exc()
        return _empty_extraction()


def _normalize_extraction(result: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize and validate extraction stage output."""

    # Normalize action items
    action_items = result.get("action_items", [])
    if not isinstance(action_items, list):
        action_items = []

    normalized_actions = []
    for item in action_items:
        if isinstance(item, dict) and item.get("task"):
            normalized_actions.append({
                "task": str(item.get("task", "")).strip(),
                "owner": str(item.get("owner", "Unknown")).strip(),
                "deadline": str(item.get("deadline", "")).strip(),
                "evidence": item.get("evidence", [])
            })

    # Normalize achievements
    achievements = result.get("achievements", [])
    if not isinstance(achievements, list):
        achievements = []

    normalized_achievements = []
    for item in achievements:
        if isinstance(item, dict) and item.get("achievement"):
            normalized_achievements.append({
                "achievement": str(item.get("achievement", "")).strip(),
                "members": item.get("members", [])
            })

    # Normalize blockers
    blockers = result.get("blockers", [])
    if not isinstance(blockers, list):
        blockers = []

    normalized_blockers = []
    for item in blockers:
        if isinstance(item, dict) and item.get("blocker"):
            normalized_blockers.append({
                "blocker": str(item.get("blocker", "")).strip(),
                "affected_members": item.get("affected_members", [])
            })

    # Normalize six thinking hats
    hats = result.get("six_thinking_hats", {})
    if not isinstance(hats, dict):
        hats = {}

    normalized_hats = {}
    for participant, hat_data in hats.items():
        if isinstance(hat_data, dict):
            normalized_hats[participant] = {
                "dominant_hat": str(hat_data.get("dominant_hat", "white")).strip(),
                "evidence": str(hat_data.get("evidence", "")).strip()
            }

    return {
        "action_items": normalized_actions,
        "achievements": normalized_achievements,
        "blockers": normalized_blockers,
        "six_thinking_hats": normalized_hats
    }


def _empty_extraction() -> Dict[str, Any]:
    """Return empty extraction structure."""
    return {
        "action_items": [],
        "achievements": [],
        "blockers": [],
        "six_thinking_hats": {}
    }


def run_extraction_stage(utterances: List[Dict[str, Any]], chapters: List[Dict[str, Any]], model: Optional[str] = None) -> Dict[str, Any]:
    """Synchronous wrapper for extraction stage."""
    import asyncio
    return asyncio.run(run_extraction_stage_async(utterances, chapters, model))
