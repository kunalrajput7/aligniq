"""
Stage 4: Create chapters by clustering similar topics.
"""
from __future__ import annotations
import json
import asyncio
import math
import re
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter, defaultdict
from .common import _resolve_model, _truncate, CHAPTERS_MAX_CHARS, call_ollama_cloud_async


# --- Lightweight tokenizer & stopwords ---
_STOP = {
    "the","a","an","and","or","of","to","in","on","for","with","at","by","from","as",
    "is","are","was","were","be","been","being","this","that","these","those","it","its",
    "we","you","they","he","she","i","me","my","our","your","their","them","us",
    "but","so","not","no","yes","do","does","did","done","can","could","should","would",
    "have","has","had","will","may","might","than","then","there","here","about","into",
}

_TOK_RE = re.compile(r"[A-Za-z0-9_]+")


def _tokens(s: str) -> List[str]:
    """Tokenize text, removing stopwords."""
    return [t.lower() for t in _TOK_RE.findall(s) if t and t.lower() not in _STOP and len(t) > 2]


# --- Tiny TF-IDF (pure Python) ---
def _tfidf_vectors(texts: List[str]) -> Tuple[List[Dict[str, float]], Dict[str, float]]:
    """Calculate TF-IDF vectors for texts."""
    docs = [Counter(_tokens(t)) for t in texts]
    df: Dict[str, int] = defaultdict(int)
    for c in docs:
        for term in c.keys():
            df[term] += 1

    n = max(1, len(texts))
    idf: Dict[str, float] = {
        term: math.log((n + 1) / (df_t + 1)) + 1.0
        for term, df_t in df.items()
    }

    vecs: List[Dict[str, float]] = []
    for c in docs:
        v: Dict[str, float] = {}
        total = sum(c.values()) or 1.0
        for term, cnt in c.items():
            tf = cnt / total
            v[term] = tf * idf[term]
        vecs.append(v)

    return vecs, idf


def _cosine(a: Dict[str, float], b: Dict[str, float]) -> float:
    """Calculate cosine similarity between two vectors."""
    if not a or not b:
        return 0.0
    if len(a) > len(b):
        a, b = b, a

    dot = 0.0
    for k, va in a.items():
        vb = b.get(k)
        if vb:
            dot += va * vb

    na = math.sqrt(sum(x*x for x in a.values()))
    nb = math.sqrt(sum(x*x for x in b.values()))
    if na == 0 or nb == 0:
        return 0.0

    return dot / (na * nb)


def _cluster_segments(
    segment_summaries: List[Dict[str, Any]],
    similarity_threshold: float = 0.28,
    min_chapter_size: int = 1
) -> List[List[int]]:
    """
    Cluster segments by topic similarity.

    Args:
        segment_summaries: List of segment summary dicts
        similarity_threshold: Cosine similarity threshold for clustering
        min_chapter_size: Minimum number of segments per chapter

    Returns:
        List of clusters (each cluster is a list of segment indices)
    """
    texts = [(s.get("summary") or "") for s in segment_summaries]
    vecs, _idf = _tfidf_vectors(texts)

    clusters: List[List[int]] = []
    centroids: List[Dict[str, float]] = []

    def avg_vec(indices: List[int]) -> Dict[str, float]:
        """Calculate average vector for a cluster."""
        acc: Dict[str, float] = defaultdict(float)
        for i in indices:
            for k, v in vecs[i].items():
                acc[k] += v
        size = max(1, len(indices))
        return {k: v / size for k, v in acc.items()}

    # Greedy clustering
    for i, v in enumerate(vecs):
        if not centroids:
            clusters.append([i])
            centroids.append(v)
            continue

        best_j = -1
        best_sim = 0.0
        for j, c in enumerate(centroids):
            sim = _cosine(v, c)
            if sim > best_sim:
                best_sim = sim
                best_j = j

        if best_sim >= similarity_threshold and best_j >= 0:
            clusters[best_j].append(i)
            centroids[best_j] = avg_vec(clusters[best_j])
        else:
            clusters.append([i])
            centroids.append(v)

    # Merge small clusters
    if min_chapter_size > 1:
        big: List[List[int]] = [cl for cl in clusters if len(cl) >= min_chapter_size]
        small: List[int] = [i for i, cl in enumerate(clusters) if len(cl) < min_chapter_size]

        for si in small:
            if not clusters[si]:
                continue
            if not big:
                big.append(clusters[si])
                continue

            v = avg_vec(clusters[si])
            best_idx = -1
            best_sim = 0.0
            for bi, cl in enumerate(big):
                sim = _cosine(v, avg_vec(cl))
                if sim > best_sim:
                    best_sim = sim
                    best_idx = bi

            if best_idx >= 0:
                big[best_idx].extend(clusters[si])

        clusters = big if big else clusters

    # Sort segments within each cluster
    for cl in clusters:
        cl.sort()

    return clusters


