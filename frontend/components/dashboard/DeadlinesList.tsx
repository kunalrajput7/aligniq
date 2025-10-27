import { ActionItem } from '@/types/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/badge';

interface DeadlinesListProps {
  tasks: ActionItem[];
}

export function DeadlinesList({ tasks }: DeadlinesListProps) {
  const tasksList = tasks || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          To-Do's
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasksList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No action items
          </p>
        ) : (
          <div className="space-y-3 max-h-[800px] overflow-y-auto">
            {tasksList.map((task, idx) => (
              <div key={idx} className="p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                <p className="text-sm font-medium leading-snug mb-2">{task.task}</p>
                {task.owner && (
                  <Badge variant="secondary" className="text-xs">{task.owner}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
