import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { FileText } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

interface MeetingSummaryProps {
  summary: string;
}

export function MeetingSummary({ summary }: MeetingSummaryProps) {
  // Parse summary to format it better
  const formatSummary = (text: string) => {
    if (!text) return null;

    // Split by paragraphs
    const paragraphs = text.split('\n\n').filter(p => p.trim());

    return paragraphs.map((para, idx) => {
      const trimmed = para.trim();

      // Check if it's a heading (starts with ###)
      if (trimmed.startsWith('###')) {
        const heading = trimmed.replace(/^###\s*/, '');
        return (
          <h3 key={idx} className="text-lg font-bold text-foreground mt-6 mb-3 first:mt-0">
            {heading}
          </h3>
        );
      }

      // Check if it's a subheading (starts with ##)
      if (trimmed.startsWith('##')) {
        const heading = trimmed.replace(/^##\s*/, '');
        return (
          <h2 key={idx} className="text-xl font-bold text-foreground mt-6 mb-3 first:mt-0">
            {heading}
          </h2>
        );
      }

      // Regular paragraph
      return (
        <p key={idx} className="text-sm leading-relaxed text-muted-foreground mb-4">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Meeting Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] w-full pr-4">
          <div className="prose prose-sm max-w-none">
            {summary ? (
              <div className="space-y-2">{formatSummary(summary)}</div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No summary available</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