CHAPTER_PROMPT = """You are an expert meeting analyst creating thematic chapter summaries.

You will receive a group of segment summaries that discuss a related topic or theme.
Your task: Create a cohesive chapter that synthesizes this topic.

Return STRICT JSON (UTF-8), no markdown code fences.

Schema (exact keys):
{
  "title": "string (<= 10 words)",
  "summary": "string (comprehensive chapter summary)"
}

CHAPTER TITLE GUIDELINES:
- Create a clear, descriptive title that captures the essence of this topic
- Maximum 10 words, but aim for 4-7 words for readability
- Use active, specific language (not generic phrases)
- Examples of good titles:
  * "Q3 Budget Review and Resource Allocation"
  * "Technical Architecture Decision for API Gateway"
  * "Customer Feedback and Product Roadmap Discussion"
- Examples of poor titles:
  * "Discussion" (too vague)
  * "Various Topics" (not descriptive)
  * "Meeting Content" (not specific)

CHAPTER SUMMARY GUIDELINES:
- Write a comprehensive summary that tells the complete story of this topic
- Structure:
  * Opening: What is this topic about and why was it discussed?
  * Main content: What were the key points, perspectives, and discussions?
  * Conclusion: What was decided, concluded, or left unresolved?
- Include:
  * Key participants and their contributions
  * Different viewpoints or perspectives raised
  * Decisions made or conclusions reached
  * Action items specific to this topic
  * Unresolved issues or follow-ups needed
- Synthesize the content intelligently - connect related points
- Maintain chronological flow when it helps understanding
- Use clear paragraphs to organize different aspects of the discussion
- Be factual and specific - include relevant details, numbers, dates
- Do not invent information not present in the segments
- Aim for clarity and completeness

INPUT:
<<<CHAPTER_BUNDLE>>>
"""


def _bundle_for_chapter(cluster_segments: List[Dict[str, Any]]) -> str:
    """Bundle segment summaries for chapter generation."""
    lines: List[str] = []
    for seg in cluster_segments:
        sid = seg.get("segment_id", "")
        summary = (seg.get("summary") or "").strip()
        kp = seg.get("key_points") or {}

        lines.append(f"Segment {sid}")
        lines.append(f"Summary: {summary}")
        if isinstance(kp, dict) and kp:
            lines.append("Key Points:")
            for t, p in list(kp.items())[:12]:
                lines.append(f"- {t}: {p}")
        lines.append("")

    text = "\n".join(lines)
    if len(text) > CHAPTERS_MAX_CHARS:
        text = _truncate(text, CHAPTERS_MAX_CHARS)
    return text


def _build_messages_chapter(bundle: str) -> List[Dict[str, str]]:
    """Build messages for chapter generation."""
    return [
        {"role": "system", "content": "You analyze meetings and return strict JSON that validates."},
        {"role": "user", "content": CHAPTER_PROMPT.replace("<<<CHAPTER_BUNDLE>>>", bundle)},
    ]


def _parse_json_chapter(s: str) -> Dict[str, Any]:
    """Parse chapter JSON response."""
    s = s.strip()
    if s.startswith("```"):
        s = s.strip("`")
        s = s[s.find("\n")+1:] if "\n" in s else s
    first = s.find("{")
    last = s.rfind("}")
    if first != -1 and last != -1 and last > first:
        s = s[first:last+1]
    try:
        obj = json.loads(s)
    except Exception:
        obj = {}
    return {
        "title": str(obj.get("title", "")).strip(),
        "summary": str(obj.get("summary", "")).strip()
    }


