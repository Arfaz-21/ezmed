import { useAdherenceHistory } from '@/hooks/useAdherenceHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

const chartConfig = {
  taken: {
    label: 'Taken',
    color: 'hsl(var(--success))',
  },
  missed: {
    label: 'Missed',
    color: 'hsl(var(--destructive))',
  },
  pending: {
    label: 'Pending',
    color: 'hsl(var(--muted))',
  },
};

export default function AdherenceChart() {
  const { history, weeklyRate, loading } = useAdherenceHistory();

  if (loading) {
    return (
      <Card className="border-2 border-border/50">
        <CardContent className="p-6">
          <div className="h-48 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading chart...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getBarColor = (rate: number) => {
    if (rate >= 80) return 'hsl(var(--success))';
    if (rate >= 50) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  const getTrendIcon = () => {
    if (weeklyRate >= 80) return <TrendingUp className="h-5 w-5 text-success" />;
    if (weeklyRate >= 50) return <Activity className="h-5 w-5 text-warning" />;
    return <TrendingDown className="h-5 w-5 text-destructive" />;
  };

  const getRateColor = () => {
    if (weeklyRate >= 80) return 'text-success';
    if (weeklyRate >= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card className="border-2 border-border/50 bg-gradient-to-br from-card to-muted/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Weekly Adherence
          </CardTitle>
          <div className="flex items-center gap-2">
            {getTrendIcon()}
            <span className={`text-2xl font-bold ${getRateColor()}`}>
              {weeklyRate}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {history.length === 0 || history.every(d => d.total === 0) ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            No medication data available yet
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-40 w-full">
            <BarChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="dayName" 
                tickLine={false} 
                axisLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                hide 
                domain={[0, 100]}
              />
              <ChartTooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg bg-popover p-3 shadow-lg border">
                      <p className="font-medium">{data.date}</p>
                      <p className="text-sm text-success">Taken: {data.taken}</p>
                      <p className="text-sm text-destructive">Missed: {data.missed}</p>
                      <p className="text-sm text-muted-foreground">Total: {data.total}</p>
                      <p className="font-bold mt-1">{data.adherenceRate}% adherence</p>
                    </div>
                  );
                }}
              />
              <Bar 
                dataKey="adherenceRate" 
                radius={[6, 6, 0, 0]}
                maxBarSize={40}
              >
                {history.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.adherenceRate)} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
        
        {/* Legend */}
        <div className="flex justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-success" />
            <span className="text-muted-foreground">≥80%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-warning" />
            <span className="text-muted-foreground">50-79%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-destructive" />
            <span className="text-muted-foreground">&lt;50%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
