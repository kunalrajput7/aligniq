"""
Pydantic models for API request/response schemas.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


# ---------- Meeting Details ----------
class MeetingDetails(BaseModel):
    title: str = Field(..., description="Meeting title")
    date: Optional[str] = Field(None, description="Meeting date (YYYY-MM-DD)")
    duration_ms: int = Field(..., description="Meeting duration in milliseconds")
    participants: List[str] = Field(..., description="List of participant names")
    unknown_count: int = Field(..., description="Count of unknown speakers")


# ---------- Segment Summaries ----------
class KeyPoint(BaseModel):
    """Key point with timestamp and description."""
    pass


class SegmentSummary(BaseModel):
    segment_id: str = Field(..., description="Segment ID (seg-XXXX)")
    summary: str = Field(..., description="Detailed summary of segment")
    key_points: Dict[str, str] = Field(..., description="Timeline key points (MM:SS -> point)")


# ---------- Collective Summary ----------
class CollectiveSummary(BaseModel):
    collective_summary: str = Field(..., description="Comprehensive meeting summary")


# ---------- Items ----------
class Evidence(BaseModel):
    t: str = Field(..., description="Timestamp (MM:SS)")
    quote: str = Field(..., description="Short quote")


class WhoDidWhat(BaseModel):
    actor: str = Field(..., description="Person who did something")
    what: str = Field(..., description="What they did")
    when: str = Field(..., description="When (seg-XXXX or MM:SS)")
    evidence: List[Evidence] = Field(default_factory=list, description="Evidence snippets")
    confidence: float = Field(..., description="Confidence score (0.0-1.0)")


class Task(BaseModel):
    task: str = Field(..., description="Task description")
    owner: Optional[str] = Field(None, description="Task owner")
    assignee: Optional[str] = Field(None, description="Task assignee")
    due_date: Optional[str] = Field(None, description="Due date (YYYY-MM-DD)")
    status: Optional[str] = Field(None, description="Task status")
    evidence: List[Evidence] = Field(default_factory=list, description="Evidence snippets")
    confidence: float = Field(..., description="Confidence score (0.0-1.0)")


class Decision(BaseModel):
    decision: str = Field(..., description="Decision made")
    decider: List[str] = Field(..., description="Who made the decision")
    impact: Optional[str] = Field(None, description="Impact description")
    evidence: List[Evidence] = Field(default_factory=list, description="Evidence snippets")
    confidence: float = Field(..., description="Confidence score (0.0-1.0)")


class Hat(BaseModel):
    speaker: str = Field(..., description="Speaker name")
    hat: str = Field(..., description="Hat color (white|red|black|yellow|green|blue)")
    t: str = Field(..., description="Timestamp (MM:SS)")
    evidence: str = Field(..., description="Evidence/reason")


class Achievement(BaseModel):
    member: str = Field(..., description="Team member")
    achievement: str = Field(..., description="Achievement description")
    evidence: List[Evidence] = Field(default_factory=list, description="Evidence snippets")
    confidence: float = Field(..., description="Confidence score (0.0-1.0)")


class Blocker(BaseModel):
    member: str = Field(..., description="Team member affected")
    blocker: str = Field(..., description="Blocker description")
    owner: Optional[str] = Field(None, description="Person responsible to remove blocker")
    evidence: List[Evidence] = Field(default_factory=list, description="Evidence snippets")
    confidence: float = Field(..., description="Confidence score (0.0-1.0)")


class Items(BaseModel):
    who_did_what: List[WhoDidWhat] = Field(default_factory=list)
    tasks: List[Task] = Field(default_factory=list)
    decisions: List[Decision] = Field(default_factory=list)
    hats: List[Hat] = Field(default_factory=list)
    achievements: List[Achievement] = Field(default_factory=list)
    blockers: List[Blocker] = Field(default_factory=list)


# ---------- Chapters ----------
class Chapter(BaseModel):
    chapter_id: str = Field(..., description="Chapter ID (chap-XXX)")
    segment_ids: List[str] = Field(..., description="Segment IDs in this chapter")
    title: str = Field(..., description="Chapter title")
    summary: str = Field(..., description="Chapter summary")


# ---------- Pipeline Response ----------
class PipelineResponse(BaseModel):
    meeting_details: MeetingDetails
    segment_summaries: List[SegmentSummary]
    collective_summary: CollectiveSummary
    items: Items
    chapters: List[Chapter]
