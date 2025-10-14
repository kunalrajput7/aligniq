import { Chapter } from '@/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { BookOpen } from 'lucide-react';
import { Badge } from '../ui/badge';

interface ChaptersListProps {
  chapters: Chapter[];
}

export function ChaptersList({ chapters }: ChaptersListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Meeting Chapters</h2>
        <Badge>{chapters.length} chapters</Badge>
      </div>

      {chapters.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No chapters available
          </CardContent>
        </Card>
      ) : (
        chapters.map((chapter, idx) => (
          <Card key={chapter.chapter_id}>
            <CardHeader>
              <CardTitle className="text-xl">
                {idx + 1}. {chapter.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {chapter.summary}
              </p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
