import { Decision } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CheckCircle } from 'lucide-react';
import { Badge } from '../ui/badge';
import { getConfidenceColor, getConfidenceBadge } from '@/lib/utils';

interface DecisionsListProps {
  decisions: Decision[];
}

export function DecisionsList({ decisions }: DecisionsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Decisions Made
        </CardTitle>
      </CardHeader>
      <CardContent>
        {decisions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No decisions recorded
          </p>
        ) : (
          <div className="space-y-4">
            {decisions.map((decision, idx) => (
              <div key={idx} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium flex-1">{decision.decision}</p>
                  <Badge variant="outline" className={getConfidenceColor(decision.confidence)}>
                    {getConfidenceBadge(decision.confidence)}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  {decision.decider.map((person, pidx) => (
                    <Badge key={pidx} variant="secondary">
                      {person}
                    </Badge>
                  ))}
                </div>

                {decision.impact && (
                  <div className="p-2 bg-muted rounded-md">
                    <p className="text-xs font-medium mb-1">Impact:</p>
                    <p className="text-xs text-muted-foreground">{decision.impact}</p>
                  </div>
                )}

                {decision.evidence.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Evidence:</p>
                    <div className="space-y-1">
                      {decision.evidence.map((ev, eidx) => (
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
  );
}
