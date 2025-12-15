import { ActionItem } from '@/types/api';
import { Card, CardContent } from '../ui/card';
import { Calendar } from 'lucide-react';
import { Badge } from '../ui/badge';

interface DeadlinesCardProps {
  tasks: ActionItem[];
}

export function DeadlinesCard({ tasks }: DeadlinesCardProps) {
  const tasksList = tasks || [];
  const tasksWithDeadlines = tasksList.filter((t) => t.deadline && t.deadline.trim().length > 0);

  if (tasksWithDeadlines.length === 0) {
    return null;
  }

  const sortedTasks = [...tasksWithDeadlines].sort((a, b) => {
    if (!a.deadline || !b.deadline) return 0;
    const dateA = new Date(a.deadline);
    const dateB = new Date(b.deadline);
    if (!Number.isNaN(dateA.getTime()) && !Number.isNaN(dateB.getTime())) {
      return dateA.getTime() - dateB.getTime();
    }
    return a.deadline.localeCompare(b.deadline);
  });

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
    return deadline;
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Upcoming Deadlines</h2>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {sortedTasks.map((task, idx) => (
              <div
                key={`${task.task}-${idx}`}
                className="flex items-start gap-3 p-3 border rounded-lg bg-primary/5 border-primary/20"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-snug mb-2">{task.task}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDeadline(task.deadline)}
                    </Badge>
                    {task.owner && (
                      <Badge variant="secondary" className="capitalize">
                        {task.owner}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
