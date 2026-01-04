import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useEmergencyAlert() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);

  const sendEmergencyAlert = useCallback(async () => {
    if (!user?.id) return { error: new Error('Not authenticated') };

    setSending(true);
    try {
      // Get linked caregiver
      const { data: link, error: linkError } = await supabase
        .from('patient_caregiver_links')
        .select('caregiver_id')
        .eq('patient_id', user.id)
        .eq('status', 'approved')
        .maybeSingle();

      if (linkError || !link) {
        return { error: new Error('No linked caregiver found') };
      }

      // Create emergency alert
      const { error } = await supabase
        .from('emergency_alerts')
        .insert({
          patient_id: user.id,
          caregiver_id: link.caregiver_id,
          message: 'Patient needs help!'
        });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    } finally {
      setSending(false);
    }
  }, [user?.id]);

  return { sendEmergencyAlert, sending };
}

// Hook for caregivers to receive emergency alerts
export function useEmergencyAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);

  const fetchAlerts = useCallback(async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('emergency_alerts')
      .select('*')
      .eq('caregiver_id', user.id)
      .eq('is_acknowledged', false)
      .order('created_at', { ascending: false });

    setAlerts(data || []);
  }, [user?.id]);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    await supabase
      .from('emergency_alerts')
      .update({ 
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId);
    
    fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, fetchAlerts, acknowledgeAlert };
}
