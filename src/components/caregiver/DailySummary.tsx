import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, AlertTriangle, Clock, TrendingUp } from 'lucide-react';
import { MedicationLog } from '@/hooks/useMedications';

interface DailySummaryProps {
  todayLogs: MedicationLog[];
}

export default function DailySummary({ todayLogs }: DailySummaryProps) {
  const summary = useMemo(() => {
    const taken = todayLogs.filter(l => l.status === 'taken').length;
    const missed = todayLogs.filter(l => l.status === 'missed').length;
    const pending = todayLogs.filter(l => l.status === 'pending' || l.status === 'snoozed').length;
    const total = todayLogs.length;
    const adherenceRate = total > 0 ? Math.round((taken / total) * 100) : 0;

    return { taken, missed, pending, total, adherenceRate };
  }, [todayLogs]);

  if (todayLogs.length === 0) return null;

  return (
    <Card className="mb-6 border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-secondary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Today's Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          {/* Taken */}
          <div className="p-3 rounded-lg bg-success/10 border border-success/30">
            <div className="flex items-center justify-center mb-1">
              <Check className="h-6 w-6 text-success" />
            </div>
            <p className="text-2xl font-bold text-success">{summary.taken}</p>
            <p className="text-xs text-muted-foreground">Taken</p>
          </div>

          {/* Pending */}
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
            <div className="flex items-center justify-center mb-1">
              <Clock className="h-6 w-6 text-warning" />
            </div>
            <p className="text-2xl font-bold text-warning">{summary.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>

          {/* Missed */}
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
            <div className="flex items-center justify-center mb-1">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-destructive">{summary.missed}</p>
            <p className="text-xs text-muted-foreground">Missed</p>
          </div>
        </div>

        {/* Adherence Rate */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Adherence Rate</span>
            <span className={`text-lg font-bold ${
              summary.adherenceRate >= 80 ? 'text-success' :
              summary.adherenceRate >= 50 ? 'text-warning' :
              'text-destructive'
            }`}>
              {summary.adherenceRate}%
            </span>
          </div>
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                summary.adherenceRate >= 80 ? 'bg-success' :
                summary.adherenceRate >= 50 ? 'bg-warning' :
                'bg-destructive'
              }`}
              style={{ width: `${summary.adherenceRate}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
