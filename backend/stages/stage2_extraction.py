"""
Stage 2: Deep Content Extraction
Extract action items, achievements, blockers, and Six Thinking Hats analysis.
This stage focuses on exhaustive extraction with evidence from the transcript.
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
            "action_items": [{task, owner, deadline, priority, evidence}],
            "achievements": [{achievement, members, evidence}],
            "blockers": [{blocker, severity, affected_members, evidence}],
            "six_thinking_hats": {participant: {dominant_hat, explanation}}
        }
    """
    if not utterances:
        return _empty_extraction()

    # Build transcript with speaker labels for evidence extraction
    transcript_lines = []
    for utt in utterances:
        speaker = utt.get("speaker", "Unknown")
        text = utt.get("text", "").strip()
        if text:
            transcript_lines.append(f"{speaker}: {text}")

    full_transcript = "\n".join(transcript_lines)

    # Build chapter reference for context
    chapter_info = "\n".join([
        f"- {ch.get('chapter_id', 'ch')}: {ch.get('title', 'Chapter')}"
        for ch in chapters
    ])

    # Optimized system prompt
    system_prompt = """You are an expert meeting analyst specializing in actionable insights extraction.

Your primary objectives (in order of importance):
1. ACTION ITEMS - Find EVERY task, commitment, and follow-up. Miss nothing.
2. ACHIEVEMENTS - Identify completed work and accomplishments
3. BLOCKERS - Surface challenges, risks, and obstacles
4. THINKING STYLES - Analyze each participant's dominant thinking approach

Critical rules:
- Extract evidence as exact quotes with speaker names (no timestamps)
- Better to over-extract than miss important items
- Be specific and actionable in descriptions
- Assign priority levels based on urgency cues"""

    user_prompt = f"""Analyze this meeting transcript and extract all actionable content and group dynamics.

TRANSCRIPT:
{full_transcript}

CHAPTERS:
{chapter_info}

Return a JSON object with this EXACT structure:

{{
  "tone": {{
    "overall": "collaborative | tense | productive | formal | casual | energetic | subdued",
    "energy": "high | medium | low",
    "description": "1-2 sentence description of meeting atmosphere and how it evolved"
  }},
  "convergent_points": [
    {{
      "topic": "What everyone agreed on",
      "agreed_by": ["Speaker1", "Speaker2"],
      "evidence": {{
        "speaker": "Who voiced the agreement",
        "quote": "Exact quote showing consensus"
      }}
    }}
  ],
  "divergent_points": [
    {{
      "topic": "What topic had different opinions",
      "perspectives": [
        {{"speaker": "Person1", "view": "Their position or preference"}},
        {{"speaker": "Person2", "view": "Their contrasting position"}}
      ],
      "resolution": "How it was resolved, or 'Unresolved' if still open"
    }}
  ],
  "action_items": [
    {{
      "task": "Clear, specific description of what needs to be done",
      "owner": "Person Name (or 'Team' if group, 'Unassigned' if unclear)",
      "deadline": "Specific date, 'This week', 'ASAP', or '' if not specified",
      "priority": "high, medium, or low",
      "evidence": {{
        "speaker": "Who said it",
        "quote": "Exact words from transcript showing the commitment"
      }}
    }}
  ],
  "achievements": [
    {{
      "achievement": "Clear description of what was completed",
      "members": ["Who accomplished it"],
      "evidence": {{
        "speaker": "Who mentioned it",
        "quote": "Exact words confirming the achievement"
      }}
    }}
  ],
  "blockers": [
    {{
      "blocker": "Clear description of the challenge or obstacle",
      "severity": "critical, major, or minor",
      "affected_members": ["Who is impacted"],
      "evidence": {{
        "speaker": "Who raised it",
        "quote": "Exact words describing the blocker"
      }}
    }}
  ],
  "six_thinking_hats": {{
    "PersonName": {{
      "dominant_hat": "white|red|black|yellow|green|blue",
      "explanation": "Why this hat based on their contributions"
    }}
  }}
}}

EXTRACTION RULES:

TONE ANALYSIS:
- overall: Assess the dominant emotional quality of interactions
- energy: How animated/engaged were participants?
- description: Note if tone shifted during the meeting (e.g., "Started formal, became collaborative after ice-breaker")

CONVERGENT POINTS (Where everyone aligned):
- Look for explicit agreement: "I agree", "That makes sense", "We're all on the same page"
- Look for unanimous decisions or shared conclusions
- Include 2-5 key points where the team reached consensus

DIVERGENT POINTS (Where opinions differed):
- Look for disagreement: "I think differently", "On the other hand", "I'm not sure about that"
- Look for debates, alternative proposals, or competing priorities
- Include resolution if one was reached during the meeting

ACTION ITEMS (Most Critical - be thorough):
- Scan EVERY line for commitments using these patterns:
  * "I will...", "I'll...", "Let me..."
  * "We should...", "We need to...", "We have to..."
  * "Can you...?", "Could you...?", "Would you...?"
  * "Someone should...", "This needs to..."
- task: Make it actionable (verb + object + context)
- owner: Extract from "I will" (speaker) or "Can you" (person asked)
- priority: high (urgent/blocking), medium (important), low (nice-to-have)
- evidence: Include speaker name and their exact quote

ACHIEVEMENTS:
- Look for past-tense completions: "finished", "completed", "shipped", "fixed", "deployed"
- Include who was involved in the accomplishment

BLOCKERS:
- Identify: risks, concerns, obstacles, dependencies, constraints
- severity: critical (blocking progress), major (significant impact), minor (inconvenience)
- Flag anything that could delay or prevent success

SIX THINKING HATS (assign ONE dominant hat per participant):
- White: Facts, data, information-focused (analytical)
- Red: Emotions, feelings, intuition (expressive)
- Black: Caution, risks, critical thinking (cautious)
- Yellow: Optimism, benefits, opportunities (positive)
- Green: Creativity, alternatives, new ideas (innovative)
- Blue: Process, organization, control (facilitative)

Return ONLY valid JSON."""

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    try:
        import time
        start_time = time.time()

        stage_model = model if model else STAGE2_MODEL
        print(f"[STAGE 2] Starting deep extraction...")
        print(f"[STAGE 2] Model: {stage_model}")

        response_text = await call_ollama_cloud_async(
            model=stage_model,
            messages=messages,
            json_mode=True,
            endpoint=STAGE2_ENDPOINT,
            api_key=STAGE2_KEY
        )
        result = json.loads(response_text)

        # Normalize and validate
        result = _normalize_extraction(result)

        elapsed_time = time.time() - start_time
        print(f"[STAGE 2] ✓ Deep extraction complete in {elapsed_time:.2f}s")
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
            evidence = item.get("evidence", {})
            if isinstance(evidence, list) and len(evidence) > 0:
                evidence = evidence[0]  # Take first if array
            
            # Normalize priority to valid values: high, medium, low
            priority_raw = str(item.get("priority", "medium")).lower().strip()
            priority_map = {
                "high": "high", "medium": "medium", "low": "low",
                "urgent": "high", "critical": "high", "important": "high",
                "normal": "medium", "moderate": "medium",
                "minor": "low", "trivial": "low", "nice-to-have": "low"
            }
            priority = priority_map.get(priority_raw, "medium")
            
            normalized_actions.append({
                "task": str(item.get("task", "")).strip(),
                "owner": str(item.get("owner", "Unassigned")).strip(),
                "deadline": str(item.get("deadline", "")).strip(),
                "priority": priority,
                "evidence": {
                    "speaker": evidence.get("speaker", "") if isinstance(evidence, dict) else "",
                    "quote": evidence.get("quote", "") if isinstance(evidence, dict) else ""
                }
            })

    # Normalize achievements
    achievements = result.get("achievements", [])
    if not isinstance(achievements, list):
        achievements = []

    normalized_achievements = []
    for item in achievements:
        if isinstance(item, dict) and item.get("achievement"):
            evidence = item.get("evidence", {})
            if isinstance(evidence, list) and len(evidence) > 0:
                evidence = evidence[0]
            
            normalized_achievements.append({
                "achievement": str(item.get("achievement", "")).strip(),
                "members": item.get("members", []),
                "evidence": {
                    "speaker": evidence.get("speaker", "") if isinstance(evidence, dict) else "",
                    "quote": evidence.get("quote", "") if isinstance(evidence, dict) else ""
                }
            })

    # Normalize blockers
    blockers = result.get("blockers", [])
    if not isinstance(blockers, list):
        blockers = []

    normalized_blockers = []
    for item in blockers:
        if isinstance(item, dict) and item.get("blocker"):
            evidence = item.get("evidence", {})
            if isinstance(evidence, list) and len(evidence) > 0:
                evidence = evidence[0]
            
            # Normalize severity to valid values: critical, major, minor
            severity_raw = str(item.get("severity", "major")).lower().strip()
            severity_map = {
                "critical": "critical", "major": "major", "minor": "minor",
                "high": "critical", "severe": "critical", "blocking": "critical",
                "medium": "major", "moderate": "major", "significant": "major",
                "low": "minor", "trivial": "minor", "inconvenience": "minor"
            }
            severity = severity_map.get(severity_raw, "major")
            
            normalized_blockers.append({
                "blocker": str(item.get("blocker", "")).strip(),
                "severity": severity,
                "affected_members": item.get("affected_members", []),
                "evidence": {
                    "speaker": evidence.get("speaker", "") if isinstance(evidence, dict) else "",
                    "quote": evidence.get("quote", "") if isinstance(evidence, dict) else ""
                }
            })

    # Normalize six thinking hats
    hats = result.get("six_thinking_hats", {})
    if not isinstance(hats, dict):
        hats = {}

    normalized_hats = {}
    for participant, hat_data in hats.items():
        if isinstance(hat_data, dict):
            normalized_hats[participant] = {
                "dominant_hat": str(hat_data.get("dominant_hat", "white")).lower().strip(),
                "explanation": str(hat_data.get("explanation", hat_data.get("evidence", ""))).strip()
            }

    # Normalize tone
    tone = result.get("tone", {})
    if not isinstance(tone, dict):
        tone = {}
    
    normalized_tone = {
        "overall": str(tone.get("overall", "collaborative")).lower().strip(),
        "energy": str(tone.get("energy", "medium")).lower().strip(),
        "description": str(tone.get("description", "")).strip()
    }

    # Normalize convergent points
    convergent = result.get("convergent_points", [])
    if not isinstance(convergent, list):
        convergent = []
    
    normalized_convergent = []
    for item in convergent:
        if isinstance(item, dict) and item.get("topic"):
            evidence = item.get("evidence", {})
            if isinstance(evidence, list) and len(evidence) > 0:
                evidence = evidence[0]
            
            normalized_convergent.append({
                "topic": str(item.get("topic", "")).strip(),
                "agreed_by": item.get("agreed_by", []),
                "evidence": {
                    "speaker": evidence.get("speaker", "") if isinstance(evidence, dict) else "",
                    "quote": evidence.get("quote", "") if isinstance(evidence, dict) else ""
                }
            })

    # Normalize divergent points
    divergent = result.get("divergent_points", [])
    if not isinstance(divergent, list):
        divergent = []
    
    normalized_divergent = []
    for item in divergent:
        if isinstance(item, dict) and item.get("topic"):
            perspectives = item.get("perspectives", [])
            if not isinstance(perspectives, list):
                perspectives = []
            
            normalized_perspectives = []
            for p in perspectives:
                if isinstance(p, dict):
                    normalized_perspectives.append({
                        "speaker": str(p.get("speaker", "")).strip(),
                        "view": str(p.get("view", "")).strip()
                    })
            
            normalized_divergent.append({
                "topic": str(item.get("topic", "")).strip(),
                "perspectives": normalized_perspectives,
                "resolution": str(item.get("resolution", "Unresolved")).strip()
            })

    return {
        "action_items": normalized_actions,
        "achievements": normalized_achievements,
        "blockers": normalized_blockers,
        "six_thinking_hats": normalized_hats,
        "tone": normalized_tone,
        "convergent_points": normalized_convergent,
        "divergent_points": normalized_divergent
    }


def _empty_extraction() -> Dict[str, Any]:
    """Return empty extraction structure."""
    return {
        "action_items": [],
        "achievements": [],
        "blockers": [],
        "six_thinking_hats": {},
        "tone": {"overall": "collaborative", "energy": "medium", "description": ""},
        "convergent_points": [],
        "divergent_points": []
    }


def run_extraction_stage(utterances: List[Dict[str, Any]], chapters: List[Dict[str, Any]], model: Optional[str] = None) -> Dict[str, Any]:
    """Synchronous wrapper for extraction stage."""
    import asyncio
    return asyncio.run(run_extraction_stage_async(utterances, chapters, model))
