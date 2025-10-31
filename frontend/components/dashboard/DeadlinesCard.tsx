import { ActionItem } from '@/types/api';
import { Card, CardContent } from '../ui/card';
import { Calendar } from 'lucide-react';
import { Badge } from '../ui/badge';

interface DeadlinesCardProps {
  tasks: ActionItem[];
}

export function DeadlinesCard({ tasks }: DeadlinesCardProps) {
  const tasksList = tasks || [];
  const tasksWithDeadlines = tasksList.filter(t => t.deadline);

  // Sort by deadline
  const sortedTasks = tasksWithDeadlines.sort((a, b) => {
    if (!a.deadline || !b.deadline) return 0;
    const dateA = new Date(a.deadline);
    const dateB = new Date(b.deadline);
    if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
      return dateA.getTime() - dateB.getTime();
    }
    return a.deadline.localeCompare(b.deadline);
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-6 w-6" />
        <h2 className="text-2xl font-bold">Upcoming Deadlines</h2>
      </div>
      <Card>
        <CardContent className="pt-6">
          {sortedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No deadlines mentioned
            </p>
          ) : (
            <div className="space-y-3">
              {sortedTasks.map((task, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug mb-2">{task.task}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className="gap-1">
                        <Calendar className="h-3 w-3" />
                        {task.deadline}
                      </Badge>
                      {task.owner && (
                        <Badge variant="secondary">{task.owner}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
