import { BlockerItem } from '@/types/api';
import { Card, CardContent } from '../ui/card';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/badge';

interface BlockersListProps {
  blockers: BlockerItem[];
}

export function BlockersList({ blockers }: BlockersListProps) {
  const blockersList = (blockers || []).filter(
    (item) => item.blocker && item.blocker.trim().length > 0
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-6 w-6 text-red-500" />
        <h2 className="text-2xl font-bold">Blockers</h2>
      </div>
      <Card>
        <CardContent className="pt-6">
          {blockersList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No blockers identified
            </p>
          ) : (
            <div className="space-y-3">
              {blockersList.map((blocker, idx) => (
                <div
                  key={`${blocker.member}-${idx}`}
                  className="p-3 border rounded-lg space-y-2 bg-red-50/85 dark:bg-red-500/10 border-red-200/80 dark:border-red-500/30"
                >
                  <div className="space-y-2">
                    <Badge variant="secondary" className="bg-red-200 text-red-900 dark:bg-red-500/30 dark:text-red-100">
                      {blocker.member || 'Team'}
                    </Badge>
                    <p className="text-sm font-medium leading-relaxed text-red-900 dark:text-red-100">
                      {blocker.blocker}
                    </p>
                  </div>

                  {blocker.evidence.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-red-200/80 dark:border-red-500/30">
                      <p className="text-xs font-medium text-red-800 dark:text-red-200">Evidence:</p>
                      <div className="space-y-1">
                        {blocker.evidence.slice(0, 2).map((ev, eidx) => (
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
