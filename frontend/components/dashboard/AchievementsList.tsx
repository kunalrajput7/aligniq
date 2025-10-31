import { AchievementItem } from '@/types/api';
import { Card, CardContent } from '../ui/card';
import { Trophy } from 'lucide-react';
import { Badge } from '../ui/badge';
import { getConfidenceColor, getConfidenceBadge } from '@/lib/utils';

interface AchievementsListProps {
  achievements: AchievementItem[];
}

export function AchievementsList({ achievements }: AchievementsListProps) {
  const achievementsList = achievements || [];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-6 w-6 text-yellow-500" />
        <h2 className="text-2xl font-bold">Achievements</h2>
      </div>
      <Card>
        <CardContent className="pt-6">
          {achievementsList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No achievements recorded
            </p>
          ) : (
            <div className="space-y-3">
              {achievementsList.map((achievement, idx) => (
                <div key={idx} className="p-3 border rounded-lg space-y-2 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900">
                        {achievement.member}
                      </Badge>
                      <p className="text-sm font-medium">{achievement.achievement}</p>
                    </div>
                    <Badge variant="outline" className={getConfidenceColor(achievement.confidence)}>
                      {getConfidenceBadge(achievement.confidence)}
                    </Badge>
                  </div>

                  {achievement.evidence.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-yellow-200 dark:border-yellow-800">
                      <p className="text-xs font-medium">Evidence:</p>
                      <div className="space-y-1">
                        {achievement.evidence.slice(0, 2).map((ev, eidx) => (
                          <div key={eidx} className="text-xs text-muted-foreground flex gap-2">
                            <span className="font-mono">{ev.t}</span>
                            <span>"{ev.quote}"</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
