"use client";

import { useState } from 'react';
import { Hat, HAT_DESCRIPTIONS } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Brain, Info, X } from 'lucide-react';
import { Button } from '../ui/button';

interface HatSystemProps {
  hats: Hat[];
  participants: string[];
}

export function HatSystem({ hats, participants }: HatSystemProps) {
  const [showModal, setShowModal] = useState(false);

  const formatExplanation = (text: string, hatKey: Hat['hat'], participant: string) => {
    if (!text) {
      return `${participant} exhibited the ${HAT_DESCRIPTIONS[hatKey].name.toLowerCase()} throughout the session, contributing in line with that mindset.`;
    }
    const sentences = text
      .replace(/\s+/g, ' ')
      .trim()
      .split(/(?<=[.!?])\s+/)
      .filter(Boolean);

    if (sentences.length >= 3) {
      return sentences.slice(0, 3).join(' ');
    }
    if (sentences.length === 2) {
      return sentences.join(' ');
    }
    if (sentences.length === 1) {
      return `${sentences[0]} They reinforced this perspective consistently during the discussion.`;
    }
    return text;
  };

  // Determine the dominant hat for each speaker
  const dominantHatByPerson = hats.reduce((acc, hat) => {
    if (!acc[hat.speaker]) {
      acc[hat.speaker] = {
        hat: hat.hat,
        reasoning: formatExplanation(
          hat.evidence || `Demonstrated ${HAT_DESCRIPTIONS[hat.hat].name} thinking.`,
          hat.hat,
          hat.speaker
        ),
        count: 1
      };
    }
    // If we already have a hat for this person, keep the first one
    // (Backend should send the dominant one first)
    return acc;
  }, {} as Record<string, { hat: Hat['hat']; reasoning: string; count: number }>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Hats Worn by Participants
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowModal(true)}
            className="gap-2"
          >
            <Info className="h-4 w-4" />
            Hat Legend
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {Object.keys(dominantHatByPerson).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hat analysis available
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(dominantHatByPerson).map(([speaker, { hat, reasoning }]) => {
              const hatInfo = HAT_DESCRIPTIONS[hat];
              return (
                <div
                  key={speaker}
                  className={`flex items-start gap-3 p-4 border rounded-lg shadow-sm transition-colors ${hatInfo.legendClass}`}
                >
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-sm">{speaker}</div>
                      <Badge className={`${hatInfo.chipClass} text-xs shrink-0`}>
                        {hatInfo.name}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {reasoning}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Hat Legend Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
          <div className="bg-background rounded-lg shadow-lg max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                <h2 className="text-xl font-bold">Six Thinking Hats Legend</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowModal(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-6">
              <p className="text-sm text-muted-foreground mb-6">
                The Six Thinking Hats is a method for parallel thinking and exploring different perspectives in discussion.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(HAT_DESCRIPTIONS).map(([hatKey, hatInfo]) => (
                  <div
                    key={hatKey}
                    className={`p-4 rounded-lg border text-sm leading-relaxed ${hatInfo.legendClass}`}
                  >
                    <div className="font-semibold text-base mb-2">{hatInfo.name}</div>
                    <p className="text-sm opacity-90">{hatInfo.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
