import { Decision } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { GitBranch } from 'lucide-react';
import { Badge } from '../ui/badge';

interface DecisionDiagramProps {
  decisions: Decision[];
}

export function DecisionDiagram({ decisions }: DecisionDiagramProps) {
  if (decisions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Decision Flow
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground">
          No decisions to visualize
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Decision Flow Diagram
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {decisions.map((decision, idx) => (
            <div key={idx} className="relative pl-8 pb-6 border-l-2 border-primary last:border-l-0 last:pb-0">
              {/* Node circle */}
              <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background" />

              {/* Decision content */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">Decision {idx + 1}</Badge>
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm">{decision.decision}</h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {decision.decider.map((person, pidx) => (
                        <Badge key={pidx} variant="secondary">
                          {person}
                        </Badge>
                      ))}
                    </div>
                    {decision.impact && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        <span className="font-medium">Impact:</span> {decision.impact}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
