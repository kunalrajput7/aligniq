import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const h = hours;
  const m = minutes % 60;
  const s = seconds % 60;

  if (hours > 0) {
    return `${h}h ${m}m ${s}s`;
  } else if (minutes > 0) {
    return `${m}m ${s}s`;
  } else {
    return `${s}s`;
  }
}

export function formatTimestamp(timestamp: string): string {
  return timestamp;
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export function calculateMentions(whoDidWhat: any[]): Record<string, number> {
  const mentions: Record<string, number> = {};

  whoDidWhat.forEach(item => {
    const actor = item.actor;
    if (actor) {
      mentions[actor] = (mentions[actor] || 0) + 1;
    }
  });

  return mentions;
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600';
  if (confidence >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}

export function getConfidenceBadge(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.5) return 'Medium';
  return 'Low';
}
