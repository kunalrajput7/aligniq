import { AchievementItem } from '@/types/api';
import { Card, CardContent } from '../ui/card';
import { Trophy } from 'lucide-react';
import { Badge } from '../ui/badge';

interface AchievementsListProps {
  achievements: AchievementItem[];
}

export function AchievementsList({ achievements }: AchievementsListProps) {
  const achievementsList = achievements || [];
  const filtered = achievementsList.filter(
    (achievement) => achievement.achievement && achievement.achievement.trim().length > 0
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-6 w-6 text-yellow-500" />
        <h2 className="text-2xl font-bold">Achievements</h2>
      </div>
      <Card>
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No achievements recorded
            </p>
          ) : (
            <div className="space-y-3">
              {filtered.map((achievement, idx) => (
                <div
                  key={`${achievement.member}-${idx}`}
                  className="p-3 border rounded-lg space-y-2 bg-yellow-50/80 dark:bg-yellow-500/10 border-yellow-200/80 dark:border-yellow-500/30"
                >
                  <div className="space-y-2">
                    <Badge variant="secondary" className="bg-yellow-200 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-50">
                      {achievement.member || 'Team'}
                    </Badge>
                    <p className="text-sm font-medium leading-relaxed text-yellow-900 dark:text-yellow-100">
                      {achievement.achievement}
                    </p>
                  </div>

                  {achievement.evidence.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-yellow-200/80 dark:border-yellow-500/30">
                      <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">Evidence:</p>
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
