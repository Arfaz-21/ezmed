import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, Phone, X } from 'lucide-react';

interface EmergencyAlert {
  id: string;
  patient_id: string;
  message: string;
  created_at: string;
}

export default function EmergencyAlertBanner() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);

  const fetchAlerts = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('emergency_alerts')
      .select('*')
      .eq('caregiver_id', user.id)
      .eq('is_acknowledged', false)
      .order('created_at', { ascending: false });

    setAlerts((data || []) as EmergencyAlert[]);
  };

  useEffect(() => {
    fetchAlerts();

    // Subscribe to new emergency alerts
    if (!user?.id) return;

    const channel = supabase
      .channel('emergency-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emergency_alerts',
          filter: `caregiver_id=eq.${user.id}`
        },
        () => {
          fetchAlerts();
          // Play alert sound
          try {
            const audio = new Audio('/alert.mp3');
            audio.play().catch(() => {});
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const acknowledgeAlert = async (alertId: string) => {
    await supabase
      .from('emergency_alerts')
      .update({ 
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', alertId);
    
    fetchAlerts();
  };

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {alerts.map(alert => (
        <div 
          key={alert.id}
          className="p-4 bg-destructive/10 border-2 border-destructive rounded-lg animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive rounded-full">
                <Phone className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  HELP ALERT!
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(alert.created_at).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => acknowledgeAlert(alert.id)}
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4 mr-1" />
              Acknowledge
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
