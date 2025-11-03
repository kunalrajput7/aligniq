"""
Stage 5: Build a coverage-first mindmap similar to NotebookLM.

This implementation assembles a typed knowledge graph directly from the unified
stage output instead of delegating to a downstream LLM. The goal is to provide
strong topic coverage, keep action items/achievements/blockers attached to
their driving themes, and surface granular "claim" level nuggets that make the
mindmap feel alive.
"""
from __future__ import annotations

import asyncio
import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

import numpy as np
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .common import _fmt_local

THEME_LIMIT_DEFAULT = 6
CLAIMS_PER_THEME = 3
OUTCOMES_PER_THEME = 2
MIN_CLAIM_WORDS = 7

OUTCOME_TYPE_WEIGHT = {
    "decision": 220,
    "action": 200,
    "achievement": 170,
    "blocker": 120,
    "concern": 110,
}


def _truncate_text(text: str, limit: int = 72) -> str:
    text = _clean(text)
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def _clean(text: Optional[str]) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", str(text)).strip()


def _tokenize(text: str) -> Set[str]:
    if not text:
        return set()
    tokens = re.findall(r"[a-zA-Z][a-zA-Z0-9]+", text.lower())
    return {t for t in tokens if len(t) > 2}


def _slugify(text: str, default: str, max_len: int = 32) -> str:
    if not text:
        return default
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text.lower()).strip("-")
    if not text:
        return default
    return text[:max_len]


def _parse_ts_string(ts: Optional[str]) -> Optional[int]:
    """Convert HH:MM:SS or MM:SS strings to milliseconds."""
    if not ts:
        return None
    ts = ts.strip()
    match = re.match(r"^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?$", ts)
    if not match:
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    millis = int(match.group(4) or 0)
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis


def _format_ms(ms: Optional[int]) -> Optional[str]:
    if ms is None:
        return None
    return _fmt_local(ms)


# ---------------------------------------------------------------------------
# Data containers
# ---------------------------------------------------------------------------


@dataclass
class Claim:
    id: str
    text: str
    source: str
    chapter_id: Optional[str]
    chapter_title: Optional[str]
    participants: List[str] = field(default_factory=list)
    time_hint_ms: Optional[int] = None
    confidence: float = 0.7
    theme_id: Optional[str] = None


@dataclass
class Outcome:
    id: str
    type: str  # action|achievement|blocker|decision
    title: str
    owner: Optional[str]
    people: List[str] = field(default_factory=list)
    deadline: Optional[str] = None
    status: Optional[str] = None
    evidence: List[Dict[str, str]] = field(default_factory=list)
    time_hint_ms: Optional[int] = None
    confidence: float = 0.8
    theme_id: Optional[str] = None

    @property
    def description(self) -> str:
        parts: List[str] = [self.title]
        if self.owner:
            parts.append(f"Owner: {self.owner}")
        if self.deadline:
            parts.append(f"Deadline: {self.deadline}")
        if self.status and self.status.lower() not in {"pending", "to-do"}:
            parts.append(f"Status: {self.status}")
        if self.evidence:
            quotes = [f"{ev.get('t', '')} — {ev.get('quote', '')}" for ev in self.evidence[:2]]
            parts.append("Evidence: " + "; ".join(_clean(q) for q in quotes if _clean(q)))
        return " | ".join(part for part in parts if part)


@dataclass
class Theme:
    id: str
    label: str
    claim_indices: List[int] = field(default_factory=list)
    outcome_ids: List[str] = field(default_factory=list)
    chapters: Set[str] = field(default_factory=set)
    keywords: List[str] = field(default_factory=list)
    score: float = 0.0


# ---------------------------------------------------------------------------
# Coverage-first mindmap builder
# ---------------------------------------------------------------------------


