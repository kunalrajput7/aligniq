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
  type: 'root' | 'theme' | 'chapter' | 'claim' | 'outcome';
  kind?: 'decision' | 'action' | 'achievement' | 'blocker' | 'concern';  // Only for outcome nodes
  parent_id: string;
  description: string;
  timestamp: string | null;
  confidence: number;
  owner?: string;  // For outcome nodes
  due_date?: string;  // For outcome nodes
  evidence?: Evidence[];  // For outcome nodes
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
    legendClass: 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600',
    chipClass: 'bg-gray-200 text-gray-900 border-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-500'
  },
  red: {
    name: 'Red Hat',
    description: 'Focuses on emotions, feelings, and intuition. Expressive and instinctive.',
    legendClass: 'bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-100 border-red-300 dark:border-red-700',
    chipClass: 'bg-red-200 text-red-900 border-red-400 dark:bg-red-800/50 dark:text-red-100 dark:border-red-600'
  },
  black: {
    name: 'Black Hat',
    description: 'Focuses on caution, difficulties, and critical thinking. Risk-aware.',
    legendClass: 'bg-slate-800 text-slate-100 border-slate-600',
    chipClass: 'bg-slate-900 text-slate-100 border-slate-700'
  },
  yellow: {
    name: 'Yellow Hat',
    description: 'Focuses on positivity, benefits, and optimism. Highlights opportunities.',
    legendClass: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700',
    chipClass: 'bg-yellow-200 text-yellow-900 border-yellow-400 dark:bg-yellow-800/50 dark:text-yellow-100 dark:border-yellow-600'
  },
  green: {
    name: 'Green Hat',
    description: 'Focuses on creativity, alternatives, and new ideas. Innovative thinking.',
    legendClass: 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-100 border-green-300 dark:border-green-700',
    chipClass: 'bg-green-200 text-green-900 border-green-400 dark:bg-green-800/50 dark:text-green-100 dark:border-green-600'
  },
  blue: {
    name: 'Blue Hat',
    description: 'Focuses on process, control, and organization. Strategic planning.',
    legendClass: 'bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-700',
    chipClass: 'bg-blue-200 text-blue-900 border-blue-400 dark:bg-blue-800/50 dark:text-blue-100 dark:border-blue-600'
  }
};
