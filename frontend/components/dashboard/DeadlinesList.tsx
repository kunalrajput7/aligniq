import { ActionItem } from '@/types/api';
import { Card, CardContent } from '../ui/card';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/badge';

interface DeadlinesListProps {
  tasks: ActionItem[];
}

export function DeadlinesList({ tasks }: DeadlinesListProps) {
  const tasksList = tasks || [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="h-6 w-6" />
        <h2 className="text-2xl font-bold">To-Do's</h2>
      </div>
      <Card className="flex-1 flex flex-col">
        <CardContent className="pt-6 px-4 flex-1 overflow-hidden">
          {tasksList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No action items
            </p>
          ) : (
            <div className="space-y-2 pr-2 h-full overflow-y-auto custom-scrollbar">
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
    </div>
  );
}
