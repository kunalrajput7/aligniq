// API Response Types

export interface MeetingDetails {
  title: string;
  date: string | null;
  duration_ms: number;
  participants: string[];
  unknown_count: number;
}

export interface SegmentSummary {
  segment_id: string;
  summary: string;
  key_points: Record<string, string>;
}

export interface Evidence {
  t: string;
  quote: string;
}

// Collective Summary Types
export interface ActionItem {
  task: string;
  owner: string;
  deadline: string;
  status: string;
  confidence: number;
}

export interface AchievementItem {
  achievement: string;
  member: string;
  confidence: number;
  evidence: Evidence[];
}

export interface BlockerItem {
  blocker: string;
  member: string;
  owner: string;
  confidence: number;
  evidence: Evidence[];
}

export interface CollectiveSummary {
  narrative_summary: string;
  action_items: ActionItem[];
  achievements: AchievementItem[];
  blockers: BlockerItem[];
}

// Chapter Types
export interface Chapter {
  chapter_id: string;
  segment_ids: string[];
  title: string;
  summary: string;
}

// Pipeline Response
export interface PipelineResponse {
  meeting_details: MeetingDetails;
  segment_summaries: SegmentSummary[];
  collective_summary: CollectiveSummary;
  chapters: Chapter[];
}