async def _summarize_chapter_async(
    cluster_segments: List[Dict[str, Any]],
    model: str,
    max_retries: int = 3,
    sleep_sec: float = 0.8
) -> Dict[str, Any]:
    """Generate title and summary for a chapter asynchronously."""
    bundle = _bundle_for_chapter(cluster_segments)
    messages = _build_messages_chapter(bundle)

    for attempt in range(1, max_retries + 1):
        try:
            content = await call_ollama_cloud_async(model, messages, json_mode=True)
            return _parse_json_chapter(content)
        except Exception as e:
            if attempt == max_retries:
                return {"title": "Chapter", "summary": "", "error": str(e)}
        await asyncio.sleep(sleep_sec)


async def _summarize_chapter_with_metadata_async(
    ci: int,
    idxs: List[int],
    segment_summaries: List[Dict[str, Any]],
    model: str,
    max_retries: int,
    sleep_sec: float
) -> Dict[str, Any]:
    """
    Generate chapter summary with metadata asynchronously (helper for parallel processing).

    Args:
        ci: Chapter index
        idxs: Indices of segments in this chapter
        segment_summaries: All segment summaries
        model: Model name
        max_retries: Max retry attempts
        sleep_sec: Sleep between retries

    Returns:
        Chapter dict with chapter_id, segment_ids, title, summary
    """
    cluster_segments = [segment_summaries[i] for i in idxs]
    seg_ids = [s.get("segment_id", "") for s in cluster_segments]

    chapter_meta = await _summarize_chapter_async(
        cluster_segments,
        model,
        max_retries=max_retries,
        sleep_sec=sleep_sec
    )

    return {
        "chapter_id": f"chap-{ci:03d}",
        "segment_ids": seg_ids,
        "title": chapter_meta.get("title", f"Chapter {ci+1}").strip() or f"Chapter {ci+1}",
        "summary": chapter_meta.get("summary", "").strip(),
    }


async def build_chapters_async(
    segment_summaries: List[Dict[str, Any]],
    model: Optional[str] = None,
    similarity_threshold: float = 0.28,
    min_chapter_size: int = 1,
    max_retries: int = 3,
    sleep_sec: float = 0.8
) -> List[Dict[str, Any]]:
    """
    Build chapters by clustering similar topics using asyncio for parallel processing.

    Args:
        segment_summaries: List of segment summary dicts
        model: Model name (optional)
        similarity_threshold: Cosine similarity threshold for clustering
        min_chapter_size: Minimum segments per chapter
        max_retries: Max retry attempts
        sleep_sec: Sleep between retries

    Returns:
        List of chapter dicts with chapter_id, segment_ids, title, summary (in order)
    """
    if not segment_summaries:
        return []

    model = _resolve_model(model)

    # Cluster segments (this is fast, no LLM calls)
    clusters = _cluster_segments(
        segment_summaries,
        similarity_threshold=similarity_threshold,
        min_chapter_size=min_chapter_size
    )

    if not clusters:
        return []

    # Generate chapter summaries in parallel using asyncio
    tasks = [
        _summarize_chapter_with_metadata_async(
            ci, idxs, segment_summaries, model, max_retries, sleep_sec
        )
        for ci, idxs in enumerate(clusters)
    ]

    # Execute all tasks concurrently
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Handle any exceptions that occurred
    processed_results = []
    for ci, result in enumerate(results):
        if isinstance(result, Exception):
            # If an exception occurred, return error result
            cluster_segments = [segment_summaries[i] for i in clusters[ci]]
            seg_ids = [s.get("segment_id", "") for s in cluster_segments]
            processed_results.append({
                "chapter_id": f"chap-{ci:03d}",
                "segment_ids": seg_ids,
                "title": f"Chapter {ci+1}",
                "summary": "",
                "error": str(result)
            })
        else:
            processed_results.append(result)

    return processed_results
