import { Hat, HAT_DESCRIPTIONS } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Brain } from 'lucide-react';

interface HatSystemProps {
  hats: Hat[];
  participants: string[];
}

export function HatSystem({ hats, participants }: HatSystemProps) {
  // Group hats by speaker
  const hatsByPerson = hats.reduce((acc, hat) => {
    if (!acc[hat.speaker]) {
      acc[hat.speaker] = [];
    }
    acc[hat.speaker].push(hat);
    return acc;
  }, {} as Record<string, Hat[]>);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Six Thinking Hats Analysis</h2>
      </div>

      {/* Hat Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Hat Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(HAT_DESCRIPTIONS).map(([hatKey, hatInfo]) => (
              <div key={hatKey} className={`p-3 rounded-lg border-2 ${hatInfo.color}`}>
                <div className="font-semibold">{hatInfo.name}</div>
                <p className="text-xs mt-1 opacity-80">{hatInfo.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hats by Person */}
      {Object.keys(hatsByPerson).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hat analysis available
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(hatsByPerson).map(([speaker, speakerHats]) => (
            <Card key={speaker}>
              <CardHeader>
                <CardTitle className="text-lg">{speaker}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {speakerHats.map((hat, idx) => {
                  const hatInfo = HAT_DESCRIPTIONS[hat.hat];
                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge className={hatInfo.color}>
                          {hatInfo.name}
                        </Badge>
                        {hat.t && (
                          <span className="text-xs text-muted-foreground font-mono">
                            {hat.t}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {hat.evidence}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
