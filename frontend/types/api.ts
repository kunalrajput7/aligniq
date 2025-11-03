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

// Hats Types
export interface Hat {
  speaker: string;
  hat: 'white' | 'red' | 'black' | 'yellow' | 'green' | 'blue';
  t: string;
  evidence: string;
  confidence?: number;
}

// Chapter Types
export interface Chapter {
  chapter_id: string;
  segment_ids: string[];
  title: string;
  summary: string;
}

// Mindmap Types
export interface MindmapNode {
  id: string;
  label: string;
  type: 'root' | 'theme' | 'chapter' | 'claim' | 'topic' | 'decision' | 'action' | 'achievement' | 'blocker' | 'concern';
  parent_id: string;
  description: string;
  timestamp: string | null;
  confidence: number;
}

export interface MindmapEdge {
  from: string;
  to: string;
  type: 'hierarchy' | 'causes' | 'leads_to' | 'relates_to';
}

export interface MindmapCenterNode {
  id: string;
  label: string;
  type: 'root';
}

export interface Mindmap {
  center_node: MindmapCenterNode;
  nodes: MindmapNode[];
  edges: MindmapEdge[];
  meta?: Record<string, any>;
}

// Pipeline Response
export interface PipelineResponse {
  meeting_details: MeetingDetails;
  segment_summaries: SegmentSummary[];
  collective_summary: CollectiveSummary;
  hats: Hat[];
  chapters: Chapter[];
  mindmap: Mindmap;
}

// Hat descriptions for UI
export interface HatUIConfig {
  name: string;
  description: string;
  legendClass: string;
  chipClass: string;
}

export const HAT_DESCRIPTIONS: Record<Hat['hat'], HatUIConfig> = {
  white: {
    name: 'White Hat',
    description: 'Focuses on data, facts, and information. Analytical and objective thinking.',
    legendClass: 'bg-slate-100/80 dark:bg-slate-200/10 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-500/40',
    chipClass: 'bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-200/20 dark:text-slate-100 dark:border-slate-500/40'
  },
  red: {
    name: 'Red Hat',
    description: 'Focuses on emotions, feelings, and intuition. Expressive and instinctive.',
    legendClass: 'bg-rose-500/15 dark:bg-rose-500/25 text-rose-900 dark:text-rose-100 border-rose-200/80 dark:border-rose-400/40',
    chipClass: 'bg-rose-500/20 text-rose-900 border-rose-400 dark:bg-rose-500/30 dark:text-rose-100 dark:border-rose-400/60'
  },
  black: {
    name: 'Black Hat',
    description: 'Focuses on caution, difficulties, and critical thinking. Risk-aware.',
    legendClass: 'bg-slate-900/80 text-slate-100 border-slate-700',
    chipClass: 'bg-slate-900 text-slate-100 border-slate-600'
  },
  yellow: {
    name: 'Yellow Hat',
    description: 'Focuses on positivity, benefits, and optimism. Highlights opportunities.',
    legendClass: 'bg-amber-200/60 dark:bg-amber-300/25 text-amber-900 dark:text-amber-100 border-amber-300/80 dark:border-amber-400/40',
    chipClass: 'bg-amber-300/70 text-amber-900 border-amber-400 dark:bg-amber-300/30 dark:text-amber-100 dark:border-amber-400/60'
  },
  green: {
    name: 'Green Hat',
    description: 'Focuses on creativity, alternatives, and new ideas. Innovative thinking.',
    legendClass: 'bg-emerald-200/50 dark:bg-emerald-400/20 text-emerald-900 dark:text-emerald-100 border-emerald-300/70 dark:border-emerald-400/40',
    chipClass: 'bg-emerald-500/25 text-emerald-900 border-emerald-500/50 dark:bg-emerald-500/30 dark:text-emerald-100 dark:border-emerald-400/60'
  },
  blue: {
    name: 'Blue Hat',
    description: 'Focuses on process, control, and organization. Strategic planning.',
    legendClass: 'bg-indigo-200/60 dark:bg-indigo-400/25 text-indigo-900 dark:text-indigo-100 border-indigo-300/80 dark:border-indigo-400/40',
    chipClass: 'bg-indigo-500/25 text-indigo-900 border-indigo-500/50 dark:bg-indigo-500/30 dark:text-indigo-100 dark:border-indigo-400/60'
  }
};
