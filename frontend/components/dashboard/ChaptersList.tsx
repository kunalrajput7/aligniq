import { Chapter } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { BookOpen } from 'lucide-react';
import { Badge } from '../ui/badge';

interface ChaptersListProps {
  chapters: Chapter[];
}

function stripChapterPrefix(title: string): string {
  return title.replace(/^Chapter\s*\d+[:\-\s]*/i, '').trim();
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function refineSummary(summary: string, chapterTitle?: string, chapterIndex?: number): string {
  if (!summary) return '';

  let cleaned = summary.replace(/\*\*/g, ' ').replace(/[_`]/g, ' ');

  const prefixPatterns = [
    chapterTitle ? escapeRegExp(chapterTitle) : '',
    chapterTitle ? escapeRegExp(stripChapterPrefix(chapterTitle)) : '',
    chapterIndex !== undefined ? `Chapter\\s*${chapterIndex + 1}` : '',
    chapterIndex !== undefined ? `Chapter\\s*${chapterIndex + 1}[A-Z]?` : ''
  ].filter(Boolean);

  if (prefixPatterns.length) {
    const combined = prefixPatterns.join('|');
    const titleRegex = new RegExp(`^(?:${combined})[:\\-\\s]*`, 'i');
    cleaned = cleaned.replace(titleRegex, '');
  }

  cleaned = cleaned.replace(/\bChapter\s*\d+[A-Z]?[:\-\s]*/gi, '');
  cleaned = cleaned.replace(/\b(?:In|During)\s+this\s+chapter[:,]?\s*/gi, '');
  cleaned = cleaned.replace(
    /\bThis\s+chapter\s+(?:focuses|covers|discusses|addresses|explores)\s*/gi,
    ''
  );

  const redundantTitleRegex = chapterTitle
    ? new RegExp(`\\b${escapeRegExp(stripChapterPrefix(chapterTitle))}\\b`, 'i')
    : null;
  if (redundantTitleRegex) {
    const sentences = cleaned
      .split(/(?<=\.)\s+/)
      .filter((sentence) => !redundantTitleRegex.test(sentence.trim()));
    if (sentences.length) {
      cleaned = sentences.join(' ');
    }
  }

  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (cleaned) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

function chunkSentences(text: string): string[] {
  if (!text) return [];

  const sentences = text
    .split(/(?<=\.)\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 2) {
    return [sentences.join(' ')];
  }

  const paragraphs: string[] = [];
  let buffer: string[] = [];

  sentences.forEach((sentence) => {
    buffer.push(sentence);
    const current = buffer.join(' ');
    if (current.length > 220) {
      paragraphs.push(current);
      buffer = [];
    }
  });

  if (buffer.length) {
    paragraphs.push(buffer.join(' '));
  }

  return paragraphs;
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
        chapters.map((chapter, idx) => {
          const cleanTitle = stripChapterPrefix(chapter.title);
          const refined = refineSummary(chapter.summary, chapter.title, idx);
          const paragraphs = chunkSentences(refined);

          return (
            <Card key={chapter.chapter_id}>
              <CardHeader>
                <CardTitle className="text-xl">
                  {idx + 1}. {cleanTitle}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paragraphs.length > 0 ? (
                    paragraphs.map((paragraph, i) => (
                      <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                        {paragraph}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No additional detail captured for this topic.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
