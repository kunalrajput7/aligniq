"""
Stage 4: Build a simple chapter-based mindmap.

This creates a clean, focused mindmap structure:
Root (Meeting Title) → Chapters → Key Points from each chapter

Simple and easy to understand!
"""
from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional


def _clean(text: Optional[str]) -> str:
    """Clean and normalize text."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", str(text)).strip()


def _truncate(text: str, max_len: int = 90) -> str:
    """Truncate text to max length with ellipsis."""
    text = _clean(text)
    if len(text) <= max_len:
        return text
    return text[:max_len - 1].rstrip() + "…"


def _format_ms(ms: Optional[int]) -> str:
    """Format milliseconds as HH:MM:SS."""
    if ms is None:
        return "00:00:00"

    seconds_total = int(ms) // 1000
    seconds = seconds_total % 60
    minutes = (seconds_total // 60) % 60
    hours = seconds_total // 3600
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def _extract_key_points(chapter_summary: str, max_points: int = 2) -> List[str]:
    """
    Extract the MOST IMPORTANT key points from a chapter summary.

    Looks for:
    - Bullet points (lines starting with -, *, •) - prioritized
    - Numbered lists (1., 2., etc.)
    - First substantial sentences if no lists found

    Only extracts the most meaningful, substantial points.
    """
    if not chapter_summary:
        return []

    lines = chapter_summary.split('\n')
    points = []

    # First, try to find bullet points or numbered lists
    for line in lines:
        line = line.strip()

        # Match bullet points (-, *, •)
        if re.match(r'^[-*•]\s+', line):
            point = re.sub(r'^[-*•]\s+', '', line).strip()
            # Only include substantial points (at least 25 chars)
            if point and len(point) > 25:
                points.append(point)

        # Match numbered lists (1., 2., etc.)
        elif re.match(r'^\d+\.\s+', line):
            point = re.sub(r'^\d+\.\s+', '', line).strip()
            # Only include substantial points (at least 25 chars)
            if point and len(point) > 25:
                points.append(point)

        if len(points) >= max_points:
            break

    # If no list items found, extract first substantial sentences
    if not points:
        # Remove markdown headers and formatting
        clean_text = re.sub(r'^#+\s+', '', chapter_summary, flags=re.MULTILINE)
        clean_text = re.sub(r'\*\*(.*?)\*\*', r'\1', clean_text)  # Remove bold

        # Split into sentences
        sentences = re.split(r'[.!?]\s+', clean_text)
        for sentence in sentences:
            sentence = sentence.strip()
            # Only include substantial, meaningful sentences (30+ chars)
            if len(sentence) > 30 and not sentence.startswith(('The', 'This', 'It')):
                points.append(sentence)
            if len(points) >= max_points:
                break

    return points[:max_points]


async def build_mindmap_async(
    meeting_details: Dict[str, Any],
    narrative_summary: str,
    chapters: List[Dict[str, Any]],
    collective_summary: Dict[str, Any],
    timeline: List[Dict[str, Any]],
    hats: Iterable[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Build a simple chapter-based mindmap.

    Structure:
    - Root node: Meeting title
    - Chapter nodes: One for each chapter
    - Point nodes: 2-3 key points per chapter (extracted from chapter summary)

    Args:
        meeting_details: Meeting metadata
        narrative_summary: Not used (chapters have summaries)
        chapters: List of chapters with summaries
        collective_summary: Not used in simple version
        timeline: Not used in simple version
        hats: Not used in simple version

    Returns:
        Mindmap structure with center_node, nodes, and edges
    """

    meeting_title = _clean(meeting_details.get("title", "Meeting Mindmap"))

    # Create root node
    center_node = {
        "id": "root",
        "label": meeting_title,
        "type": "root"
    }

    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    # Create chapter nodes and their key points
    for idx, chapter in enumerate(chapters):
        chapter_id = chapter.get("chapter_id", f"ch{idx+1}")
        chapter_title = _clean(chapter.get("title", f"Chapter {idx+1}"))
        chapter_summary = _clean(chapter.get("summary", ""))
        start_ms = chapter.get("start_ms", 0)
        end_ms = chapter.get("end_ms", 0)

        # Add chapter node with full title
        chapter_node = {
            "id": chapter_id,
            "label": chapter_title,  # Full title, no truncation
            "type": "chapter",
            "parent_id": "root",
            "description": chapter_summary[:500],  # First 500 chars of summary for description
            "timestamp": _format_ms(start_ms),
            "confidence": 0.9
        }
        nodes.append(chapter_node)

        # Add edge from root to chapter
        edges.append({
            "id": f"root->{chapter_id}",
            "source": "root",
            "target": chapter_id
        })

        # Extract only the most important key points from chapter summary
        key_points = _extract_key_points(chapter_summary, max_points=2)

        for point_idx, point_text in enumerate(key_points):
            point_id = f"{chapter_id}_point{point_idx+1}"

            point_node = {
                "id": point_id,
                "label": point_text,  # Full text, no truncation
                "type": "claim",  # Using 'claim' type for key points
                "parent_id": chapter_id,
                "description": point_text,  # Full text in description
                "confidence": 0.85
            }
            nodes.append(point_node)

            # Add edge from chapter to point
            edges.append({
                "id": f"{chapter_id}->{point_id}",
                "source": chapter_id,
                "target": point_id
            })

    # Build final mindmap structure
    mindmap = {
        "center_node": center_node,
        "nodes": nodes,
        "edges": edges,
        "meta": {
            "chapters": len(chapters),
            "total_nodes": len(nodes),
            "total_edges": len(edges)
        }
    }

    return mindmap


def build_mindmap(
    meeting_details: Dict[str, Any],
    narrative_summary: str,
    chapters: List[Dict[str, Any]],
    collective_summary: Dict[str, Any],
    timeline: List[Dict[str, Any]],
    hats: Iterable[Dict[str, Any]],
) -> Dict[str, Any]:
    """Synchronous wrapper for build_mindmap_async."""
    import asyncio
    return asyncio.run(build_mindmap_async(
        meeting_details, narrative_summary, chapters,
        collective_summary, timeline, hats
    ))
