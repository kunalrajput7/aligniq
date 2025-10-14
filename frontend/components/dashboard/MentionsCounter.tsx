import { WhoDidWhat } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { MessageSquare } from 'lucide-react';
import { calculateMentions } from '@/lib/utils';

interface MentionsCounterProps {
  whoDidWhat: WhoDidWhat[];
  participants: string[];
}

export function MentionsCounter({ whoDidWhat, participants }: MentionsCounterProps) {
  const mentions = calculateMentions(whoDidWhat);

  // Filter to only show actual meeting participants
  const filteredMentions = Object.entries(mentions).filter(([person]) =>
    participants.includes(person)
  );

  const sortedMentions = filteredMentions.sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Mentions Counter
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedMentions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No mentions tracked
          </p>
        ) : (
          <div className="space-y-3">
            {sortedMentions.map(([person, count]) => (
              <div key={person} className="flex items-center justify-between">
                <span className="text-sm font-medium">{person}</span>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden min-w-[100px]">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${(count / Math.max(...Object.values(mentions))) * 100}%`
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold text-primary min-w-[2ch] text-right">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
