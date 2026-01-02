import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  logs: CalendarLog[];
  stats: {
    total: number;
    taken: number;
    missed: number;
    pending: number;
  };
}

export interface CalendarLog {
  id: string;
  medication_name: string;
  scheduled_time: string;
  status: 'pending' | 'taken' | 'snoozed' | 'missed';
}

export function useCalendarView(patientId?: string) {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  const targetPatientId = patientId || user?.id;

  const fetchMonthData = useCallback(async () => {
    if (!targetPatientId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Get first and last day of month view (including overflow days)
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      
      const firstDayOfMonth = new Date(year, month, 1);
      const lastDayOfMonth = new Date(year, month + 1, 0);
      
      // Adjust to start from Sunday
      const startDate = new Date(firstDayOfMonth);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      
      // Adjust to end on Saturday
      const endDate = new Date(lastDayOfMonth);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('medication_logs')
        .select('id, scheduled_date, scheduled_time, status, medications(name)')
        .eq('patient_id', targetPatientId)
        .gte('scheduled_date', startStr)
        .lte('scheduled_date', endStr)
        .order('scheduled_time');

      if (error) throw error;

      // Build calendar days
      const days: CalendarDay[] = [];
      const today = new Date().toISOString().split('T')[0];
      
      const current = new Date(startDate);
      while (current <= endDate) {
        const dateString = current.toISOString().split('T')[0];
        const dayLogs = (data || []).filter(log => log.scheduled_date === dateString);
        
        days.push({
          date: new Date(current),
          dateString,
          isCurrentMonth: current.getMonth() === month,
          isToday: dateString === today,
          logs: dayLogs.map(log => ({
            id: log.id,
            medication_name: (log.medications as any)?.name || 'Unknown',
            scheduled_time: log.scheduled_time,
            status: log.status as CalendarLog['status']
          })),
          stats: {
            total: dayLogs.length,
            taken: dayLogs.filter(l => l.status === 'taken').length,
            missed: dayLogs.filter(l => l.status === 'missed').length,
            pending: dayLogs.filter(l => l.status === 'pending' || l.status === 'snoozed').length
          }
        });
        
        current.setDate(current.getDate() + 1);
      }

      setCalendarDays(days);
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, [targetPatientId, currentMonth]);

  useEffect(() => {
    fetchMonthData();
  }, [fetchMonthData]);

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  return {
    currentMonth,
    calendarDays,
    loading,
    goToPreviousMonth,
    goToNextMonth,
    goToToday,
    refresh: fetchMonthData
  };
}
