import { Task } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Calendar } from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatDate } from '@/lib/utils';

interface DeadlinesListProps {
  tasks: Task[];
}

export function DeadlinesList({ tasks }: DeadlinesListProps) {
  const tasksWithDeadlines = tasks.filter(t => t.due_date);
  const sortedTasks = tasksWithDeadlines.sort((a, b) => {
    if (!a.due_date || !b.due_date) return 0;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Upcoming Deadlines
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No deadlines mentioned
          </p>
        ) : (
          <div className="space-y-3">
            {sortedTasks.map((task, idx) => (
              <div key={idx} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{task.task}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{formatDate(task.due_date)}</Badge>
                      {task.assignee && (
                        <Badge variant="secondary">{task.assignee}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
