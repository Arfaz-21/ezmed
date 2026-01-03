import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface CaregiverAlert {
  id: string;
  patient_id: string;
  caregiver_id: string;
  medication_log_id: string;
  alert_type: 'missed' | 'multiple_snooze';
  message: string;
  is_read: boolean;
  created_at: string;
}

export function useCaregiverAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<CaregiverAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('caregiver_alerts')
        .select('*')
        .eq('caregiver_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const typedAlerts = (data || []) as CaregiverAlert[];
      setAlerts(typedAlerts);
      setUnreadCount(typedAlerts.filter(a => !a.is_read).length);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Realtime subscription for new alerts
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('caregiver-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'caregiver_alerts',
          filter: `caregiver_id=eq.${user.id}`
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchAlerts]);

  const markAsRead = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('caregiver_alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;
      await fetchAlerts();
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('caregiver_alerts')
        .update({ is_read: true })
        .eq('caregiver_id', user?.id)
        .eq('is_read', false);

      if (error) throw error;
      await fetchAlerts();
    } catch (error) {
      console.error('Error marking all alerts as read:', error);
    }
  };

  return {
    alerts,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refreshAlerts: fetchAlerts
  };
}

// Function to create an alert when patient misses or snoozes multiple times
export async function createCaregiverAlert(
  patientId: string,
  medicationLogId: string,
  alertType: 'missed' | 'multiple_snooze',
  medicationName: string,
  snoozeCount?: number
) {
  try {
    // Get linked caregiver
    const { data: link, error: linkError } = await supabase
      .from('patient_caregiver_links')
      .select('caregiver_id')
      .eq('patient_id', patientId)
      .eq('status', 'approved')
      .maybeSingle();

    if (linkError || !link) {
      console.log('No linked caregiver found');
      return;
    }

    const message = alertType === 'missed'
      ? `Patient missed their medication: ${medicationName}`
      : `Patient snoozed ${medicationName} ${snoozeCount} times`;

    const { error } = await supabase
      .from('caregiver_alerts')
      .insert({
        patient_id: patientId,
        caregiver_id: link.caregiver_id,
        medication_log_id: medicationLogId,
        alert_type: alertType,
        message
      });

    if (error) throw error;
  } catch (error) {
    console.error('Error creating caregiver alert:', error);
  }
}
