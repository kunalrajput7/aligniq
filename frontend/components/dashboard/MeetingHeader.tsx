import { MeetingDetails } from '@/types/api';
import { Calendar, Clock, Users } from 'lucide-react';
import { formatDuration, formatDate } from '@/lib/utils';

interface MeetingHeaderProps {
  details: MeetingDetails;
}

export function MeetingHeader({ details }: MeetingHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-4 border-b border-border">
      {/* Left: Meeting Title */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          {details.title || 'Untitled Meeting'}
        </h1>
      </div>

      {/* Right: Meeting Metadata */}
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(details.date)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>{formatDuration(details.duration_ms)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>{details.participants.length} Participants</span>
        </div>
      </div>
    </div>
  );
}
