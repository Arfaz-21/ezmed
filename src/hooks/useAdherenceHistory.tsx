import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface DailyAdherence {
  date: string;
  dayName: string;
  total: number;
  taken: number;
  missed: number;
  snoozed: number;
  pending: number;
  adherenceRate: number;
}

export function useAdherenceHistory(patientId?: string, days: number = 7) {
  const { user } = useAuth();
  const [history, setHistory] = useState<DailyAdherence[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyRate, setWeeklyRate] = useState(0);

  const targetPatientId = patientId || user?.id;

  const fetchHistory = useCallback(async () => {
    if (!targetPatientId) {
      setLoading(false);
      return;
    }

    try {
      // Get dates for the past week
      const dates: string[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }

      const { data, error } = await supabase
        .from('medication_logs')
        .select('scheduled_date, status')
        .eq('patient_id', targetPatientId)
        .gte('scheduled_date', dates[0])
        .lte('scheduled_date', dates[dates.length - 1]);

      if (error) throw error;

      // Process data by date
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const historyData: DailyAdherence[] = dates.map(date => {
        const dayLogs = data?.filter(log => log.scheduled_date === date) || [];
        const taken = dayLogs.filter(log => log.status === 'taken').length;
        const missed = dayLogs.filter(log => log.status === 'missed').length;
        const snoozed = dayLogs.filter(log => log.status === 'snoozed').length;
        const pending = dayLogs.filter(log => log.status === 'pending').length;
        const total = dayLogs.length;

        const d = new Date(date);
        
        return {
          date,
          dayName: dayNames[d.getDay()],
          total,
          taken,
          missed,
          snoozed,
          pending,
          adherenceRate: total > 0 ? Math.round((taken / total) * 100) : 0
        };
      });

      setHistory(historyData);

      // Calculate weekly average
      const totalMeds = historyData.reduce((sum, d) => sum + d.total, 0);
      const totalTaken = historyData.reduce((sum, d) => sum + d.taken, 0);
      setWeeklyRate(totalMeds > 0 ? Math.round((totalTaken / totalMeds) * 100) : 0);

    } catch (error) {
      console.error('Error fetching adherence history:', error);
    } finally {
      setLoading(false);
    }
  }, [targetPatientId, days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    weeklyRate,
    loading,
    refresh: fetchHistory
  };
}
