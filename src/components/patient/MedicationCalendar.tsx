import { useCalendarView, CalendarDay } from '@/hooks/useCalendarView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar, Check, X, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MedicationCalendarProps {
  patientId?: string;
}

export default function MedicationCalendar({ patientId }: MedicationCalendarProps) {
  const { 
    currentMonth, 
    calendarDays, 
    loading,
    goToPreviousMonth,
    goToNextMonth,
    goToToday
  } = useCalendarView(patientId);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const monthName = currentMonth.toLocaleDateString('en-US', { 
    month: 'long', 
    year: 'numeric' 
  });

  const getDayColor = (day: CalendarDay) => {
    if (day.stats.total === 0) return '';
    if (day.stats.taken === day.stats.total) return 'bg-success/20 border-success/50';
    if (day.stats.missed > 0) return 'bg-destructive/20 border-destructive/50';
    if (day.stats.pending > 0) return 'bg-warning/20 border-warning/50';
    return '';
  };

  return (
    <Card className="border-2 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Medication Calendar
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="font-semibold">{monthName}</span>
          <Button variant="ghost" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        ) : (
          <>
            {/* Week day headers */}
            <div className="grid grid-cols-7 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={cn(
                    "aspect-square p-1 rounded-lg border transition-colors",
                    !day.isCurrentMonth && "opacity-40",
                    day.isToday && "ring-2 ring-primary",
                    getDayColor(day)
                  )}
                >
                  <div className="text-xs font-medium text-center">
                    {day.date.getDate()}
                  </div>
                  {day.stats.total > 0 && (
                    <div className="flex justify-center gap-0.5 mt-1">
                      {day.stats.taken > 0 && (
                        <div className="flex items-center">
                          <Check className="h-2.5 w-2.5 text-success" />
                          <span className="text-[10px] text-success">{day.stats.taken}</span>
                        </div>
                      )}
                      {day.stats.missed > 0 && (
                        <div className="flex items-center">
                          <X className="h-2.5 w-2.5 text-destructive" />
                          <span className="text-[10px] text-destructive">{day.stats.missed}</span>
                        </div>
                      )}
                      {day.stats.pending > 0 && (
                        <div className="flex items-center">
                          <Clock className="h-2.5 w-2.5 text-warning" />
                          <span className="text-[10px] text-warning">{day.stats.pending}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-success/20 border border-success/50" />
                <span className="text-muted-foreground">All taken</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-warning/20 border border-warning/50" />
                <span className="text-muted-foreground">Pending</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-destructive/20 border border-destructive/50" />
                <span className="text-muted-foreground">Missed</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
