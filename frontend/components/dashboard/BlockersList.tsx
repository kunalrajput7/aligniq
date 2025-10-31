import { BlockerItem } from '@/types/api';
import { Card, CardContent } from '../ui/card';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { getConfidenceColor, getConfidenceBadge } from '@/lib/utils';

interface BlockersListProps {
  blockers: BlockerItem[];
}

export function BlockersList({ blockers }: BlockersListProps) {
  const blockersList = blockers || [];

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
                <div key={idx} className="p-3 border rounded-lg space-y-2 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <Badge variant="secondary" className="bg-red-100 dark:bg-red-900">
                        {blocker.member}
                      </Badge>
                      <p className="text-sm font-medium">{blocker.blocker}</p>
                    </div>
                    <Badge variant="outline" className={getConfidenceColor(blocker.confidence)}>
                      {getConfidenceBadge(blocker.confidence)}
                    </Badge>
                  </div>

                  {blocker.owner && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-muted-foreground">Responsible:</span>
                      <Badge variant="outline">{blocker.owner}</Badge>
                    </div>
                  )}

                  {blocker.evidence.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-red-200 dark:border-red-800">
                      <p className="text-xs font-medium">Evidence:</p>
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
