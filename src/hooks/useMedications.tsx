import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { createCaregiverAlert } from './useCaregiverAlerts';
import { useOfflineSync } from './useOfflineSync';
import { useToast } from './use-toast';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  scheduled_time: string;
  frequency: string;
  is_active: boolean;
  patient_id: string;
  image_url?: string | null;
}

export interface MedicationLog {
  id: string;
  medication_id: string;
  patient_id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: 'pending' | 'taken' | 'snoozed' | 'missed';
  action_taken_at: string | null;
  snooze_count: number;
  snoozed_until: string | null;
  medications?: Medication;
}

export function useMedications(patientId?: string) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todayLogs, setTodayLogs] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const targetPatientId = patientId || user?.id;

  // Offline sync integration
  const { isOnline, isSyncing, addPendingAction } = useOfflineSync(async (action) => {
    if (action.type === 'taken') {
      await supabase
        .from('medication_logs')
        .update({ status: 'taken', action_taken_at: action.timestamp })
        .eq('id', action.logId);
    } else if (action.type === 'snoozed') {
      await supabase
        .from('medication_logs')
        .update({
          status: 'snoozed',
          snoozed_until: action.snoozeUntil,
          action_taken_at: action.timestamp,
        })
        .eq('id', action.logId);
    }
  });

  const fetchMedications = useCallback(async () => {
    if (!targetPatientId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('patient_id', targetPatientId)
        .eq('is_active', true)
        .order('scheduled_time');
      if (error) throw error;
      setMedications(data || []);
      if (!data || data.length === 0) setLoading(false);
    } catch (error) {
      console.error('Error fetching medications:', error);
      setLoading(false);
    }
  }, [targetPatientId]);

  const fetchTodayLogs = useCallback(async () => {
    if (!targetPatientId) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data, error } = await supabase
        .from('medication_logs')
        .select('*, medications(*)')
        .eq('patient_id', targetPatientId)
        .eq('scheduled_date', today)
        .order('scheduled_time');
      if (error) throw error;
      setTodayLogs((data || []) as MedicationLog[]);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }, [targetPatientId]);

  const createTodayLogs = useCallback(async () => {
    if (!targetPatientId || medications.length === 0) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      for (const med of medications) {
        const { data: existing } = await supabase
          .from('medication_logs')
          .select('id')
          .eq('medication_id', med.id)
          .eq('scheduled_date', today)
          .maybeSingle();
        if (!existing) {
          await supabase.from('medication_logs').insert({
            medication_id: med.id,
            patient_id: targetPatientId,
            scheduled_date: today,
            scheduled_time: med.scheduled_time,
            status: 'pending',
          });
        }
      }
      await fetchTodayLogs();
    } catch (error) {
      console.error('Error creating logs:', error);
    }
  }, [targetPatientId, medications, fetchTodayLogs]);

  useEffect(() => { fetchMedications(); }, [fetchMedications]);
  useEffect(() => { if (medications.length > 0) createTodayLogs(); }, [medications, createTodayLogs]);

  // Realtime subscription
  useEffect(() => {
    if (!targetPatientId) return;
    const channel = supabase
      .channel('medication-logs')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'medication_logs',
        filter: `patient_id=eq.${targetPatientId}`,
      }, () => fetchTodayLogs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [targetPatientId, fetchTodayLogs]);

  const addMedication = async (medication: Omit<Medication, 'id' | 'is_active' | 'patient_id'>) => {
    if (!targetPatientId) return { error: new Error('No patient') };
    try {
      const { error } = await supabase.from('medications').insert({
        ...medication, patient_id: targetPatientId, created_by: user?.id,
      });
      if (error) throw error;
      await fetchMedications();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const updateMedication = async (id: string, updates: Partial<Medication>) => {
    try {
      const { error } = await supabase.from('medications').update(updates).eq('id', id);
      if (error) throw error;
      await fetchMedications();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const deleteMedication = async (id: string) => {
    try {
      const { error } = await supabase.from('medications').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      await fetchMedications();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const markAsTaken = async (logId: string) => {
    // Optimistic update
    setTodayLogs(prev => prev.map(l =>
      l.id === logId ? { ...l, status: 'taken' as const, action_taken_at: new Date().toISOString() } : l
    ));

    try {
      const { error } = await supabase
        .from('medication_logs')
        .update({ status: 'taken', action_taken_at: new Date().toISOString() })
        .eq('id', logId);

      if (error) throw error;
      await fetchTodayLogs();
      return { error: null };
    } catch (error) {
      if (!isOnline) {
        addPendingAction({ type: 'taken', logId });
        toast({ title: '📱 Saved offline', description: 'Will sync when connected' });
        return { error: null };
      }
      // Revert optimistic update on real error
      await fetchTodayLogs();
      return { error: error as Error };
    }
  };

  const snooze = async (logId: string, minutes: number) => {
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    const log = todayLogs.find(l => l.id === logId);
    const newSnoozeCount = (log?.snooze_count || 0) + 1;

    // Optimistic update
    setTodayLogs(prev => prev.map(l =>
      l.id === logId ? {
        ...l,
        status: 'snoozed' as const,
        snoozed_until: snoozedUntil,
        snooze_count: newSnoozeCount,
        action_taken_at: new Date().toISOString(),
      } : l
    ));

    try {
      const { error } = await supabase
        .from('medication_logs')
        .update({
          status: 'snoozed',
          snoozed_until: snoozedUntil,
          snooze_count: newSnoozeCount,
          action_taken_at: new Date().toISOString(),
        })
        .eq('id', logId);

      if (error) throw error;

      if (newSnoozeCount >= 3 && targetPatientId && log?.medications?.name) {
        await createCaregiverAlert(targetPatientId, logId, 'multiple_snooze', log.medications.name, newSnoozeCount);
      }

      await fetchTodayLogs();
      return { error: null, snoozeCount: newSnoozeCount };
    } catch (error) {
      if (!isOnline) {
        addPendingAction({ type: 'snoozed', logId, snoozeMinutes: minutes });
        toast({ title: '📱 Saved offline', description: 'Will sync when connected' });
        return { error: null, snoozeCount: newSnoozeCount };
      }
      await fetchTodayLogs();
      return { error: error as Error };
    }
  };

  const markAsMissed = async (logId: string) => {
    try {
      const log = todayLogs.find(l => l.id === logId);
      const { error } = await supabase
        .from('medication_logs')
        .update({ status: 'missed', action_taken_at: new Date().toISOString() })
        .eq('id', logId);
      if (error) throw error;
      if (targetPatientId && log?.medications?.name) {
        await createCaregiverAlert(targetPatientId, logId, 'missed', log.medications.name);
      }
      await fetchTodayLogs();
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  return {
    medications, todayLogs, loading, isOnline, isSyncing,
    addMedication, updateMedication, deleteMedication,
    markAsTaken, snooze, markAsMissed,
    refreshMedications: fetchMedications, refreshLogs: fetchTodayLogs,
  };
}
