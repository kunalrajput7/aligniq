"""
Pipeline orchestrator: Runs all stages in sequence.
"""
from __future__ import annotations
from typing import Dict, Any, Optional

from utils.vtt_parser import parse_vtt
from stages.segmentation import segment_utterances
from stages.stage0_meeting_details import infer_meeting_details
from stages.stage1_summaries import summarize_segments
from stages.stage2_collective import summarize_collective
from stages.stage3_items import extract_items
from stages.stage4_chapters import build_chapters


def run_pipeline(
    vtt_content: str,
    model: Optional[str] = None,
    segment_len_ms: int = 600_000,  # 10 minutes
) -> Dict[str, Any]:
    """
    Run the complete meeting summarization pipeline.

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
            "collective_summary": {...},
            "items": {...},
            "chapters": [...]
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
            "collective_summary": {},
            "items": {},
            "chapters": []
        }

    # Segment utterances
    segments = segment_utterances(
        utterances,
        segment_len_ms=segment_len_ms,
        overlap_ratio=0.0,
        include_text=True,
        include_mapping=False
    )

    # Stage 0: Meeting details
    meeting_details = infer_meeting_details(utterances, model=model)

    # Stage 1: Segment summaries
    segment_summaries = summarize_segments(segments, model=model)

    # Stage 2: Collective summary
    collective_summary = summarize_collective(segment_summaries, model=model)

    # Stage 3: Extract items
    items = extract_items(segment_summaries, model=model)

    # Stage 4: Build chapters
    chapters = build_chapters(segment_summaries, model=model)

    return {
        "meeting_details": meeting_details,
        "segments": segments,
        "segment_summaries": segment_summaries,
        "collective_summary": collective_summary,
        "items": items,
        "chapters": chapters
    }
