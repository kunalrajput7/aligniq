"""
Stage 2: Deep Content Extraction
Extract action items, achievements, blockers, and Six Thinking Hats analysis.
This stage focuses on exhaustive extraction with evidence quotes.
CRITICAL FOCUS: Finding ALL action items comprehensively.
"""
from __future__ import annotations
import json
from typing import List, Dict, Any, Optional
from .common import call_ollama_cloud_async, _resolve_model, _fmt_local


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
4. Six Thinking Hats - cognitive analysis of participant contributions

**CRITICAL FOR ACTION ITEMS:**
- Review EVERY SINGLE utterance for commitments
- Look for patterns: "I will", "We should", "Need to", "Going to", "Let's", "Have to", "Must", "Should", "Can you", "Could you", "Would you"
- Include vague commitments (better to over-extract with lower confidence)
- Include both explicit and implicit action items
- If someone says they'll "look into it" or "check" something - that's an action item
- Tag each with the chapter_id where it was mentioned

**BETTER TO FIND 20 ACTION ITEMS THAN MISS 2 CRITICAL ONES.**"""

    user_prompt = f"""Analyze this meeting transcript and perform comprehensive extraction.

TRANSCRIPT:
{full_transcript}

CHAPTER STRUCTURE (for context and tagging):
{chapter_info}

Provide a JSON response with the following EXACT structure:

{{
  "action_items": [
    {{
      "task": "Clear, actionable description of what needs to be done",
      "owner": "Person Name" or "Unknown" or "Team",
      "deadline": "YYYY-MM-DD" or "Next week" or "ASAP" or "" (if not specified),
      "status": "pending",
      "confidence": "high" | "medium" | "low",
      "chapter_id": "ch1",
      "evidence": [
        {{"timestamp_ms": 120000, "quote": "Exact quote from transcript showing this commitment"}}
      ]
    }}
  ],

  "achievements": [
    {{
      "achievement": "Clear description of what was accomplished or completed",
      "members": ["Alice", "Bob"],
      "confidence": "high" | "medium" | "low",
      "evidence": [
        {{"timestamp_ms": 180000, "quote": "Exact quote showing this achievement"}}
      ]
    }}
  ],

  "blockers": [
    {{
      "blocker": "Clear description of the challenge, obstacle, or concern",
      "affected_members": ["Alice"] or [],
      "owner": "Person who might resolve it" or "",
      "confidence": "high" | "medium" | "low",
      "evidence": [
        {{"timestamp_ms": 240000, "quote": "Exact quote showing this blocker"}}
      ]
    }}
  ],

  "six_thinking_hats": {{
    "Alice": {{
      "white_hat": "Factual information and data Alice presented (objective facts)",
      "red_hat": "Emotions, feelings, intuitions Alice expressed (gut reactions)",
      "black_hat": "Risks, concerns, critical judgments Alice raised (devil's advocate)",
      "yellow_hat": "Benefits, optimism, positive perspectives Alice shared (what could go right)",
      "green_hat": "Creative ideas, alternatives, solutions Alice proposed (innovation)",
      "blue_hat": "Process control, organization, facilitation Alice provided (managing discussion)"
    }},
    "Bob": {{
      "white_hat": "...",
      "red_hat": "...",
      "black_hat": "...",
      "yellow_hat": "...",
      "green_hat": "...",
      "blue_hat": "..."
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
   - status: Always "pending" for new action items
   - confidence:
     * "high" = explicit commitment with clear owner
     * "medium" = implied commitment or unclear owner
     * "low" = vague mention but could be important
   - chapter_id: Which chapter this was mentioned in (use chapter boundaries)
   - evidence: Array of timestamp + exact quote showing this commitment

4. **DO NOT SKIP VAGUE COMMITMENTS** - include them with "low" confidence

**ACHIEVEMENTS:**
- What was COMPLETED, FINISHED, or ACCOMPLISHED (past tense)
- Examples: "We shipped the feature", "The bug is fixed", "I finished the analysis"
- Include who was involved (members)
- Provide evidence quotes with timestamps
- Confidence based on clarity

**BLOCKERS:**
- Challenges, obstacles, concerns, risks, problems discussed
- Examples: "We're blocked on API access", "Budget constraint", "Technical debt"
- Who is affected (affected_members)
- Who might resolve it (owner)
- Provide evidence quotes with timestamps
- Confidence based on severity/clarity

**SIX THINKING HATS:**
- Analyze EACH participant's contributions through 6 cognitive lenses
- Be specific and quote-based
- If a participant didn't exhibit a certain hat mode, write "No significant contributions in this mode"
- Focus on WHAT they said, not speculation

**QUALITY GUIDELINES:**
- Use ACTUAL timestamps from the transcript
- Quote EXACT text from transcript (don't paraphrase)
- Be comprehensive (especially for action items!)
- Better to include borderline items with low confidence than miss them
- Each evidence quote should clearly support the extracted item

Return ONLY valid JSON with no additional text."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        response_text = await call_ollama_cloud_async(_resolve_model(model), messages, json_mode=True)
        result = json.loads(response_text)

        # Normalize and validate
        result = _normalize_extraction(result)

        print(f"[STAGE 2] Extraction complete:")
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
                "status": str(item.get("status", "pending")).strip(),
                "confidence": str(item.get("confidence", "medium")).strip(),
                "chapter_id": str(item.get("chapter_id", "")).strip(),
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
                "members": item.get("members", []),
                "confidence": str(item.get("confidence", "medium")).strip(),
                "evidence": item.get("evidence", [])
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
                "affected_members": item.get("affected_members", []),
                "owner": str(item.get("owner", "")).strip(),
                "confidence": str(item.get("confidence", "medium")).strip(),
                "evidence": item.get("evidence", [])
            })

    # Normalize six thinking hats
    hats = result.get("six_thinking_hats", {})
    if not isinstance(hats, dict):
        hats = {}

    normalized_hats = {}
    for participant, hat_data in hats.items():
        if isinstance(hat_data, dict):
            normalized_hats[participant] = {
                "white_hat": str(hat_data.get("white_hat", "")).strip(),
                "red_hat": str(hat_data.get("red_hat", "")).strip(),
                "black_hat": str(hat_data.get("black_hat", "")).strip(),
                "yellow_hat": str(hat_data.get("yellow_hat", "")).strip(),
                "green_hat": str(hat_data.get("green_hat", "")).strip(),
                "blue_hat": str(hat_data.get("blue_hat", "")).strip()
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
