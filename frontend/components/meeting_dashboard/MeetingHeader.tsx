import { MeetingDetails } from '@/types/api';
import { Calendar, Clock, Users } from 'lucide-react';
import { formatDuration, formatDate } from '@/lib/utils';

interface MeetingHeaderProps {
  details: MeetingDetails;
}

export function MeetingHeader({ details }: MeetingHeaderProps) {
  const todayISO = new Date().toISOString();
  return (
    <div className="flex flex-col gap-2 pb-4 border-b border-border md:flex-row md:items-center md:justify-between">
      <h1 className="text-2xl md:text-3xl font-semibold text-foreground leading-snug break-words">
        {details.title || 'Untitled Meeting'}
      </h1>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground justify-start md:justify-end">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(todayISO)}</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Clock className="h-4 w-4" />
          <span>{formatDuration(details.duration_ms)}</span>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Users className="h-4 w-4" />
          <span>{details.participants.length} Participants</span>
        </div>
      </div>
    </div>
  );
}
