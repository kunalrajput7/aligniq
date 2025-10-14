import { MeetingDetails } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Calendar, Clock, Users, UserX } from 'lucide-react';
import { formatDuration, formatDate } from '@/lib/utils';

interface MeetingHeaderProps {
  details: MeetingDetails;
}

export function MeetingHeader({ details }: MeetingHeaderProps) {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-3xl font-bold mb-2">{details.title || 'Untitled Meeting'}</CardTitle>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(details.date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(details.duration_ms)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="font-semibold">{details.participants.length} Participants</span>
          </div>
          {details.unknown_count > 0 && (
            <div className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-orange-600">{details.unknown_count} Unknown</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {details.participants.map((participant, idx) => (
            <Badge key={idx} variant="secondary">
              {participant}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
