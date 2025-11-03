"""
Pipeline orchestrator: Runs all stages with parallel execution where possible using asyncio.
"""
from __future__ import annotations
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional

from utils.vtt_parser import parse_vtt
from stages.segmentation import segment_utterances
from stages.stage1_summaries import summarize_segments_async
from stages.stage2_collective import summarize_collective_async
from stages.stage3_supplementary import extract_hats_async
from stages.stage4_chapters import build_chapters_async
from stages.stage5_mindmap import build_mindmap_async


async def run_pipeline_async(
    vtt_content: str,
    model: Optional[str] = None,
    segment_len_ms: int = 600_000,  # 10 minutes
) -> Dict[str, Any]:
    """
    Run the complete meeting summarization pipeline with async parallel execution.

    Execution flow:
    1. Parse VTT and segment utterances (fast, no LLM)
    2. Stage 1: Summarize segments (parallel execution for all segments)
    3. Stages 2, 3, 4 run in parallel (all depend on Stage 1)
       - Stage 2: Collective summary + meeting details (title, date)
       - Stage 3: Extract thinking hats
       - Stage 4: Build chapters
    4. Stage 5: Build mindmap (depends on collective_summary and chapters)

    Args:
        vtt_content: VTT file content as string
        model: Model name (optional, uses env default)
        segment_len_ms: Segment length in milliseconds

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
            "segments": [...],
            "segment_summaries": [...],
            "collective_summary": {
                "narrative_summary": "...",
                "action_items": [...],
                "achievements": [...],
                "blockers": [...]
            },
            "hats": [...],
            "chapters": [...],
            "mindmap": {
                "center_node": {...},
                "nodes": [...],
                "edges": [...]
            }
        }
    """
    print("\n" + "="*50)
    print("[PIPELINE] Starting pipeline execution")
    print("="*50)

    # Parse VTT
    print("[PIPELINE] Step 1: Parsing VTT file...")
    utterances = parse_vtt(vtt_content)
    print(f"[PIPELINE] Parsed {len(utterances)} utterances")

    if not utterances:
        return {
            "error": "No utterances found in VTT file",
            "meeting_details": {
                "title": "",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "duration_ms": 0,
                "participants": [],
                "unknown_count": 0
            },
            "segments": [],
            "segment_summaries": [],
            "collective_summary": {
                "narrative_summary": "",
                "action_items": [],
                "achievements": [],
                "blockers": []
            },
            "hats": [],
            "chapters": [],
            "mindmap": {
                "center_node": {"id": "root", "label": "Meeting", "type": "root"},
                "nodes": [],
                "edges": []
            }
        }

    # Segment utterances (fast, no LLM)
    print("[PIPELINE] Step 2: Segmenting utterances...")
    segments = segment_utterances(
        utterances,
        segment_len_ms=segment_len_ms,
        overlap_ratio=0.0,
        include_text=True,
        include_mapping=False
    )
    print(f"[PIPELINE] Created {len(segments)} segments")

    # Stage 1: Summarize all segments in parallel
    print(f"[PIPELINE] Step 3: Stage 1 - Summarizing {len(segments)} segments...")
    segment_summaries = await summarize_segments_async(segments, model)
    print(f"[PIPELINE] Stage 1 complete. Got {len(segment_summaries)} summaries")
    if segment_summaries:
        print(f"[PIPELINE] First summary preview: {str(segment_summaries[0])[:200]}...")

    # Stages 2, 3, 4 run in parallel using asyncio.gather()
    # All three depend on segment_summaries but are independent of each other
    print("[PIPELINE] Step 4: Stages 2, 3, 4 running in parallel...")
    collective_data, hats_data, chapters = await asyncio.gather(
        summarize_collective_async(utterances, segment_summaries, model),  # Stage 2 now takes utterances
        extract_hats_async(segment_summaries, model),
        build_chapters_async(segment_summaries, model)
    )
    print(f"[PIPELINE] Stages 2, 3, 4 complete")
    print(f"[PIPELINE] Collective data keys: {collective_data.keys() if collective_data else 'EMPTY'}")
    print(f"[PIPELINE] Hats data count: {len(hats_data) if hats_data else 0}")
    print(f"[PIPELINE] Chapters count: {len(chapters) if chapters else 0}")

    # Extract meeting details from collective_data (now includes title and date)
    # Calculate deterministic fields from utterances
    duration_ms = int(utterances[-1]["end_ms"]) if utterances else 0
    speakers = [str(u.get("speaker", "")).strip() for u in utterances]
    participants = sorted({s for s in speakers if s and s != "Speaker ?"})
    unknown_count = sum(1 for s in speakers if s == "Speaker ?")

    # Use today's date if no date found in transcript
    meeting_date = collective_data.get("meeting_date") if collective_data.get("meeting_date") else datetime.now().strftime("%Y-%m-%d")

    meeting_details = {
        "title": collective_data.get("meeting_title", ""),
        "date": meeting_date,
        "duration_ms": duration_ms,
        "participants": participants,
        "unknown_count": unknown_count
    }

    # Build collective_summary without meeting_title and meeting_date
    collective_summary = {
        "narrative_summary": collective_data.get("narrative_summary", ""),
        "action_items": collective_data.get("action_items", []),
        "achievements": collective_data.get("achievements", []),
        "blockers": collective_data.get("blockers", [])
    }

    # Stage 5: Build mindmap (depends on collective_summary and chapters)
    print("[PIPELINE] Step 5: Building mindmap...")
    mindmap = await build_mindmap_async(
        chapters=chapters,
        collective_summary=collective_summary,
        model=model
    )
    print(f"[PIPELINE] Mindmap complete. Nodes: {len(mindmap.get('nodes', []))}, Edges: {len(mindmap.get('edges', []))}")

    print("[PIPELINE] Pipeline execution complete!")
    print("="*50 + "\n")

    return {
        "meeting_details": meeting_details,
        "segments": segments,
        "segment_summaries": segment_summaries,
        "collective_summary": collective_summary,
        "hats": hats_data.get("hats", []),
        "chapters": chapters,
        "mindmap": mindmap
    }
