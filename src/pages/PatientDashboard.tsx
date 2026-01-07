import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMedications, MedicationLog } from '@/hooks/useMedications';
import { useVoiceReminder } from '@/hooks/useVoiceReminder';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, Clock, Bell, BellOff, LogOut, User, AlertTriangle, Mic, MicOff, Volume2, VolumeX, BellRing, Settings } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PatientLinkSection from '@/components/patient/PatientLinkSection';
import AdherenceChart from '@/components/patient/AdherenceChart';
import MedicationCalendar from '@/components/patient/MedicationCalendar';
import HelpButton from '@/components/patient/HelpButton';

export default function PatientDashboard() {
  const navigate = useNavigate();
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
  const { 
    isListening, 
    voiceEnabled, 
    toggleVoice, 
    clearActiveReminder,
    transcript,
    lastCommand,
    error: voiceError,
    isSupported: voiceSupported
  } = useVoiceReminder(
    todayLogs, 
    (log) => {
      setActiveLog(log);
    },
    {
      onTaken: (logId) => {
        handleTaken(logId);
        clearActiveReminder();
      },
      onSnooze: (logId, minutes) => {
        handleSnooze(logId, minutes);
        clearActiveReminder();
      }
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
    try {
      const granted = await requestPermission();
      if (granted) {
        toast({ title: 'Notifications enabled!', description: 'You\'ll receive reminders even when the app is closed' });
      } else {
        toast({ title: 'Permission denied', description: 'Please allow notifications in your browser settings', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({ title: 'Error', description: 'Could not enable notifications', variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast({ title: 'Signed out', description: 'You have been logged out' });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({ title: 'Error', description: 'Could not sign out', variant: 'destructive' });
    }
  };

  const getNotificationTooltip = () => {
    if (pushPermission === 'granted') return 'Notifications are enabled. You\'ll receive reminders even when the app is closed.';
    if (pushPermission === 'denied') return 'Notifications are blocked. Please enable them in your browser settings.';
    return 'Click to enable notifications for medication reminders.';
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
    <TooltipProvider>
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
            {/* Notification Status */}
            {pushSupported && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={pushPermission !== 'granted' ? handleEnableNotifications : undefined}
                    className={`h-12 w-12 rounded-full ${
                      pushPermission === 'granted' 
                        ? 'text-success' 
                        : pushPermission === 'denied' 
                          ? 'text-destructive' 
                          : 'text-muted-foreground'
                    }`}
                  >
                    {pushPermission === 'granted' ? (
                      <Bell className="h-6 w-6" />
                    ) : pushPermission === 'denied' ? (
                      <BellOff className="h-6 w-6" />
                    ) : (
                      <BellRing className="h-6 w-6" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-center">
                  <p>{getNotificationTooltip()}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {/* Voice Status */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={toggleVoice}
                  className={`h-12 w-12 rounded-full ${voiceEnabled ? 'text-primary' : 'text-muted-foreground'}`}
                >
                  {voiceEnabled ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{voiceEnabled ? 'Voice reminders enabled' : 'Voice reminders disabled'}</p>
              </TooltipContent>
            </Tooltip>
            {isListening && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-primary/10 border-2 border-primary/50 shadow-lg animate-pulse">
                <Mic className="h-5 w-5 text-primary" />
                <span className="text-sm text-primary font-bold">Listening...</span>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={() => navigate('/settings')} 
                  className="h-12 w-12 rounded-full border-2"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
            <Button variant="outline" size="icon" onClick={handleLogout} className="h-12 w-12 rounded-full border-2">
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

      {/* HELP Button */}
      <div className="mb-6">
        <HelpButton />
      </div>

      {/* Current Medication Alert */}
      {nextPending && (
        <Card className={`mb-6 border-2 ${getStatusColor(nextPending.status)} shadow-xl overflow-hidden`}>
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/5" />
          <CardContent className="p-6 text-center relative">
            {/* Medicine Image */}
            {nextPending.medications?.image_url && (
              <div className="mb-4 flex justify-center">
                <img 
                  src={nextPending.medications.image_url} 
                  alt={nextPending.medications.name}
                  className="w-24 h-24 object-cover rounded-xl border-2 border-primary/20 shadow-lg"
                />
              </div>
            )}
            {!nextPending.medications?.image_url && (
              <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20">
                {getStatusIcon(nextPending.status)}
              </div>
            )}
            <h2 className="text-elderly-xl font-bold mb-2 text-foreground">
              {nextPending.medications?.name || 'Medication'}
            </h2>
            <p className="text-elderly text-muted-foreground mb-2">
              {nextPending.medications?.dosage}
            </p>
            <p className="text-elderly-lg font-semibold text-primary mb-6">
              {formatTime(nextPending.scheduled_time)}
            </p>

            {/* Voice feedback section */}
            {voiceEnabled && voiceSupported && (
              <div className="mb-4 space-y-2">
                {/* Listening indicator with transcript */}
                {isListening && (
                  <div className="p-4 rounded-xl bg-primary/10 border-2 border-primary/30 animate-pulse">
                    <div className="flex items-center justify-center gap-3 mb-2">
                      <div className="relative">
                        <Mic className="h-6 w-6 text-primary" />
                        <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full animate-ping" />
                      </div>
                      <span className="text-lg font-bold text-primary">Listening...</span>
                    </div>
                    {transcript && (
                      <p className="text-center text-muted-foreground italic">
                        "{transcript}"
                      </p>
                    )}
                  </div>
                )}
                
                {/* Last command feedback */}
                {lastCommand && !isListening && (
                  <div className={`p-3 rounded-lg border ${
                    lastCommand.recognized 
                      ? 'bg-success/10 border-success/30 text-success' 
                      : 'bg-warning/10 border-warning/30 text-warning'
                  }`}>
                    <p className="text-sm text-center">
                      {lastCommand.recognized 
                        ? `✓ Recognized: "${lastCommand.text}"` 
                        : `? Didn't understand: "${lastCommand.text}". Try saying "Taken" or "Snooze".`
                      }
                    </p>
                  </div>
                )}
                
                {/* Voice error */}
                {voiceError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <p className="text-sm text-destructive text-center">{voiceError}</p>
                  </div>
                )}
                
                {/* Voice instruction hint */}
                {!isListening && !lastCommand && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                      <Mic className="h-4 w-4" />
                      Say "Taken" or "Snooze" to respond with voice
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Voice not supported warning */}
            {voiceEnabled && !voiceSupported && (
              <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <p className="text-sm text-warning text-center">
                  Voice commands are not supported in this browser. Please use the buttons below.
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
                  {/* Medicine Image or Status Icon */}
                  {log.medications?.image_url ? (
                    <img 
                      src={log.medications.image_url} 
                      alt={log.medications.name}
                      className="w-14 h-14 object-cover rounded-lg border border-border"
                    />
                  ) : (
                    <div className={`p-2 rounded-full ${
                      log.status === 'taken' ? 'bg-success/10' :
                      log.status === 'snoozed' ? 'bg-warning/10' :
                      log.status === 'missed' ? 'bg-destructive/10' :
                      'bg-primary/10'
                    }`}>
                      {getStatusIcon(log.status)}
                    </div>
                  )}
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
    </TooltipProvider>
  );
}
