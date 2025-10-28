import { ActionItem } from '@/types/api';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/badge';

interface DeadlinesListProps {
  tasks: ActionItem[];
}

export function DeadlinesList({ tasks }: DeadlinesListProps) {
  const tasksList = tasks || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="h-5 w-5" />
          To-Do's
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {tasksList.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No action items
          </p>
        ) : (
          <div className="space-y-2 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
            {tasksList.map((task, idx) => (
              <div key={idx} className="flex gap-3 py-2 hover:bg-accent/30 rounded-md px-2 transition-colors">
                <span className="text-sm font-bold text-primary min-w-[24px]">{idx + 1}.</span>
                <div className="flex-1">
                  <p className="text-sm leading-relaxed mb-1">{task.task}</p>
                  {task.owner && (
                    <Badge variant="secondary" className="text-xs">{task.owner}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
