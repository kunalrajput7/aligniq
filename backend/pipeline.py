"""
Pipeline orchestrator: Leverages modern LLMs' large context windows for single-call comprehensive analysis.

ARCHITECTURE:
- Stage Unified: Single API call for complete meeting analysis (replaces Stages 1-4)
- Stage 5: Optional mindmap generation (depends on unified analysis)

Total API calls: 1-2 per meeting (vs 20+ in old architecture)
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from utils.vtt_parser import parse_vtt
from stages.stage_unified import run_unified_analysis_async
from stages.stage5_mindmap import build_mindmap_async

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


def _normalize_evidence(evidence_list: Any) -> List[Dict[str, str]]:
    normalized: List[Dict[str, str]] = []
    if not isinstance(evidence_list, list):
        return normalized

    for entry in evidence_list:
        if not isinstance(entry, dict):
            continue
        quote = _clean_text(entry.get("quote") or entry.get("text"))
        if not quote:
            continue
        timestamp = entry.get("t") or entry.get("timestamp") or entry.get("time")
        if not timestamp:
            timestamp = _format_timestamp_ms(entry.get("timestamp_ms"))
        timestamp_str = _clean_text(timestamp)
        normalized.append(
            {
                "t": timestamp_str,
                "quote": quote,
            }
        )
    return normalized


def _ensure_markdown_headings(text: str) -> str:
    if not text:
        return ""

    replacements = {
        "Executive Summary": "## Executive Summary",
        "Meeting Overview": "## Meeting Overview",
        "Key Discussion Topics": "## Key Discussion Topics",
        "Decisions Made": "## Decisions Made",
        "Concerns & Challenges": "## Concerns & Challenges",
        "Risks & Challenges": "## Risks & Challenges",
        "Next Steps": "## Next Steps",
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
        if stripped in replacements and not stripped.startswith("#"):
            lines[idx] = replacements[stripped]

    if first_content_idx is not None:
        first_line = lines[first_content_idx].strip()
        if not first_line.startswith("#"):
            lines[first_content_idx] = f"## {first_line}"

    return "\n".join(lines)


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
        confidence = _normalize_confidence(item.get("confidence"), default=0.75)

        key = (task.lower(), owner.lower(), deadline.lower())
        if key in seen:
            continue
        seen.add(key)

        normalized.append(
            {
                "task": task,
                "owner": owner or "Unassigned",
                "deadline": deadline,
                "status": status or "pending",
                "confidence": confidence,
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
        owner = _clean_text(
            item.get("owner") or item.get("responsible") or item.get("assignee"),
            "Unassigned",
        )
        key = blocker.lower()
        if key in seen:
            continue
        seen.add(key)

        normalized.append(
            {
                "blocker": blocker,
                "member": member,
                "owner": owner or "Unassigned",
                "confidence": _normalize_confidence(item.get("confidence"), default=0.65),
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
        text = _clean_text(item.get("text"))
        if not text:
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
                "text": text,
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
) -> Dict[str, Any]:
    """
    Run the optimized meeting summarization pipeline using modern LLMs' large context windows.

    NEW ARCHITECTURE:
    1. Parse VTT file
    2. Stage Unified: Single comprehensive analysis (replaces old Stages 1-4)
       - Extracts: meeting details, narrative summary, action items, achievements,
         blockers, six thinking hats, chapters, timeline
    3. Stage 5: Build mindmap (optional, depends on unified analysis)

    Total API calls: 1-2 per meeting (vs 20+ in old segmented architecture)

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
    print("\n" + "=" * 70)
    print("[PIPELINE] Starting OPTIMIZED pipeline execution (Unified Architecture)")
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
        print("\n[PIPELINE] Step 2: Running unified comprehensive analysis...")
        print(
            "[PIPELINE] This single call replaces old Stages 1-4 (segment summaries, collective, hats, chapters)"
        )
        unified_result = await run_unified_analysis_async(utterances, model)
        print("[PIPELINE] Unified analysis complete!")

        meeting_details_raw = unified_result.get("meeting_details", {}) or {}
        narrative_summary = _ensure_markdown_headings(
            unified_result.get("narrative_summary", "")
        )
        action_items = _normalize_action_items(unified_result.get("action_items", []))
        achievements = _normalize_achievements(unified_result.get("achievements", []))
        blockers = _normalize_blockers(unified_result.get("blockers", []))
        chapters = _normalize_chapters(unified_result.get("chapters", []))
        timeline = _normalize_timeline(unified_result.get("timeline", []))
        six_thinking_hats = unified_result.get("six_thinking_hats", {}) or {}

        meeting_details = {
            "title": _clean_text(meeting_details_raw.get("title"), "Meeting Analysis"),
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
                sections = {
                    "white": _clean_text(hats_data.get("white_hat")),
                    "red": _clean_text(hats_data.get("red_hat")),
                    "black": _clean_text(hats_data.get("black_hat")),
                    "yellow": _clean_text(hats_data.get("yellow_hat")),
                    "green": _clean_text(hats_data.get("green_hat")),
                    "blue": _clean_text(hats_data.get("blue_hat")),
                }
                lengths = {color: len(text) for color, text in sections.items()}
                dominant_hat = max(lengths, key=lengths.get)
                total_chars = sum(lengths.values())
                dominant_text = sections[dominant_hat]
                if total_chars:
                    confidence_hat = max(0.5, min(lengths[dominant_hat] / total_chars, 1.0))
                else:
                    confidence_hat = 0.6

                explanation = _build_hat_description(participant, dominant_hat, sections)
                if explanation and explanation[-1] != ".":
                    explanation = explanation + "."

                hats.append(
                    {
                        "speaker": participant,
                        "hat": dominant_hat,
                        "t": "00:00:00",
                        "evidence": explanation,
                        "confidence": round(confidence_hat, 2),
                    }
                )

        print("[PIPELINE] Extracted from unified analysis:")
        print(f"  - Meeting: {meeting_details['title']}")
        print(f"  - Action Items: {len(action_items)}")
        print(f"  - Achievements: {len(achievements)}")
        print(f"  - Blockers: {len(blockers)}")
        print(f"  - Six Thinking Hats: {len(hats)} participants")
        print(f"  - Chapters: {len(chapters)}")
        print(f"  - Timeline: {len(timeline)} key moments")

    except Exception as exc:  # noqa: BLE001
        print(f"[PIPELINE] ERROR in unified analysis: {exc}")
        import traceback

        traceback.print_exc()
        return {
            "error": f"Unified analysis failed: {exc}",
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

    # Step 3: Build mindmap (optional, depends on chapters and summary)
    print("\n[PIPELINE] Step 3: Building mindmap...")
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
            "[PIPELINE] Mindmap complete. "
            f"Nodes: {len(mindmap.get('nodes', []))}, Edges: {len(mindmap.get('edges', []))}"
        )
    except Exception as exc:  # noqa: BLE001
        print(f"[PIPELINE] Warning: Mindmap generation failed: {exc}")
        mindmap = {
            "center_node": {"id": "root", "label": meeting_details["title"], "type": "root"},
            "nodes": [],
            "edges": [],
        }

    print("\n[PIPELINE] Pipeline execution complete!")
    print("[PIPELINE] Total API calls: 2 (unified analysis + mindmap)")
    print("=" * 70 + "\n")

    return {
        "meeting_details": meeting_details,
        "collective_summary": collective_summary,
        "hats": hats,
        "chapters": chapters,
        "timeline": timeline,
        "mindmap": mindmap,
    }
