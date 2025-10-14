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
  // Calculate chapter positions and collect key points for each chapter
  const getChapterData = (chapter: Chapter) => {
    if (!chapter.segment_ids.length) return { position: 0, width: 0, keyPoints: [] };

    // Find segments belonging to this chapter
    const chapterSegments = segments.filter(s => chapter.segment_ids.includes(s.segment_id));
    if (!chapterSegments.length) return { position: 0, width: 0, keyPoints: [] };

    // Find the first segment index
    const firstSegmentId = chapter.segment_ids[0];
    const firstSegmentIndex = segments.findIndex(s => s.segment_id === firstSegmentId);

    if (firstSegmentIndex === -1) return { position: 0, width: 0, keyPoints: [] };

    // Calculate position and width based on segment indices
    const segmentDuration = duration / segments.length;
    const chapterStartTime = firstSegmentIndex * segmentDuration;
    const chapterEndTime = (firstSegmentIndex + chapter.segment_ids.length) * segmentDuration;

    const position = (chapterStartTime / duration) * 100;
    const width = ((chapterEndTime - chapterStartTime) / duration) * 100;

    // Collect key points from all segments in this chapter
    const keyPoints: Array<{ time: string; point: string; timestamp: number; segmentId: string }> = [];

    chapterSegments.forEach((segment) => {
      const segmentIndex = segments.findIndex(s => s.segment_id === segment.segment_id);

      Object.entries(segment.key_points).forEach(([time, point]) => {
        // Convert MM:SS to milliseconds (relative to segment start)
        const parts = time.split(':');
        const minutes = parseInt(parts[0] || '0');
        const seconds = parseInt(parts[1] || '0');
        const relativeTimestamp = (minutes * 60 + seconds) * 1000;

        // Calculate absolute timestamp by adding segment offset
        const segmentOffset = segmentIndex * segmentDuration;
        const absoluteTimestamp = segmentOffset + relativeTimestamp;

        keyPoints.push({ time, point, timestamp: absoluteTimestamp, segmentId: segment.segment_id });
      });
    });

    // Sort by timestamp and select up to 8 key points per chapter
    keyPoints.sort((a, b) => a.timestamp - b.timestamp);
    const maxPointsPerChapter = 8;
    const step = Math.ceil(keyPoints.length / maxPointsPerChapter);
    const selectedPoints = keyPoints.filter((_, idx) => idx % step === 0).slice(0, maxPointsPerChapter);

    return { position, width, keyPoints: selectedPoints };
  };

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
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
            <span className="font-medium">0:00</span>
            <span className="font-medium">{formatDuration(duration)}</span>
          </div>

          {/* Visual Timeline with Chapters */}
          <div className="relative" style={{ paddingTop: '120px', paddingBottom: '60px' }}>
            {/* Chapter boxes above timeline */}
            {chapters.map((chapter) => {
              const chapterData = getChapterData(chapter);

              return (
                <div
                  key={chapter.chapter_id}
                  className="absolute group"
                  style={{
                    left: `${chapterData.position}%`,
                    top: '0',
                    width: `${Math.max(chapterData.width, 12)}%`,
                    maxWidth: '300px'
                  }}
                >
                  {/* Vertical connector line */}
                  <div
                    className="absolute left-0 top-full w-px bg-gradient-to-b from-purple-400 to-purple-600 dark:from-purple-500 dark:to-purple-700"
                    style={{ height: '80px' }}
                  />

                  {/* Chapter box */}
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-2 border-purple-300 dark:border-purple-700 rounded-lg p-3 shadow-md hover:shadow-xl transition-all duration-200 cursor-pointer">
                    <h4 className="text-xs font-bold text-purple-900 dark:text-purple-100 line-clamp-2 mb-1">
                      {chapter.title}
                    </h4>
                    {chapter.summary && (
                      <p className="text-[10px] text-purple-700 dark:text-purple-300 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {chapter.summary.slice(0, 100)}...
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Main timeline bar */}
            <div
              className="relative h-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 dark:from-blue-600 dark:via-purple-600 dark:to-pink-600 rounded-full shadow-lg"
              style={{ top: '80px' }}
            >
              {/* Start marker */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-500 rounded-full border-3 border-white dark:border-gray-800 shadow-lg z-20 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>

              {/* End marker */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-pink-500 rounded-full border-3 border-white dark:border-gray-800 shadow-lg z-20 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>

              {/* Chapter markers and key points */}
              {chapters.map((chapter) => {
                const chapterData = getChapterData(chapter);

                return (
                  <div key={chapter.chapter_id}>
                    {/* Chapter marker on timeline */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group z-30"
                      style={{ left: `${chapterData.position}%` }}
                    >
                      <div className="w-4 h-4 bg-purple-500 rounded-full border-2 border-white dark:border-gray-800 shadow-md hover:scale-125 transition-transform cursor-pointer" />

                      {/* Tooltip on hover - positioned below */}
                      <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-80 p-4 bg-purple-900 dark:bg-purple-950 text-white text-sm rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-purple-700">
                        <h5 className="font-bold text-purple-100 mb-2">{chapter.title}</h5>
                        {chapter.summary && (
                          <p className="text-purple-200 text-xs leading-relaxed">
                            {chapter.summary.slice(0, 200)}{chapter.summary.length > 200 ? '...' : ''}
                          </p>
                        )}
                        {/* Tooltip arrow */}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-purple-900 dark:bg-purple-950 border-l border-t border-purple-700 rotate-45" />
                      </div>
                    </div>

                    {/* Key point markers for this chapter */}
                    {chapterData.keyPoints.map((point, idx) => {
                      const position = (point.timestamp / duration) * 100;
                      return (
                        <div
                          key={`${chapter.chapter_id}-point-${idx}`}
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group z-25"
                          style={{ left: `${position}%` }}
                        >
                          <div className="w-2.5 h-2.5 bg-amber-400 dark:bg-amber-500 rounded-full border border-white dark:border-gray-800 shadow-sm cursor-pointer hover:scale-150 transition-transform" />

                          {/* Tooltip on hover - positioned below */}
                          <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 w-72 p-3 bg-slate-900 dark:bg-slate-950 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded font-mono font-bold text-[10px]">
                                {point.time}
                              </span>
                            </div>
                            <div className="text-slate-200 leading-relaxed">{point.point}</div>
                            {/* Tooltip arrow */}
                            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-950 border-l border-t border-slate-700 rotate-45" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Timeline scale markers below */}
            <div
              className="absolute left-0 right-0 flex justify-between text-[10px] text-muted-foreground font-mono"
              style={{ top: '100px' }}
            >
              {[0, 25, 50, 75, 100].map((percent) => (
                <div key={percent} className="flex flex-col items-center">
                  <div className="w-px h-2 bg-muted-foreground/30 mb-1" />
                  <span>{formatDuration(duration * (percent / 100))}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 pt-4 border-t text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full border-2 border-white dark:border-gray-800" />
              <span className="text-muted-foreground">Chapters</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-amber-400 rounded-full border border-white dark:border-gray-800" />
              <span className="text-muted-foreground">Key Moments</span>
            </div>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Hover over markers to see details
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
