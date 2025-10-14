import { Task, WhoDidWhat } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CheckSquare, User, Users } from 'lucide-react';
import { Badge } from '../ui/badge';
import { getConfidenceColor, getConfidenceBadge } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

interface TasksListProps {
  tasks: Task[];
  whoDidWhat: WhoDidWhat[];
}

export function TasksList({ tasks, whoDidWhat }: TasksListProps) {
  const selfGivenTasks = tasks.filter(t => t.owner === t.assignee);
  const assignedTasks = tasks.filter(t => t.owner !== t.assignee);

  return (
    <div className="space-y-6">
      {/* Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Tasks & To-Dos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Self-given tasks */}
            {selfGivenTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Self-Assigned Tasks ({selfGivenTasks.length})
                </h4>
                <div className="space-y-3">
                  {selfGivenTasks.map((task, idx) => (
                    <div key={idx} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium flex-1">{task.task}</p>
                        <Badge variant="outline" className={getConfidenceColor(task.confidence)}>
                          {getConfidenceBadge(task.confidence)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {task.assignee && (
                          <Badge variant="secondary">{task.assignee}</Badge>
                        )}
                        {task.due_date && (
                          <Badge variant="outline">Due: {task.due_date}</Badge>
                        )}
                        {task.status && (
                          <Badge>{task.status}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assigned tasks */}
            {assignedTasks.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assigned Tasks ({assignedTasks.length})
                </h4>
                <div className="space-y-3">
                  {assignedTasks.map((task, idx) => (
                    <div key={idx} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium flex-1">{task.task}</p>
                        <Badge variant="outline" className={getConfidenceColor(task.confidence)}>
                          {getConfidenceBadge(task.confidence)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {task.owner && (
                          <Badge variant="secondary">From: {task.owner}</Badge>
                        )}
                        {task.assignee && (
                          <Badge variant="secondary">To: {task.assignee}</Badge>
                        )}
                        {task.due_date && (
                          <Badge variant="outline">Due: {task.due_date}</Badge>
                        )}
                        {task.status && (
                          <Badge>{task.status}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tasks.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No tasks identified
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Who Did What */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Who Did What
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {whoDidWhat.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activities tracked
              </p>
            ) : (
              <div className="space-y-3">
                {whoDidWhat.map((item, idx) => (
                  <div key={idx} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <Badge variant="secondary" className="mb-2">{item.actor}</Badge>
                        <p className="text-sm">{item.what}</p>
                      </div>
                      <Badge variant="outline" className={getConfidenceColor(item.confidence)}>
                        {getConfidenceBadge(item.confidence)}
                      </Badge>
                    </div>
                    {item.when && (
                      <p className="text-xs text-muted-foreground">When: {item.when}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
