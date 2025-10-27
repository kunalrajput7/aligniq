"""
Pipeline orchestrator: Runs all stages with parallel execution where possible.
"""
from __future__ import annotations
from typing import Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

from utils.vtt_parser import parse_vtt
from stages.segmentation import segment_utterances
from stages.stage0_meeting_details import infer_meeting_details
from stages.stage1_summaries import summarize_segments
from stages.stage2_collective import summarize_collective
from stages.stage3_supplementary import extract_supplementary
from stages.stage4_chapters import build_chapters


def run_pipeline(
    vtt_content: str,
    model: Optional[str] = None,
    segment_len_ms: int = 600_000,  # 10 minutes
) -> Dict[str, Any]:
    """
    Run the complete meeting summarization pipeline with parallel execution.

    Execution flow:
    1. Parse VTT and segment utterances (fast, no LLM)
    2. Stage 0 & Stage 1 run in parallel (independent)
    3. After Stage 1, Stages 2, 3, 4 run in parallel (all depend on Stage 1)

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
                "decisions": [...],
                "action_items": [...],
                "achievements": [...],
                "blockers": [...],
                "concerns": [...]
            },
            "supplementary": {
                "who_did_what": [...],
                "hats": [...]
            },
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
            "collective_summary": {
                "narrative_summary": "",
                "decisions": [],
                "action_items": [],
                "achievements": [],
                "blockers": [],
                "concerns": []
            },
            "supplementary": {
                "who_did_what": [],
                "hats": []
            },
            "chapters": []
        }

    # Segment utterances (fast, no LLM)
    segments = segment_utterances(
        utterances,
        segment_len_ms=segment_len_ms,
        overlap_ratio=0.0,
        include_text=True,
        include_mapping=False
    )

    # Run Stage 0 (meeting details) and Stage 1 (segment summaries) in parallel
    # They are independent and can run concurrently
    with ThreadPoolExecutor(max_workers=2) as executor:
        future_stage0 = executor.submit(infer_meeting_details, utterances, model)
        future_stage1 = executor.submit(summarize_segments, segments, model)

        meeting_details = future_stage0.result()
        segment_summaries = future_stage1.result()

    # After Stage 1 completes, run Stages 2, 3, 4 in parallel
    # All three depend on segment_summaries but are independent of each other
    with ThreadPoolExecutor(max_workers=3) as executor:
        future_stage2 = executor.submit(summarize_collective, segment_summaries, model)
        future_stage3 = executor.submit(extract_supplementary, segment_summaries, model)
        future_stage4 = executor.submit(build_chapters, segment_summaries, model)

        collective_summary = future_stage2.result()
        supplementary = future_stage3.result()
        chapters = future_stage4.result()

    return {
        "meeting_details": meeting_details,
        "segments": segments,
        "segment_summaries": segment_summaries,
        "collective_summary": collective_summary,
        "supplementary": supplementary,
        "chapters": chapters
    }
