import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMedications, MedicationLog } from '@/hooks/useMedications';
import { useVoiceReminder } from '@/hooks/useVoiceReminder';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, Clock, Bell, LogOut, User, AlertTriangle } from 'lucide-react';
import PatientLinkSection from '@/components/patient/PatientLinkSection';

export default function PatientDashboard() {
  const { user, signOut } = useAuth();
  const { todayLogs, markAsTaken, snooze, loading } = useMedications();
  const { toast } = useToast();
  const [activeLog, setActiveLog] = useState<MedicationLog | null>(null);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);

  // Voice reminder hook
  useVoiceReminder(todayLogs, (log) => {
    setActiveLog(log);
  });

  // Find the next pending medication
  const nextPending = todayLogs.find(log => 
    log.status === 'pending' || log.status === 'snoozed'
  );

  const handleTaken = async (logId: string) => {
    const { error } = await markAsTaken(logId);
    if (error) {
      toast({ title: 'Error', description: 'Could not mark as taken', variant: 'destructive' });
    } else {
      toast({ title: '✓ Medication Taken', description: 'Great job!' });
      setActiveLog(null);
      setShowSnoozeOptions(false);
    }
  };

  const handleSnooze = async (logId: string, minutes: number) => {
    const result = await snooze(logId, minutes);
    if (result.error) {
      toast({ title: 'Error', description: 'Could not snooze', variant: 'destructive' });
    } else {
      toast({ 
        title: `⏰ Snoozed for ${minutes} minutes`,
        description: result.snoozeCount && result.snoozeCount >= 3 
          ? 'Your caregiver has been notified' 
          : undefined
      });
      setActiveLog(null);
      setShowSnoozeOptions(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'taken': return <Check className="h-8 w-8 text-success" />;
      case 'snoozed': return <Clock className="h-8 w-8 text-warning" />;
      case 'missed': return <AlertTriangle className="h-8 w-8 text-destructive" />;
      default: return <Bell className="h-8 w-8 text-primary" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'taken': return 'bg-success/10 border-success';
      case 'snoozed': return 'bg-warning/10 border-warning';
      case 'missed': return 'bg-destructive/10 border-destructive';
      default: return 'bg-card border-primary';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-pulse-gentle">
            <Bell className="h-16 w-16 text-primary mx-auto mb-4" />
          </div>
          <p className="text-elderly text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <User className="h-10 w-10 text-primary" />
          <h1 className="text-elderly-lg font-bold">MedEase</h1>
        </div>
        <Button variant="outline" size="icon" onClick={signOut} className="h-12 w-12">
          <LogOut className="h-6 w-6" />
        </Button>
      </header>

      {/* Patient Link Section */}
      <PatientLinkSection />

      {/* Current Medication Alert */}
      {nextPending && (
        <Card className={`mb-6 border-4 ${getStatusColor(nextPending.status)} shadow-lg`}>
          <CardContent className="p-6 text-center">
            <div className="mb-4">
              {getStatusIcon(nextPending.status)}
            </div>
            <h2 className="text-elderly-xl font-bold mb-2">
              {nextPending.medications?.name || 'Medication'}
            </h2>
            <p className="text-elderly text-muted-foreground mb-2">
              {nextPending.medications?.dosage}
            </p>
            <p className="text-elderly-lg font-semibold text-primary mb-6">
              {formatTime(nextPending.scheduled_time)}
            </p>

            {!showSnoozeOptions ? (
              <div className="space-y-4">
                <Button
                  onClick={() => handleTaken(nextPending.id)}
                  className="w-full h-24 text-elderly-lg font-bold bg-success hover:bg-success/90"
                >
                  <Check className="h-10 w-10 mr-4" />
                  TAKEN
                </Button>
                <Button
                  onClick={() => setShowSnoozeOptions(true)}
                  variant="outline"
                  className="w-full h-20 text-elderly border-2 border-warning text-warning hover:bg-warning/10"
                >
                  <Clock className="h-8 w-8 mr-4" />
                  SNOOZE
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-lg text-muted-foreground mb-4">Snooze for:</p>
                {[5, 10, 15].map(mins => (
                  <Button
                    key={mins}
                    onClick={() => handleSnooze(nextPending.id, mins)}
                    variant="outline"
                    className="w-full h-16 text-elderly border-2 border-warning hover:bg-warning/10"
                  >
                    {mins} minutes
                  </Button>
                ))}
                <Button
                  onClick={() => setShowSnoozeOptions(false)}
                  variant="ghost"
                  className="w-full h-12 text-lg"
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Today's Schedule */}
      <h3 className="text-elderly font-semibold mb-4">Today's Medications</h3>
      <div className="space-y-3">
        {todayLogs.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="p-6 text-center">
              <p className="text-lg text-muted-foreground">No medications scheduled</p>
            </CardContent>
          </Card>
        ) : (
          todayLogs.map(log => (
            <Card key={log.id} className={`border-2 ${getStatusColor(log.status)}`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {getStatusIcon(log.status)}
                  <div>
                    <p className="text-lg font-semibold">{log.medications?.name}</p>
                    <p className="text-muted-foreground">{formatTime(log.scheduled_time)}</p>
                  </div>
                </div>
                <span className="text-lg font-medium capitalize px-3 py-1 rounded-full bg-muted">
                  {log.status}
                </span>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
