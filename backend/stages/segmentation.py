"""
Segmentation: Split utterances into time-based segments.
"""
from __future__ import annotations
from typing import List, Dict, Iterable
from .common import _fmt_local


# Types
Utterance = Dict[str, object]
Segment = Dict[str, object]

# Defaults
DEFAULT_INCLUDE_TEXT = True
DEFAULT_INCLUDE_MAPPING = False


def _fmt_id(idx: int) -> str:
    """Format segment ID."""
    return f"seg-{idx:04d}"


def _utterance_lines(utts: Iterable[Utterance], w_start: int) -> List[str]:
    """Format utterances as timeline lines."""
    out = []
    for u in utts:
        local_start = max(0, int(u["start_ms"]) - w_start)
        out.append(f'{_fmt_local(local_start)} | {u["speaker"]} | {u["text"]}')
    return out


def segment_utterances(
    utterances: List[Utterance],
    segment_len_ms: int = 600_000,  # 10 minutes
    overlap_ratio: float = 0.0,
    include_text: bool = DEFAULT_INCLUDE_TEXT,
    include_mapping: bool = DEFAULT_INCLUDE_MAPPING,
) -> List[Segment]:
    """
    Split utterances into time-based segments.

    Args:
        utterances: List of utterance dicts
        segment_len_ms: Segment length in milliseconds (default 10 minutes)
        overlap_ratio: Overlap ratio between segments (default 0.0)
        include_text: Include text in segments
        include_mapping: Include utterance mapping in segments

    Returns:
        List of segment dicts
    """
    if not utterances:
        return []

    stride = max(1, int(segment_len_ms * (1 - overlap_ratio)))
    total_ms = int(utterances[-1]["end_ms"])

    segments: List[Segment] = []
    w_start = 0
    idx = 0

    n = len(utterances)
    left = 0
    right = 0

    while w_start < total_ms:
        w_end = w_start + segment_len_ms

        # Find utterances in this window
        while left < n and int(utterances[left]["end_ms"]) <= w_start:
            left += 1

        if right < left:
            right = left
        while right < n and int(utterances[right]["start_ms"]) < w_end:
            right += 1

        slice_utts = utterances[left:right]

        seg: Segment = {
            "id": _fmt_id(idx),
            "window_start_ms": w_start,
            "window_end_ms": w_end,
            "utterance_range": [
                left if slice_utts else (left or 0),
                (right - 1) if slice_utts else (left - 1 if left > 0 else -1)
            ],
        }

        if include_text:
            seg["text"] = "\n".join(_utterance_lines(slice_utts, w_start))

        if include_mapping:
            mapping = []
            for i in range(left, right):
                u = utterances[i]
                u_start = int(u["start_ms"])
                u_end = int(u["end_ms"])
                mapping.append({
                    "utter_idx": i,
                    "local_start_ms": max(0, u_start - w_start),
                    "local_end_ms": min(segment_len_ms, u_end - w_start),
                    "global_start_ms": u_start,
                    "global_end_ms": u_end,
                })
            seg["mapping"] = mapping

        segments.append(seg)
        idx += 1
        w_start += stride

    return segments
