import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMedications, MedicationLog } from '@/hooks/useMedications';
import { useVoiceReminder } from '@/hooks/useVoiceReminder';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, Clock, Bell, LogOut, User, AlertTriangle, Mic, MicOff, Volume2, VolumeX, BellRing } from 'lucide-react';
import PatientLinkSection from '@/components/patient/PatientLinkSection';
import AdherenceChart from '@/components/patient/AdherenceChart';
import MedicationCalendar from '@/components/patient/MedicationCalendar';

export default function PatientDashboard() {
  const { user, signOut } = useAuth();
  const { todayLogs, markAsTaken, snooze, loading } = useMedications();
  const { toast } = useToast();
  const [activeLog, setActiveLog] = useState<MedicationLog | null>(null);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);

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

  // Voice reminder hook with callbacks
  const { isListening, voiceEnabled, toggleVoice } = useVoiceReminder(
    todayLogs, 
    (log) => {
      setActiveLog(log);
    },
    {
      onTaken: handleTaken,
      onSnooze: handleSnooze
    }
  );

  // Push notifications
  const { isSupported: pushSupported, permission: pushPermission, requestPermission, scheduleNotification } = usePushNotifications();

  // Schedule notifications for pending logs
  useEffect(() => {
    if (pushPermission === 'granted') {
      todayLogs
        .filter(log => log.status === 'pending')
        .forEach(log => scheduleNotification(log));
    }
  }, [todayLogs, pushPermission, scheduleNotification]);

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast({ title: 'Notifications enabled!', description: 'You\'ll receive reminders even when the app is closed' });
    }
  };

  // Find the next pending medication
  const nextPending = todayLogs.find(log => 
    log.status === 'pending' || log.status === 'snoozed'
  );

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
      case 'taken': return 'bg-success/10 border-success/50';
      case 'snoozed': return 'bg-warning/10 border-warning/50';
      case 'missed': return 'bg-destructive/10 border-destructive/50';
      default: return 'bg-primary/5 border-primary/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-pulse">
            <Bell className="h-16 w-16 text-primary mx-auto mb-4" />
          </div>
          <p className="text-elderly text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 pb-24">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-elderly-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              MedEase
            </h1>
            <p className="text-sm text-muted-foreground">Your health companion</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Voice Status */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleVoice}
            className={`h-12 w-12 rounded-full ${voiceEnabled ? 'text-primary' : 'text-muted-foreground'}`}
          >
            {voiceEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </Button>
          {isListening && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30">
              <Mic className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm text-primary font-medium">Listening...</span>
            </div>
          )}
          <Button variant="outline" size="icon" onClick={signOut} className="h-12 w-12 rounded-full border-2">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Patient Link Section */}
      <PatientLinkSection />

      {/* Push Notification Enable Button */}
      {pushSupported && pushPermission !== 'granted' && (
        <Card className="mb-4 border-2 border-secondary/30 bg-gradient-to-r from-secondary/5 to-primary/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BellRing className="h-6 w-6 text-secondary" />
              <div>
                <p className="font-medium">Enable Notifications</p>
                <p className="text-sm text-muted-foreground">Get reminders even when app is closed</p>
              </div>
            </div>
            <Button size="sm" onClick={handleEnableNotifications}>
              Enable
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Adherence Chart */}
      <div className="mb-4">
        <AdherenceChart />
      </div>

      {/* Calendar View */}
      <div className="mb-6">
        <MedicationCalendar />
      </div>

      {/* Current Medication Alert */}
      {nextPending && (
        <Card className={`mb-6 border-2 ${getStatusColor(nextPending.status)} shadow-xl overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/5" />
          <CardContent className="p-6 text-center relative">
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20">
              {getStatusIcon(nextPending.status)}
            </div>
            <h2 className="text-elderly-xl font-bold mb-2 text-foreground">
              {nextPending.medications?.name || 'Medication'}
            </h2>
            <p className="text-elderly text-muted-foreground mb-2">
              {nextPending.medications?.dosage}
            </p>
            <p className="text-elderly-lg font-semibold text-primary mb-6">
              {formatTime(nextPending.scheduled_time)}
            </p>

            {/* Voice instruction hint */}
            {voiceEnabled && (
              <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Mic className="h-4 w-4" />
                  Say "Taken" or "Snooze" to respond with voice
                </p>
              </div>
            )}

            {!showSnoozeOptions ? (
              <div className="space-y-4">
                <Button
                  onClick={() => handleTaken(nextPending.id)}
                  className="w-full h-24 text-elderly-lg font-bold bg-gradient-to-r from-success to-success/80 hover:from-success/90 hover:to-success/70 shadow-lg shadow-success/25"
                >
                  <Check className="h-10 w-10 mr-4" />
                  TAKEN
                </Button>
                <Button
                  onClick={() => setShowSnoozeOptions(true)}
                  variant="outline"
                  className="w-full h-20 text-elderly border-2 border-warning/50 text-warning hover:bg-warning/10 hover:border-warning"
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
                    className="w-full h-16 text-elderly border-2 border-warning/50 hover:bg-warning/10 hover:border-warning"
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
      <h3 className="text-elderly font-semibold mb-4 flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        Today's Medications
      </h3>
      <div className="space-y-3">
        {todayLogs.length === 0 ? (
          <Card className="border-2 border-dashed border-muted">
            <CardContent className="p-6 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-lg text-muted-foreground">No medications scheduled</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Your caregiver can add medications for you</p>
            </CardContent>
          </Card>
        ) : (
          todayLogs.map(log => (
            <Card key={log.id} className={`border-2 ${getStatusColor(log.status)} transition-all hover:shadow-md`}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-full ${
                    log.status === 'taken' ? 'bg-success/10' :
                    log.status === 'snoozed' ? 'bg-warning/10' :
                    log.status === 'missed' ? 'bg-destructive/10' :
                    'bg-primary/10'
                  }`}>
                    {getStatusIcon(log.status)}
                  </div>
                  <div>
                    <p className="text-lg font-semibold">{log.medications?.name}</p>
                    <p className="text-muted-foreground">{formatTime(log.scheduled_time)}</p>
                  </div>
                </div>
                <span className={`text-sm font-medium capitalize px-3 py-1.5 rounded-full ${
                  log.status === 'taken' ? 'bg-success/20 text-success' :
                  log.status === 'snoozed' ? 'bg-warning/20 text-warning' :
                  log.status === 'missed' ? 'bg-destructive/20 text-destructive' :
                  'bg-primary/20 text-primary'
                }`}>
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
