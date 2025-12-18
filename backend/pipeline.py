"""
Pipeline orchestrator: 3-Stage focused architecture for optimal quality and efficiency.

ARCHITECTURE:
- Stage 1 (Foundation): Extract metadata, timeline, chapter boundaries
- Stage 2 (Extraction): Extract action items, achievements, blockers, Six Thinking Hats
- Stage 3 (Synthesis): Generate narrative summary and chapter summaries
- Stage 4 (Mindmap): Build mindmap visualization

Total API calls: 4 per meeting (optimal balance between quality and cost)
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from utils.vtt_parser import parse_vtt
from stages.stage1_foundation import run_foundation_stage_async
from stages.stage2_extraction import run_extraction_stage_async
from stages.stage3_synthesis import run_synthesis_stage_async
from stages.stage4_mindmap import build_mindmap_async
from utils.supabase_client import save_meeting_results, update_meeting_details

CONFIDENCE_KEYWORDS = {
    "very high": 0.95,
    "high": 0.9,
    "medium": 0.6,
    "mid": 0.6,
    "moderate": 0.6,
    "low": 0.35,
    "very low": 0.2,
    "uncertain": 0.35,
}


def _clean_text(value: Any, default: str = "") -> str:
    if value is None:
        return default
    text = str(value).strip()
    return text or default


def _shorten_title(value: Any, max_words: int = 8) -> str:
    title = _clean_text(value, "")
    if not title:
        return "Meeting Analysis"

    # Prefer text before first colon if it reads well
    if ":" in title:
        left, right = title.split(":", 1)
        if 2 <= len(left.split()) <= max_words:
            title = left.strip()

    words = title.split()
    if len(words) > max_words:
        title = " ".join(words[:max_words])
    return title


def _normalize_confidence(value: Any, default: float = 0.7) -> float:
    if isinstance(value, (int, float)):
        numeric = float(value)
    elif isinstance(value, str):
        s = value.strip().lower()
        if not s:
            return default
        if s in CONFIDENCE_KEYWORDS:
            return CONFIDENCE_KEYWORDS[s]
        s = s.replace("%", "")
        try:
            numeric = float(s)
        except ValueError:
            return default
    else:
        return default

    if numeric > 1:
        numeric = numeric / 100 if numeric > 100 else min(numeric, 1.0)
    if numeric < 0:
        numeric = 0.0
    return max(0.0, min(numeric, 1.0))


def _format_timestamp_ms(ms: Any) -> str:
    try:
        ms_int = int(float(ms))
    except (TypeError, ValueError):
        return ""

    seconds_total = ms_int // 1000
    seconds = seconds_total % 60
    minutes = (seconds_total // 60) % 60
    hours = seconds_total // 3600
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def _normalize_evidence(evidence_data: Any) -> Dict[str, str]:
    """Normalize evidence to speaker+quote format (no timestamps)."""
    if not evidence_data:
        return {"speaker": "", "quote": ""}
    
    # Handle dict format (new format: {speaker, quote})
    if isinstance(evidence_data, dict):
        return {
            "speaker": _clean_text(evidence_data.get("speaker", "")),
            "quote": _clean_text(evidence_data.get("quote", evidence_data.get("text", "")))
        }
    
    # Handle list format (legacy: take first item)
    if isinstance(evidence_data, list) and len(evidence_data) > 0:
        first = evidence_data[0]
        if isinstance(first, dict):
            return {
                "speaker": _clean_text(first.get("speaker", "")),
                "quote": _clean_text(first.get("quote", first.get("text", "")))
            }
    
    return {"speaker": "", "quote": ""}


def _ensure_markdown_headings(text: str) -> str:
    if not text:
        return ""

    text = text.replace("\\r\\n", "\n").replace("\\n", "\n")
    replacements = {
        "Executive Summary": "## Executive Summary",
        "Meeting Overview": "## Meeting Overview",
        "Key Discussion Topics": "## Key Discussion Topics",
        "Decisions Made": "## Decisions Made",
        "Concerns & Challenges": "## Concerns & Challenges",
        "Risks & Challenges": "## Risks & Challenges",
        "Next Steps": "## Next Steps",
        "Executive Summary": "## Executive Summary",
        "Key Takeaways": "## Key Takeaways",
        "Key Discussion Topics": "## Key Discussion Topics",
        "Decisions Made": "## Decisions Made",
        "Concerns & Challenges": "## Concerns & Challenges",
        "Meeting Overview": "## Meeting Overview"
    }

    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = normalized.split("\n")
    first_content_idx = None

    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        if first_content_idx is None:
            first_content_idx = idx

        if stripped.startswith("**") and stripped.endswith("**") and len(stripped) > 4:
            inner = stripped.strip("*").strip()
            stripped = inner
            lines[idx] = inner

        if stripped in replacements and not stripped.startswith("#"):
            lines[idx] = replacements[stripped]
            continue

        lowered = stripped.lower()
        for key, heading in replacements.items():
            if lowered == key.lower():
                lines[idx] = heading
                break
        else:
            if stripped.startswith("##"):
                continue
            if stripped in {"Key Topics", "Summary", "Highlights"}:
                lines[idx] = f"## {stripped}"

    if first_content_idx is not None:
        first_line = lines[first_content_idx].strip()
        if not first_line.startswith("#"):
            lines[first_content_idx] = f"## {first_line}"

    cleaned_lines = []
    for line in lines:
        if line.strip().startswith("**") and line.strip().endswith("**") and line.strip().count("**") == 2:
            cleaned_lines.append(line.replace("**", ""))
        else:
            cleaned_lines.append(line)

    return "\n".join(cleaned_lines)


def _normalize_action_items(items: Any) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if not isinstance(items, list):
        return normalized

    seen = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        task = _clean_text(item.get("task") or item.get("action") or item.get("title"))
        if not task:
            continue
        owner = _clean_text(
            item.get("owner") or item.get("assignee") or item.get("responsible"),
            "Unassigned",
        )
        deadline_raw = item.get("deadline") or item.get("due_date") or item.get("timeline")
        if isinstance(deadline_raw, dict):
            deadline = _clean_text(deadline_raw.get("text") or deadline_raw.get("label"))
        else:
            deadline = _clean_text(deadline_raw)
        deadline_lower = deadline.lower()
        if deadline_lower in {"", "none", "no deadline", "no deadline specified", "not specified", "tbd"}:
            deadline = ""

        status = _clean_text(item.get("status") or item.get("state") or "pending", "pending")
        priority = _clean_text(item.get("priority") or "medium", "medium").lower()
        if priority not in {"high", "medium", "low"}:
            priority = "medium"

        key = (task.lower(), owner.lower(), deadline.lower())
        if key in seen:
            continue
        seen.add(key)

        normalized.append(
            {
                "task": task,
                "owner": owner or "Unassigned",
                "deadline": deadline,
                "priority": priority,
                "status": status or "pending",
                "evidence": _normalize_evidence(item.get("evidence")),
            }
        )
    return normalized


def _normalize_achievements(items: Any) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if not isinstance(items, list):
        return normalized

    seen = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        achievement = _clean_text(item.get("achievement") or item.get("summary"))
        if not achievement:
            continue
        if len(achievement.split()) < 3 and not item.get("evidence"):
            continue
        members = item.get("members") or item.get("member")
        if isinstance(members, list):
            member = ", ".join(filter(None, (_clean_text(m) for m in members)))
        else:
            member = _clean_text(members)
        member = member or "Team"
        key = achievement.lower()
        if key in seen:
            continue
        seen.add(key)

        normalized.append(
            {
                "achievement": achievement,
                "member": member,
                "confidence": _normalize_confidence(item.get("confidence"), default=0.8),
                "evidence": _normalize_evidence(item.get("evidence")),
            }
        )
    return normalized


def _normalize_blockers(items: Any) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if not isinstance(items, list):
        return normalized

    seen = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        blocker = _clean_text(item.get("blocker") or item.get("issue") or item.get("challenge"))
        if not blocker:
            continue
        if len(blocker.split()) < 3 and not item.get("evidence"):
            continue
        affected = item.get("affected_members") or item.get("members") or item.get("member")
        if isinstance(affected, list):
            member = ", ".join(filter(None, (_clean_text(a) for a in affected)))
        else:
            member = _clean_text(affected)
        member = member or "Unknown"
        
        severity = _clean_text(item.get("severity") or "major", "major").lower()
        if severity not in {"critical", "major", "minor"}:
            severity = "major"

        key = blocker.lower()
        if key in seen:
            continue
        seen.add(key)

        normalized.append(
            {
                "blocker": blocker,
                "member": member,
                "severity": severity,
                "evidence": _normalize_evidence(item.get("evidence")),
            }
        )
    return normalized


def _normalize_chapters(items: Any) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if not isinstance(items, list):
        return normalized

    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        chapter_id = _clean_text(item.get("chapter_id")) or f"chap-{idx:03d}"
        title = _clean_text(item.get("title"), f"Chapter {idx + 1}")
        summary = _clean_text(item.get("summary")).replace("\r\n", "\n").replace("\r", "\n")
        summary = summary.replace("In this chapter", "").replace("This chapter", "").strip()

        segments = item.get("segment_ids") or item.get("segments") or []
        segment_ids: List[str] = []
        if isinstance(segments, list):
            for seg in segments:
                if isinstance(seg, int):
                    segment_ids.append(f"seg-{seg:04d}")
                else:
                    segment_ids.append(_clean_text(seg))

        normalized.append(
            {
                "chapter_id": chapter_id,
                "segment_ids": [s for s in segment_ids if s],
                "title": title,
                "summary": summary,
            }
        )
    return normalized


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _normalize_timeline(items: Any) -> List[Dict[str, Any]]:
    normalized: List[Dict[str, Any]] = []
    if not isinstance(items, list):
        return normalized

    for item in items:
        if not isinstance(item, dict):
            continue
        # Handle both 'event' (new) and 'text' (legacy) field names
        event = _clean_text(item.get("event") or item.get("text"))
        if not event:
            continue
        timestamp_ms = item.get("timestamp_ms")
        if timestamp_ms is None:
            timestamp_ms = item.get("time_ms") or item.get("timestamp")
        ts_int = _to_int(timestamp_ms)
        speakers_raw = item.get("speakers")
        if isinstance(speakers_raw, list):
            speakers = [s for s in (_clean_text(s) for s in speakers_raw) if s]
        else:
            speaker_single = _clean_text(speakers_raw)
            speakers = [speaker_single] if speaker_single else []
        normalized.append(
            {
                "timestamp_ms": ts_int,
                "event": event,
                "speakers": speakers,
            }
        )
    return normalized


HAT_NARRATIVE = {
    "white": "shared data points, metrics, or factual updates to keep everyone grounded in evidence.",
    "red": "voiced candid emotions and instinctive reactions, giving context to how the team was feeling.",
    "black": "highlighted risks, gaps, and potential downsides that the team needed to prepare for.",
    "yellow": "framed the discussion around opportunities, benefits, and positive impact to maintain momentum.",
    "green": "generated creative alternatives and suggestions that opened up new possibilities.",
    "blue": "facilitated the process, organizing next steps and keeping the conversation on track.",
}


def _sanitize_narrative_summary(text: str) -> str:
    """
    Remove any extra sections (Six Thinking Hats, Chapters, JSON dumps, etc.)
    that sometimes get appended to the narrative summary by the model.
    Also removes timestamp patterns like (00:00:00) or (00:00:00–00:00:00).
    
    IMPORTANT: Only match section headers, not words that appear inside paragraphs!
    """
    if not text:
        return ""

    import re

    # Remove timestamp patterns: (HH:MM:SS) or (HH:MM:SS–HH:MM:SS)
    text = re.sub(r'\(\d{2}:\d{2}:\d{2}(?:–\d{2}:\d{2}:\d{2})?\)', '', text)

    cleaned = text.replace("\r", "\n")
    
    # Only truncate at JSON-like sections or explicit unwanted headers
    # Be very specific to avoid truncating legitimate narrative content
    stop_markers = (
        '"chapters"',        # JSON key
        '"timeline"',        # JSON key
        '"hats"',           # JSON key
        "Chapters [",       # JSON array start
        "Timeline [",       # JSON array start
        "```json",          # Code block
        "```",              # Code block end (only if at start of line)
    )

    lower_cleaned = cleaned.lower()
    for marker in stop_markers:
        idx = lower_cleaned.find(marker.lower())
        if idx != -1:
            cleaned = cleaned[:idx]
            break

    # Remove lines that are clearly section headers for excluded content
    # Only match if the line IS a header (starts with ** or ## or is standalone)
    lines = []
    excluded_header_patterns = [
        r'^#+\s*six thinking hats',
        r'^\*\*six thinking hats',
        r'^#+\s*chapters\s*$',
        r'^\*\*chapters\*\*',
        r'^#+\s*action items',
        r'^\*\*action items\*\*',
        r'^#+\s*decisions made',
        r'^\*\*decisions made\*\*',
    ]
    
    for line in cleaned.splitlines():
        stripped = line.strip().lower()
        if not stripped:
            lines.append("")
            continue
        
        # Check if this line is an excluded header
        is_excluded = any(re.match(pattern, stripped) for pattern in excluded_header_patterns)
        if is_excluded:
            break  # Stop processing at excluded headers
            
        lines.append(line)

    return "\n".join(lines).strip()


def _build_hat_description(participant: str, hat: str, sections: Dict[str, str]) -> str:
    hat_label = hat.capitalize()
    focus = HAT_NARRATIVE.get(hat, "contributed meaningfully to the conversation.")
    if focus:
        focus = focus.strip()
        if not focus.endswith("."):
            focus = f"{focus}."
        focus = focus[0].upper() + focus[1:]

    dominant_text = _clean_text(sections.get(hat))

    other_highlights = []
    for color, _narrative in HAT_NARRATIVE.items():
        if color == hat:
            continue
        text = _clean_text(sections.get(color))
        if len(text.split()) > 8:
            other_highlights.append((color, text))

    sentences: List[str] = []
    sentences.append(f"{participant} consistently embodied the {hat_label} Hat. {focus}")

    if dominant_text:
        snippet = dominant_text.strip()
        if not snippet.endswith("."):
            snippet += "."
        sentences.append(snippet)

    if other_highlights:
        secondary_color, secondary_text = other_highlights[0]
        secondary_hat = secondary_color.capitalize()
        snippet = secondary_text.strip()
        if not snippet.endswith("."):
            snippet += "."
        sentences.append(
            f"They also showed {secondary_hat} Hat thinking at times, noting that {snippet}"
        )

    text = " ".join(sentences)
    return " ".join(text.split())


async def run_pipeline_async(
    vtt_content: str,
    model: Optional[str] = None,
    segment_len_ms: int = 600_000,  # Deprecated parameter, kept for API compatibility
    user_id: Optional[str] = None,
    meeting_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run the 3-stage meeting summarization pipeline for optimal quality and efficiency.

    NEW 3-STAGE ARCHITECTURE:
    1. Parse VTT file
    2. Stage 1 (Foundation): Extract metadata, timeline, chapter boundaries
    3. Stage 2 (Extraction): Extract action items, achievements, blockers, Six Thinking Hats
    4. Stage 3 (Synthesis): Generate narrative summary and chapter summaries
    5. Stage 4 (Mindmap): Build mindmap visualization

    Total API calls: 4 per meeting (optimal balance between quality and cost)

    Args:
        vtt_content: VTT file content as string
        model: Model name (optional, uses env default)
        segment_len_ms: Deprecated, kept for API compatibility

    Returns:
        Dict containing all pipeline outputs:
        {
            "meeting_details": {
                "title": str,
                "date": str,
                "duration_ms": int,
                "participants": [str],
                "unknown_count": int
            },
            "collective_summary": {
                "narrative_summary": "...",
                "action_items": [...],
                "achievements": [...],
                "blockers": [...]
            },
            "hats": [...],
            "chapters": [...],
            "timeline": [...],
            "mindmap": {
                "center_node": {...},
                "nodes": [...],
                "edges": [...]
            }
        }
    """
    import time
    pipeline_start = time.time()

    print("\n" + "=" * 70)
    print("[PIPELINE] Starting 3-STAGE pipeline execution")
    print("=" * 70)

    # Step 1: Parse VTT
    print("[PIPELINE] Step 1: Parsing VTT file...")
    utterances = parse_vtt(vtt_content)
    print(f"[PIPELINE] Parsed {len(utterances)} utterances")

    if not utterances:
        print("[PIPELINE] ERROR: No utterances found in VTT file")
        return {
            "error": "No utterances found in VTT file",
            "meeting_details": {
                "title": "",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "duration_ms": 0,
                "participants": [],
                "unknown_count": 0,
            },
            "collective_summary": {
                "narrative_summary": "",
                "action_items": [],
                "achievements": [],
                "blockers": [],
            },
            "hats": [],
            "chapters": [],
            "timeline": [],
            "mindmap": {
                "center_node": {"id": "root", "label": "Meeting", "type": "root"},
                "nodes": [],
                "edges": [],
            },
        }

    # Deterministic metadata derived from transcript
    duration_ms = int(utterances[-1]["end_ms"])
    speakers = [str(u.get("speaker", "")).strip() for u in utterances]
    participants = sorted({s for s in speakers if s and s != "Speaker ?"})
    unknown_count = sum(1 for s in speakers if s == "Speaker ?")

    print(f"[PIPELINE] Meeting duration: {duration_ms}ms")
    print(f"[PIPELINE] Participants: {len(participants)}, Unknown speakers: {unknown_count}")

    try:
        # Stage 1: Foundation - Extract structure
        print("\n[PIPELINE] Step 2: Stage 1 - Foundation (metadata, timeline, chapters)")
        stage1_result = await run_foundation_stage_async(utterances, model)
        print("[PIPELINE] Stage 1 complete!")

        meeting_details_raw = stage1_result.get("meeting_details", {}) or {}
        timeline = _normalize_timeline(stage1_result.get("timeline", []))
        chapters_foundation = stage1_result.get("chapters", [])

        # Stage 2: Extraction - Extract action items, achievements, blockers, hats
        print("\n[PIPELINE] Step 3: Stage 2 - Extraction (action items, achievements, blockers, hats)")
        stage2_result = await run_extraction_stage_async(utterances, chapters_foundation, model)
        print("[PIPELINE] Stage 2 complete!")

        action_items = _normalize_action_items(stage2_result.get("action_items", []))
        achievements = _normalize_achievements(stage2_result.get("achievements", []))
        blockers = _normalize_blockers(stage2_result.get("blockers", []))
        six_thinking_hats = stage2_result.get("six_thinking_hats", {}) or {}
        tone = stage2_result.get("tone", {}) or {}
        convergent_points = stage2_result.get("convergent_points", []) or []
        divergent_points = stage2_result.get("divergent_points", []) or []

        # Stage 3: Synthesis - Generate narrative summaries
        print("\n[PIPELINE] Step 4: Stage 3 - Synthesis (narrative summary, chapter summaries)")
        stage3_result = await run_synthesis_stage_async(
            utterances, chapters_foundation, action_items, achievements, blockers,
            six_thinking_hats, tone, convergent_points, divergent_points, model
        )
        print("[PIPELINE] Stage 3 complete!")

        narrative_summary_raw = stage3_result.get("narrative_summary", "")
        narrative_summary = _ensure_markdown_headings(
            _sanitize_narrative_summary(narrative_summary_raw)
        )
        chapters = _normalize_chapters(stage3_result.get("chapters", []))

        meeting_details = {
            "title": _clean_text(_shorten_title(meeting_details_raw.get("title")), "Meeting Analysis"),
            "date": _clean_text(
                meeting_details_raw.get("date"), datetime.now().strftime("%Y-%m-%d")
            ),
            "duration_ms": duration_ms,
            "participants": participants,
            "unknown_count": unknown_count,
        }

        collective_summary = {
            "narrative_summary": narrative_summary,
            "action_items": action_items,
            "achievements": achievements,
            "blockers": blockers,
        }

        hats: List[Dict[str, Any]] = []
        if isinstance(six_thinking_hats, dict):
            for participant, hats_data in six_thinking_hats.items():
                if not isinstance(hats_data, dict):
                    continue

                # New simplified structure: dominant_hat + evidence from Stage 2
                dominant_hat = hats_data.get("dominant_hat", "white")
                evidence = hats_data.get("evidence", "")

                # Ensure evidence ends with period
                if evidence and evidence[-1] != ".":
                    evidence = evidence + "."

                hats.append(
                    {
                        "speaker": participant,
                        "hat": dominant_hat,
                        "t": "00:00:00",
                        "evidence": evidence,
                        "confidence": 0.85,  # Default confidence for dominant hat
                    }
                )

        stage3_time = time.time() - pipeline_start

        print("[PIPELINE] ✓ 3-stage analysis complete!")
        print(f"  - Meeting: {meeting_details['title']}")
        print(f"  - Action Items: {len(action_items)}")
        print(f"  - Achievements: {len(achievements)}")
        print(f"  - Blockers: {len(blockers)}")
        print(f"  - Six Thinking Hats: {len(hats)} participants")
        print(f"  - Chapters: {len(chapters)}")
        print(f"  - Timeline: {len(timeline)} key moments")
        print(f"  - Total time: {stage3_time:.2f}s")

    except Exception as exc:  # noqa: BLE001
        print(f"[PIPELINE] ERROR in 3-stage analysis: {exc}")
        import traceback

        traceback.print_exc()
        return {
            "error": f"3-stage analysis failed: {exc}",
            "meeting_details": {
                "title": "Error",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "duration_ms": duration_ms,
                "participants": participants,
                "unknown_count": unknown_count,
            },
            "collective_summary": {
                "narrative_summary": "",
                "action_items": [],
                "achievements": [],
                "blockers": [],
            },
            "hats": [],
            "chapters": [],
            "timeline": [],
            "mindmap": {
                "center_node": {"id": "root", "label": "Meeting", "type": "root"},
                "nodes": [],
                "edges": [],
            },
        }

    # Step 5: Build mindmap (optional, depends on chapters and summary)
    print("\n[PIPELINE] Step 5: Stage 4 - Mindmap (visualization)")
    try:
        mindmap = await build_mindmap_async(
            meeting_details=meeting_details,
            narrative_summary=narrative_summary,
            chapters=chapters,
            collective_summary=collective_summary,
            timeline=timeline,
            hats=hats,
        )
        print(
            "[PIPELINE] ✓ Mindmap complete. "
            f"Nodes: {len(mindmap.get('nodes', []))}, Edges: {len(mindmap.get('edges', []))}"
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[PIPELINE] Warning: Mindmap generation failed: {exc}")
        mindmap = {
            "center_node": {"id": "root", "label": meeting_details["title"], "type": "root"},
            "nodes": [],
            "edges": [],
        }

    total_time = time.time() - pipeline_start

    print("\n" + "=" * 70)
    print(f"[PIPELINE] ✓ Pipeline execution complete in {total_time:.2f}s")
    print("[PIPELINE] Total API calls: 4 (Stage 1-3 + mindmap)")
    print("=" * 70 + "\n")

    # Save to Supabase if meeting_id is provided (MUST be before return!)
    if meeting_id:
        print(f"[PIPELINE] Saving results to Supabase for meeting {meeting_id}...")
        try:
            # Update meeting details including timeline
            await update_meeting_details(
                meeting_id,
                meeting_details["title"],
                meeting_details["duration_ms"],
                meeting_details["participants"],
                timeline_json=timeline  # Save timeline to meetings table
            )
            # Save analysis results to meeting_summaries table
            await save_meeting_results(
                meeting_id,
                collective_summary,
                mindmap,
                chapters,
                hats,
                timeline=timeline
            )
            print("[PIPELINE] ✓ Saved to Supabase successfully!")
        except Exception as e:
            print(f"[PIPELINE] Error saving to Supabase: {e}")
            import traceback
            traceback.print_exc()

    return {
        "meeting_details": meeting_details,
        "collective_summary": collective_summary,
        "hats": hats,
        "chapters": chapters,
        "timeline": timeline,
        "mindmap": mindmap,
    }

