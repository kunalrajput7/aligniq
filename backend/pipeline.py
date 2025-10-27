"""
Pipeline orchestrator: Runs all stages with parallel execution where possible using asyncio.
"""
from __future__ import annotations
import asyncio
from typing import Dict, Any, Optional

from utils.vtt_parser import parse_vtt
from stages.segmentation import segment_utterances
from stages.stage0_meeting_details import infer_meeting_details_async
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
    2. Stage 0 & Stage 1 run in parallel (independent)
    3. After Stage 1, Stages 2, 3, 4 run in parallel (all depend on Stage 1)
    4. After Stages 2 & 4, Stage 5 runs (depends on collective_summary and chapters)

    Args:
        vtt_content: VTT file content as string
        model: Model name (optional, uses env default)
        segment_len_ms: Segment length in milliseconds

    Returns:
        Dict containing all pipeline outputs:
        {
            "meeting_details": {...},
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
    # Parse VTT
    utterances = parse_vtt(vtt_content)
    if not utterances:
        return {
            "error": "No utterances found in VTT file",
            "meeting_details": {},
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
    segments = segment_utterances(
        utterances,
        segment_len_ms=segment_len_ms,
        overlap_ratio=0.0,
        include_text=True,
        include_mapping=False
    )

    # Run Stage 0 (meeting details) and Stage 1 (segment summaries) in parallel using asyncio.gather()
    # They are independent and can run concurrently
    meeting_details, segment_summaries = await asyncio.gather(
        infer_meeting_details_async(utterances, model),
        summarize_segments_async(segments, model)
    )

    # After Stage 1 completes, run Stages 2, 3, 4 in parallel using asyncio.gather()
    # All three depend on segment_summaries but are independent of each other
    collective_summary, hats_data, chapters = await asyncio.gather(
        summarize_collective_async(segment_summaries, model),
        extract_hats_async(segment_summaries, model),
        build_chapters_async(segment_summaries, model)
    )

    # After Stages 2 & 4 complete, run Stage 5 (mindmap generation)
    # Stage 5 depends on collective_summary and chapters
    mindmap = await build_mindmap_async(
        chapters=chapters,
        collective_summary=collective_summary,
        model=model
    )

    return {
        "meeting_details": meeting_details,
        "segments": segments,
        "segment_summaries": segment_summaries,
        "collective_summary": collective_summary,
        "hats": hats_data.get("hats", []),
        "chapters": chapters,
        "mindmap": mindmap
    }
