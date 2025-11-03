import { Chapter } from '@/types/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { BookOpen } from 'lucide-react';
import { Badge } from '../ui/badge';
import ReactMarkdown from 'react-markdown';

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
              <div className="prose prose-sm max-w-none dark:prose-invert
                prose-p:text-sm prose-p:leading-relaxed prose-p:my-2
                prose-strong:font-semibold prose-strong:text-foreground
                prose-em:italic
                prose-ul:list-disc prose-ul:my-2 prose-ul:pl-4
                prose-ol:list-decimal prose-ol:my-2 prose-ol:pl-4
                prose-li:my-1">
                <ReactMarkdown>{chapter.summary}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
