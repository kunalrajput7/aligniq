"""
VTT Parser for Microsoft Teams transcripts.
Parses .vtt files and extracts utterances with timestamps and speakers.
"""
import re
from typing import List, Dict, Optional


def parse_timestamp(ts: str) -> int:
    """
    Parse VTT timestamp (HH:MM:SS.mmm) to milliseconds.
    Example: "00:01:23.456" -> 83456
    """
    ts = ts.strip()
    # Handle format: HH:MM:SS.mmm or MM:SS.mmm
    parts = ts.split(":")
    if len(parts) == 3:
        h, m, s = parts
        h = int(h)
    elif len(parts) == 2:
        h = 0
        m, s = parts
    else:
        return 0

    m = int(m)
    if "." in s:
        sec, ms = s.split(".")
        sec = int(sec)
        ms = int(ms)
    else:
        sec = int(s)
        ms = 0

    total_ms = (h * 3600 + m * 60 + sec) * 1000 + ms
    return total_ms


def parse_vtt(content: str) -> List[Dict[str, object]]:
    """
    Parse VTT file content and return list of utterances.

    Returns:
        List[Dict] with keys: start_ms, end_ms, speaker, text
    """
    utterances: List[Dict[str, object]] = []

    lines = content.split("\n")
    i = 0
    n = len(lines)

    # Skip header
    while i < n and not lines[i].strip().startswith("WEBVTT"):
        i += 1
    if i < n:
        i += 1  # skip WEBVTT line

    while i < n:
        line = lines[i].strip()

        # Skip empty lines and NOTE lines
        if not line or line.startswith("NOTE"):
            i += 1
            continue

        # Check if this is a timestamp line (contains -->)
        if "-->" in line:
            # Parse timestamp
            timestamp_match = re.match(r"([\d:\.]+)\s*-->\s*([\d:\.]+)", line)
            if timestamp_match:
                start_str = timestamp_match.group(1)
                end_str = timestamp_match.group(2)
                start_ms = parse_timestamp(start_str)
                end_ms = parse_timestamp(end_str)

                # Next line should be speaker and text
                i += 1
                if i < n:
                    text_line = lines[i].strip()

                    # Extract speaker (format: "<v Speaker Name>text" or "Speaker Name: text")
                    speaker = "Unknown"
                    text = text_line

                    # Try <v Speaker> format
                    voice_match = re.match(r"<v\s+([^>]+)>(.*)", text_line)
                    if voice_match:
                        speaker = voice_match.group(1).strip()
                        text = voice_match.group(2).strip()
                    else:
                        # Try "Speaker: text" format
                        colon_match = re.match(r"([^:]+):\s*(.*)", text_line)
                        if colon_match:
                            speaker = colon_match.group(1).strip()
                            text = colon_match.group(2).strip()

                    # Clean up speaker name
                    if not speaker or speaker.lower() == "unknown":
                        speaker = "Speaker ?"

                    # Add utterance
                    if text:
                        utterances.append({
                            "start_ms": start_ms,
                            "end_ms": end_ms,
                            "speaker": speaker,
                            "text": text
                        })

        i += 1

    return utterances


def parse_vtt_file(file_path: str) -> List[Dict[str, object]]:
    """
    Parse VTT file from file path.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    return parse_vtt(content)