class CoverageMindmapBuilder:
    """Build a structured mindmap graph from unified analysis output."""

    def __init__(
        self,
        meeting_details: Dict[str, Any],
        narrative_summary: str,
        chapters: List[Dict[str, Any]],
        collective_summary: Dict[str, Any],
        timeline: List[Dict[str, Any]],
        hats: Iterable[Dict[str, Any]],
        max_visible_themes: int = 7,
    ) -> None:
        self.meeting_details = meeting_details or {}
        self.narrative_summary = narrative_summary or ""
        self.chapters = chapters or []
        self.collective_summary = collective_summary or {}
        self.timeline = timeline or []
        self.hats = list(hats or [])
        self.max_visible_themes = max_visible_themes

        self.participants: List[str] = [
            p for p in (self.meeting_details.get("participants") or []) if _clean(p)
        ]
        self.participant_lookup = {p.lower(): p for p in self.participants}

        self.timeline_entries: List[Dict[str, Any]] = []
        for entry in self.timeline:
            tokens = _tokenize(entry.get("text", ""))
            speakers = [s for s in entry.get("speakers", []) if _clean(s)]
            self.timeline_entries.append(
                {
                    "timestamp_ms": entry.get("timestamp_ms"),
                    "text": entry.get("text", ""),
                    "tokens": tokens,
                    "speakers": speakers,
                }
            )

        self.claims: List[Claim] = []
        self.outcomes: List[Outcome] = []
        self.themes: List[Theme] = []
        self.vectorizer: Optional[TfidfVectorizer] = None

    # ------------------------------------------------------------------ build

    def build(self) -> Dict[str, Any]:
        self._extract_claims()
        self._extract_outcomes()
        self._ensure_participation_claims()
        self._cluster_claims_into_themes()
        self._attach_outcomes_to_themes()
        self._rebalance_theme_visibility()
        return self._export_graph()

    # ---------------------------------------------------------------- claims

    def _extract_claims(self) -> None:
        claim_id = 1

        def add_claim(text: str, source: str, chapter: Optional[Dict[str, Any]]) -> None:
            nonlocal claim_id
            cleaned = _clean(text)
            if len(cleaned.split()) < 4:
                return
            participants = self._detect_participants(cleaned)
            time_hint = self._match_time_hint(cleaned, participants)
            claim = Claim(
                id=f"claim-{claim_id:03d}",
                text=cleaned,
                source=source,
                chapter_id=chapter.get("chapter_id") if chapter else None,
                chapter_title=chapter.get("title") if chapter else None,
                participants=participants,
                time_hint_ms=time_hint,
                confidence=0.75 if participants else 0.7,
            )
            self.claims.append(claim)
            claim_id += 1

        # Narrative summary sentences
        for sentence in self._split_sentences(self.narrative_summary):
            add_claim(sentence, "Executive Narrative", None)

        # Chapter summaries
        for chapter in self.chapters:
            summary = chapter.get("summary") or ""
            source = _clean(chapter.get("title") or "Chapter")
            for bullet in self._split_sentences(summary):
                add_claim(bullet, source, chapter)

    def _split_sentences(self, text: str) -> List[str]:
        text = text.replace("\r", "\n")
        segments: List[str] = []
        for raw_line in text.split("\n"):
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith(("-", "*")):
                line = line.lstrip("-* ").strip()
            segments.extend(re.split(r"(?<=[.!?])\s+", line))
        return [_clean(seg) for seg in segments if len(_clean(seg).split()) >= 4]

    def _detect_participants(self, text: str) -> List[str]:
        lowered = text.lower()
        detected = []
        for participant in self.participants:
            if participant.lower() in lowered:
                detected.append(participant)
        return detected

    def _match_time_hint(self, text: str, participants: Sequence[str]) -> Optional[int]:
        if not self.timeline_entries:
            return None
        tokens = _tokenize(text)
        best_score = 0
        best_time = None
        participant_set = {p.lower() for p in participants}
        for entry in self.timeline_entries:
            score = len(tokens & entry["tokens"])
            if participant_set and entry["speakers"]:
                speaker_overlap = len(participant_set & {s.lower() for s in entry["speakers"]})
                score += 2 * speaker_overlap
            if score > best_score and entry["timestamp_ms"] is not None:
                best_score = score
                best_time = entry["timestamp_ms"]
        return best_time if best_score >= 2 else None

    # ---------------------------------------------------------------- outcomes

    def _extract_outcomes(self) -> None:
        outcome_id = 1

        def add_outcome(
            type_: str,
            title: str,
            owner: Optional[str],
            people: Sequence[str],
            deadline: Optional[str],
            status: Optional[str],
            evidence: List[Dict[str, str]],
            time_hint_ms: Optional[int],
        ) -> None:
            nonlocal outcome_id
            title_clean = _clean(title)
            if not title_clean:
                return
            people_clean = [_clean(p) for p in people if _clean(p)]
            outcome = Outcome(
                id=f"outcome-{outcome_id:03d}",
                type=type_,
                title=title_clean,
                owner=_clean(owner) or None,
                people=people_clean,
                deadline=_clean(deadline) or None,
                status=_clean(status) or None,
                evidence=evidence or [],
                time_hint_ms=time_hint_ms,
                confidence=0.85 if evidence else 0.75,
            )
            self.outcomes.append(outcome)
            outcome_id += 1

        for item in self.collective_summary.get("action_items", []) or []:
            evidence = item.get("evidence") or []
            time_hint = item.get("timestamp_ms") or _parse_ts_string(
                evidence[0].get("t") if evidence else None
            )
            add_outcome(
                "action",
                item.get("task") or item.get("action") or "",
                item.get("owner") or item.get("assignee"),
                [item.get("owner"), item.get("assignee")] if item.get("assignee") else [item.get("owner")],
                item.get("deadline") or item.get("due_date"),
                item.get("status"),
                evidence,
                time_hint,
            )

        for item in self.collective_summary.get("achievements", []) or []:
            evidence = item.get("evidence") or []
            time_hint = _parse_ts_string(evidence[0].get("t")) if evidence else None
            members = item.get("members") or [item.get("member")]
            add_outcome(
                "achievement",
                item.get("achievement") or "",
                None,
                members or [],
                None,
                None,
                evidence,
                time_hint,
            )

        for item in self.collective_summary.get("blockers", []) or []:
            evidence = item.get("evidence") or []
            time_hint = _parse_ts_string(evidence[0].get("t")) if evidence else None
            people = item.get("affected_members") or [item.get("member")]
            add_outcome(
                "blocker",
                item.get("blocker") or "",
                item.get("owner"),
                people or [],
                None,
                None,
                evidence,
                time_hint,
            )

    # ------------------------------------------------------- participation gap

    def _ensure_participation_claims(self) -> None:
        mentioned = {p for claim in self.claims for p in claim.participants}
        mentioned.update({p for outcome in self.outcomes for p in outcome.people if p})
        if not self.participants:
            return
        missing = [p for p in self.participants if p not in mentioned]
        for participant in missing:
            filler = Claim(
                id=f"claim-{len(self.claims) + 1:03d}",
                text=f"{participant} attended the meeting; no direct contributions were captured in the transcript.",
                source="Attendance",
                chapter_id=None,
                chapter_title=None,
                participants=[participant],
                time_hint_ms=None,
                confidence=0.55,
            )
            self.claims.append(filler)

    # -------------------------------------------------------- clustering logic

    def _cluster_claims_into_themes(self) -> None:
        if not self.claims:
            self.themes = [
                Theme(id="theme-001", label="Key Topics", claim_indices=[], keywords=[], score=0.0)
            ]
            return

        texts = [claim.text for claim in self.claims]
        self.vectorizer = TfidfVectorizer(
            stop_words="english", ngram_range=(1, 2), min_df=1, max_df=0.9
        )
        tfidf_matrix = self.vectorizer.fit_transform(texts)

        n_claims = len(self.claims)
        if n_claims < 4:
            labels = np.zeros(n_claims, dtype=int)
            n_clusters = 1
        else:
            n_clusters = min(self.max_visible_themes + 2, max(2, n_claims // 4))
            n_clusters = min(n_clusters, n_claims)
            # KMeans can fail if there are fewer features than clusters; guard.
            if tfidf_matrix.shape[1] < n_clusters:
                n_clusters = max(1, tfidf_matrix.shape[1])
            if n_clusters == 0:
                n_clusters = 1
            kmeans = KMeans(n_clusters=n_clusters, n_init="auto", random_state=42)
            labels = kmeans.fit_predict(tfidf_matrix)

        feature_names = self.vectorizer.get_feature_names_out()
        theme_map: Dict[int, Theme] = {}
        for cluster_idx in range(int(labels.max()) + 1):
            claim_indices = [i for i, label in enumerate(labels) if label == cluster_idx]
            if not claim_indices:
                continue
            cluster_matrix = tfidf_matrix[claim_indices]
            centroid = np.asarray(cluster_matrix.mean(axis=0)).ravel()
            top_indexes = centroid.argsort()[-6:][::-1]
            keywords = [feature_names[i] for i in top_indexes if centroid[i] > 0]
            pretty_keywords = [kw.replace("-", " ").title() for kw in keywords[:3]]
            label = " / ".join(pretty_keywords) if pretty_keywords else f"Theme {cluster_idx + 1}"
            theme_id = f"theme-{cluster_idx + 1:03d}"
            theme_map[cluster_idx] = Theme(
                id=theme_id,
                label=label,
                claim_indices=claim_indices,
                keywords=keywords[:5],
                score=float(len(claim_indices)),
            )

        # Assign theme IDs back to claims and gather chapter coverage.
        for claim_idx, label in enumerate(labels):
            theme = theme_map.get(int(label))
            if theme is None:
                continue
            self.claims[claim_idx].theme_id = theme.id
            if self.claims[claim_idx].chapter_id:
                theme.chapters.add(self.claims[claim_idx].chapter_id or "")

        # The builder stores themes as an ordered list sorted by score.
        self.themes = sorted(theme_map.values(), key=lambda t: t.score, reverse=True)

        # Fallback in case clustering produced zero themes.
        if not self.themes:
            self.themes = [
                Theme(id="theme-001", label="Key Topics", claim_indices=list(range(n_claims)))
            ]
            for idx in range(n_claims):
                self.claims[idx].theme_id = "theme-001"

    # ---------------------------------------------------------- outcome attach

    def _attach_outcomes_to_themes(self) -> None:
        if not self.themes:
            return

        # Pre-compute theme vectors using aggregated claim text per theme.
        if self.vectorizer is None:
            theme_vectors = None
        else:
            theme_texts = []
            for theme in self.themes:
                if theme.claim_indices:
                    text = " ".join(self.claims[idx].text for idx in theme.claim_indices)
                else:
                    text = theme.label
                theme_texts.append(text)
            theme_vectors = self.vectorizer.transform(theme_texts)

        for outcome in self.outcomes:
            assigned_theme_idx = 0
            best_score = -1.0
            if theme_vectors is not None and self.vectorizer is not None:
                try:
                    outcome_vec = self.vectorizer.transform([outcome.title])
                    sims = cosine_similarity(outcome_vec, theme_vectors).ravel()
                    assigned_theme_idx = int(np.argmax(sims)) if sims.size else 0
                    best_score = sims[assigned_theme_idx] if sims.size else -1.0
                except ValueError:
                    best_score = -1.0

            # Secondary heuristic: match participants or chapters.
            if best_score < 0.12:
                participant_scores = []
                for idx, theme in enumerate(self.themes):
                    participant_mentions = 0
                    for claim_idx in theme.claim_indices:
                        participant_mentions += len(
                            set(outcome.people) & set(self.claims[claim_idx].participants)
                        )
                    participant_scores.append((participant_mentions, idx))
                best_idx = max(participant_scores)[1] if participant_scores else 0
                if participant_scores and participant_scores[best_idx][0] > 0:
                    assigned_theme_idx = best_idx
            theme = self.themes[assigned_theme_idx]
            outcome.theme_id = theme.id
            theme.outcome_ids.append(outcome.id)
            theme.score += 1.5  # outcomes increase importance

    # -------------------------------------------------------- rebalance themes

    def _rebalance_theme_visibility(self) -> None:
        if not self.themes:
            return

        # Remove empty themes
        populated_themes = [
            theme
            for theme in self.themes
            if theme.claim_indices or theme.outcome_ids
        ]
        if not populated_themes:
            populated_themes = [self.themes[0]]
        self.themes = populated_themes

        # Cap visible themes and fold the rest under "More Topics".
        if len(self.themes) > self.max_visible_themes:
            self.themes.sort(key=lambda t: t.score, reverse=True)
            keep = self.themes[: self.max_visible_themes]
            overflow = self.themes[self.max_visible_themes :]
            if overflow:
                merged = Theme(
                    id="theme-more",
                    label="More Topics",
                    claim_indices=[],
                    keywords=["miscellaneous", "additional"],
                    score=0.0,
                )
                for theme in overflow:
                    merged.claim_indices.extend(theme.claim_indices)
                    merged.outcome_ids.extend(theme.outcome_ids)
                    merged.chapters.update(theme.chapters)
                    merged.score += theme.score
                    for claim_idx in theme.claim_indices:
                        self.claims[claim_idx].theme_id = merged.id
                    for outcome in self.outcomes:
                        if outcome.id in theme.outcome_ids:
                            outcome.theme_id = merged.id
                if merged.claim_indices or merged.outcome_ids:
                    keep.append(merged)
            self.themes = keep

        # Recalculate chapter associations for retained themes.
        for theme in self.themes:
            chapters = set()
            for claim_idx in theme.claim_indices:
                chapter_id = self.claims[claim_idx].chapter_id
                if chapter_id:
                    chapters.add(chapter_id)
            theme.chapters = chapters

    # -------------------------------------------------------------- export

    def _export_graph(self) -> Dict[str, Any]:
        meeting_title = _clean(self.meeting_details.get("title")) or "Meeting Mindmap"
        center_node = {"id": "root", "label": meeting_title, "type": "root"}

        chapter_lookup = {chapter.get("chapter_id"): chapter for chapter in self.chapters}
        chapter_titles = {cid: _clean(data.get("title")) for cid, data in chapter_lookup.items()}

        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []

        chapters_seen: Dict[Tuple[str, str], str] = {}

        def theme_summary(theme: Theme) -> str:
            highlight_claims = [self.claims[idx].text for idx in theme.claim_indices[:3]]
            highlight_outcomes = [
                outcome.description
                for outcome in self.outcomes
                if outcome.id in theme.outcome_ids
            ][:2]
            pieces = []
            if highlight_claims:
                pieces.append("Key points: " + " ".join(highlight_claims))
            if highlight_outcomes:
                pieces.append("Outcomes: " + " ".join(highlight_outcomes))
            return " ".join(pieces)[:500] if pieces else ""

        for theme in self.themes:
            nodes.append(
                {
                    "id": theme.id,
                    "label": theme.label,
                    "type": "theme",
                    "parent_id": "root",
                    "description": theme_summary(theme),
                    "confidence": min(0.95, 0.6 + 0.05 * theme.score),
                }
            )

            # Chapter sub-nodes per theme
            for claim_idx in theme.claim_indices:
                claim = self.claims[claim_idx]
                parent_id = theme.id
                if claim.chapter_id:
                    key = (theme.id, claim.chapter_id)
                    if key not in chapters_seen:
                        node_id = f"{theme.id}-chapter-{_slugify(claim.chapter_id, 'chapter')}"
                        chapter_title = chapter_titles.get(claim.chapter_id, "Chapter")
                        chapter_desc = _clean(
                            (chapter_lookup.get(claim.chapter_id) or {}).get("summary")
                        )
                        nodes.append(
                            {
                                "id": node_id,
                                "label": chapter_title or "Chapter",
                                "type": "chapter",
                                "parent_id": theme.id,
                                "description": chapter_desc[:400] if chapter_desc else "",
                                "confidence": 0.65,
                            }
                        )
                        chapters_seen[key] = node_id
                    parent_id = chapters_seen[key]

                claim_label = claim.text[:80] + ("…" if len(claim.text) > 80 else "")
                nodes.append(
                    {
                        "id": claim.id,
                        "label": claim_label,
                        "type": "claim",
                        "parent_id": parent_id,
                        "description": self._describe_claim(claim),
                        "timestamp": _format_ms(claim.time_hint_ms),
                        "confidence": min(0.95, claim.confidence),
                    }
                )

            # Outcome nodes living directly under the theme
            for outcome in self.outcomes:
                if outcome.theme_id != theme.id:
                    continue
                outcome_label = self._outcome_label(outcome)
                nodes.append(
                    {
                        "id": outcome.id,
                        "label": outcome_label,
                        "type": outcome.type,
                        "parent_id": theme.id,
                        "description": outcome.description[:500],
                        "timestamp": _format_ms(outcome.time_hint_ms),
                        "confidence": min(0.95, outcome.confidence),
                    }
                )

        graph = {
            "center_node": center_node,
            "nodes": nodes,
            "edges": edges,
            "meta": {
                "themes": len(self.themes),
                "claims": len(self.claims),
                "outcomes": len(self.outcomes),
            },
        }
        return graph

    # ---------------------------------------------------------- descriptions

    def _describe_claim(self, claim: Claim) -> str:
        parts = [claim.text]
        if claim.source:
            parts.append(f"Source: {claim.source}")
        if claim.participants:
            parts.append("Participants: " + ", ".join(sorted(set(claim.participants))))
        if claim.time_hint_ms is not None:
            parts.append(f"Timing: {_format_ms(claim.time_hint_ms)}")
        return " | ".join(parts)

    def _outcome_label(self, outcome: Outcome) -> str:
        prefix = {
            "action": "Action",
            "achievement": "Win",
            "blocker": "Blocker",
            "decision": "Decision",
        }.get(outcome.type, "Outcome")
        return f"{prefix}: {outcome.title[:70]}{'…' if len(outcome.title) > 70 else ''}"


# ---------------------------------------------------------------------------
# Public coroutine
# ---------------------------------------------------------------------------


async def build_mindmap_async(
    meeting_details: Dict[str, Any],
    narrative_summary: str,
    chapters: List[Dict[str, Any]],
    collective_summary: Dict[str, Any],
    timeline: List[Dict[str, Any]],
    hats: Iterable[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Build the mindmap graph using the coverage-first approach.
    """

    builder = CoverageMindmapBuilder(
        meeting_details=meeting_details,
        narrative_summary=narrative_summary,
        chapters=chapters,
        collective_summary=collective_summary,
        timeline=timeline,
        hats=hats,
    )
    return builder.build()

