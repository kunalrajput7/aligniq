import { Chapter, SegmentSummary } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Clock } from 'lucide-react';
import { formatDuration } from '@/lib/utils';

interface TimelineBarProps {
  duration: number;
  chapters: Chapter[];
  segments: SegmentSummary[];
}

export function TimelineBar({ duration, chapters, segments }: TimelineBarProps) {
  // Collect all key points from segments
  const allKeyPoints: Array<{ time: string; point: string; timestamp: number }> = [];

  segments.forEach((segment) => {
    Object.entries(segment.key_points).forEach(([time, point]) => {
      // Convert MM:SS to milliseconds for positioning
      const parts = time.split(':');
      const minutes = parseInt(parts[0] || '0');
      const seconds = parseInt(parts[1] || '0');
      const timestamp = (minutes * 60 + seconds) * 1000;

      allKeyPoints.push({ time, point, timestamp });
    });
  });

  // Sort by timestamp
  allKeyPoints.sort((a, b) => a.timestamp - b.timestamp);

  // Take top 10 most important points (spread across timeline)
  const maxPoints = 10;
  const step = Math.ceil(allKeyPoints.length / maxPoints);
  const selectedPoints = allKeyPoints.filter((_, idx) => idx % step === 0).slice(0, maxPoints);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Meeting Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Timeline Header */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="font-medium">Start</span>
            <span className="font-medium">{formatDuration(duration)}</span>
          </div>

          {/* Visual Timeline */}
          <div className="relative pb-8">
            {/* Main timeline bar */}
            <div className="relative h-3 bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 dark:from-blue-900 dark:via-purple-900 dark:to-pink-900 rounded-full">
              {/* Start marker */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg z-10" />

              {/* End marker */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-pink-500 rounded-full border-2 border-white shadow-lg z-10" />

              {/* Chapter markers */}
              {chapters.map((chapter, idx) => {
                // Position chapters evenly across timeline
                const position = ((idx + 1) / (chapters.length + 1)) * 100;
                return (
                  <div
                    key={chapter.chapter_id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
                    style={{ left: `${position}%` }}
                  >
                    <div className="w-3 h-3 bg-purple-500 rounded-full border-2 border-white shadow-md" />
                  </div>
                );
              })}

              {/* Key point markers */}
              {selectedPoints.map((point, idx) => {
                const position = (point.timestamp / duration) * 100;
                return (
                  <div
                    key={idx}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                    style={{ left: `${position}%` }}
                  >
                    <div className="w-2 h-2 bg-primary rounded-full border border-white z-30 cursor-pointer hover:scale-150 transition-transform" />
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-slate-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                      <div className="font-mono font-bold mb-1">{point.time}</div>
                      <div>{point.point}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Points List */}
          {selectedPoints.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Key Timeline Points</h4>
              <div className="grid gap-2">
                {selectedPoints.slice(0, 5).map((point, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="flex-shrink-0 px-2 py-0.5 bg-primary/20 rounded text-xs font-mono font-medium text-primary">
                      {point.time}
                    </div>
                    <p className="text-sm text-muted-foreground flex-1">{point.point}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chapter Markers Legend */}
          {chapters.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Chapters</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {chapters.map((chapter, idx) => (
                  <div
                    key={chapter.chapter_id}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800"
                  >
                    <div className="w-2 h-2 bg-purple-500 rounded-full flex-shrink-0" />
                    <span className="text-xs font-medium truncate">{chapter.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
