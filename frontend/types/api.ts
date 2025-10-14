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

export interface CollectiveSummary {
  collective_summary: string;
}

export interface Evidence {
  t: string;
  quote: string;
}

export interface WhoDidWhat {
  actor: string;
  what: string;
  when: string;
  evidence: Evidence[];
  confidence: number;
}

export interface Task {
  task: string;
  owner: string | null;
  assignee: string | null;
  due_date: string | null;
  status: string | null;
  evidence: Evidence[];
  confidence: number;
}

export interface Decision {
  decision: string;
  decider: string[];
  impact: string | null;
  evidence: Evidence[];
  confidence: number;
}

export interface Hat {
  speaker: string;
  hat: 'white' | 'red' | 'black' | 'yellow' | 'green' | 'blue';
  t: string;
  evidence: string;
}

export interface Achievement {
  member: string;
  achievement: string;
  evidence: Evidence[];
  confidence: number;
}

export interface Blocker {
  member: string;
  blocker: string;
  owner: string | null;
  evidence: Evidence[];
  confidence: number;
}

export interface Items {
  who_did_what: WhoDidWhat[];
  tasks: Task[];
  decisions: Decision[];
  hats: Hat[];
  achievements: Achievement[];
  blockers: Blocker[];
}

export interface Chapter {
  chapter_id: string;
  segment_ids: string[];
  title: string;
  summary: string;
}

export interface PipelineResponse {
  meeting_details: MeetingDetails;
  segment_summaries: SegmentSummary[];
  collective_summary: CollectiveSummary;
  items: Items;
  chapters: Chapter[];
}

// Hat descriptions
export const HAT_DESCRIPTIONS: Record<Hat['hat'], { name: string; description: string; color: string }> = {
  white: {
    name: 'White Hat',
    description: 'Focuses on data, facts, and information. Analytical and objective thinking.',
    color: 'bg-gray-100 text-gray-900 border-gray-300'
  },
  red: {
    name: 'Red Hat',
    description: 'Focuses on emotions, feelings, and intuition. Expressive and instinctive.',
    color: 'bg-red-100 text-red-900 border-red-300'
  },
  black: {
    name: 'Black Hat',
    description: 'Focuses on caution, difficulties, and critical thinking. Risk-aware.',
    color: 'bg-slate-900 text-white border-slate-700'
  },
  yellow: {
    name: 'Yellow Hat',
    description: 'Focuses on positivity, benefits, and optimism. Highlights opportunities.',
    color: 'bg-yellow-100 text-yellow-900 border-yellow-300'
  },
  green: {
    name: 'Green Hat',
    description: 'Focuses on creativity, alternatives, and new ideas. Innovative thinking.',
    color: 'bg-green-100 text-green-900 border-green-300'
  },
  blue: {
    name: 'Blue Hat',
    description: 'Focuses on process, control, and organization. Strategic planning.',
    color: 'bg-blue-100 text-blue-900 border-blue-300'
  }
};
