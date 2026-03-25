import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMedications, MedicationLog } from '@/hooks/useMedications';
import { useVoiceReminder, ActionType } from '@/hooks/useVoiceReminder';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, Clock, Bell, BellOff, LogOut, User, AlertTriangle, Mic, Volume2, VolumeX, BellRing, Settings } from 'lucide-react';
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
import VoiceCommandsHelp from '@/components/patient/VoiceCommandsHelp';
import VoiceCommandFeedback from '@/components/patient/VoiceCommandFeedback';
import VoiceCommandPopup from '@/components/patient/VoiceCommandPopup';

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { todayLogs, markAsTaken, snooze, loading, isOnline } = useMedications();
  const { toast } = useToast();
  const [activeLog, setActiveLog] = useState<MedicationLog | null>(null);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);
  const [showVoicePopup, setShowVoicePopup] = useState(false);
  const [lastHeardCommand, setLastHeardCommand] = useState<string | null>(null);

  // Push notifications
  const { 
    isSupported: pushSupported, 
    permission: pushPermission, 
    requestPermission, 
    scheduleNotification,
    clearScheduledNotification 
  } = usePushNotifications();

  // ========================================
  // CENTRAL ACTION HANDLER
  // Both buttons AND voice commands use this
  // ========================================
  const handleMedicationAction = useCallback(async (
    actionType: ActionType,
    logId: string,
    snoozeMinutes?: number
  ) => {
    console.log('handleMedicationAction:', { actionType, logId, snoozeMinutes });
    
    // Clear any scheduled notification for this log
    clearScheduledNotification(logId);
    
    switch (actionType) {
      case 'taken': {
        try {
          const { error } = await markAsTaken(logId);
          if (error) {
            console.error('markAsTaken error:', error);
            toast({ title: 'Error', description: 'Could not mark as taken', variant: 'destructive' });
          } else {
            toast({ title: '✓ Medication marked as taken', description: 'Great job!' });
            setActiveLog(null);
            setShowSnoozeOptions(false);
            setShowVoicePopup(false);
          }
        } catch (e) {
          console.error('handleMedicationAction exception:', e);
          toast({ title: 'Error', description: 'Something went wrong', variant: 'destructive' });
        }
        break;
      }
      
      case 'snooze': {
        const minutes = snoozeMinutes || 10;
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
          setShowVoicePopup(false);
        }
        break;
      }
      
      case 'help': {
        toast({ 
          title: 'Voice Commands', 
          description: 'Say "TAKEN" to mark as taken, or "SNOOZE" to be reminded later' 
        });
        break;
      }
      
      case 'cancel': {
        toast({ title: 'Dismissed', description: 'Reminder closed' });
        setShowVoicePopup(false);
        setActiveLog(null);
        break;
      }
    }
  }, [markAsTaken, snooze, toast, clearScheduledNotification]);

  // Voice reminder hook with unified action handler
  const { 
    isListening, 
    voiceEnabled, 
    toggleVoice, 
    clearActiveReminder,
    startListening,
    transcript,
    lastCommand,
    error: voiceError,
    confidence,
    isSupported: voiceSupported,
    language: voiceLanguage,
  } = useVoiceReminder(
    todayLogs, 
    (log) => {
      // Called when reminder triggers
      setActiveLog(log);
      setShowVoicePopup(true);
    },
    {
      // CRITICAL: Voice commands use the SAME handler as buttons
      onAction: (actionType, logId, snoozeMinutes) => {
        // Update last heard command for UI feedback
        if (actionType === 'taken') {
          setLastHeardCommand('Heard: "Taken"');
        } else if (actionType === 'snooze') {
          setLastHeardCommand(`Heard: "Snooze ${snoozeMinutes || 10} minutes"`);
        } else if (actionType === 'cancel') {
          setLastHeardCommand('Heard: "Cancel"');
        }
        
        // Close popup immediately
        setShowVoicePopup(false);
        setActiveLog(null);
        
        // Execute the action using central handler
        handleMedicationAction(actionType, logId, snoozeMinutes);
      },
      onError: (errorMsg) => {
        // Show error feedback when voice recognition fails
        toast({ 
          title: "Didn't catch that", 
          description: 'Please try again or use the buttons',
          variant: 'destructive'
        });
        setLastHeardCommand(`Heard: "${transcript}" (not recognized)`);
      }
    }
  );

  // Clear last heard command after 5 seconds
  useEffect(() => {
    if (lastHeardCommand) {
      const timer = setTimeout(() => setLastHeardCommand(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastHeardCommand]);

  // Show popup when there's a pending medication due now or overdue
  useEffect(() => {
    if (!loading && voiceEnabled && todayLogs.length > 0 && !showVoicePopup && !activeLog) {
      const now = new Date();
      const pendingDue = todayLogs.find(log => {
        if (log.status !== 'pending' && log.status !== 'snoozed') return false;
        
        const [hours, minutes] = log.scheduled_time.split(':').map(Number);
        const scheduledTime = new Date();
        scheduledTime.setHours(hours, minutes, 0, 0);
        
        // Check if snoozed_until has passed
        if (log.snoozed_until) {
          const snoozedUntil = new Date(log.snoozed_until);
          return now >= snoozedUntil;
        }
        
        // Check if scheduled time has passed (within 30 min window)
        const diffMinutes = (now.getTime() - scheduledTime.getTime()) / (1000 * 60);
        return diffMinutes >= 0 && diffMinutes <= 30;
      });
      
      if (pendingDue) {
        setActiveLog(pendingDue);
        setShowVoicePopup(true);
      }
    }
  }, [todayLogs, loading, voiceEnabled, showVoicePopup, activeLog]);

  // Schedule notifications for pending logs
  useEffect(() => {
    if (pushPermission === 'granted') {
      todayLogs.forEach(log => {
        if (log.status === 'pending') {
          scheduleNotification(log);
        } else {
          // Clear notification if status changed
          clearScheduledNotification(log.id);
        }
      });
    }
  }, [todayLogs, pushPermission, scheduleNotification, clearScheduledNotification]);

  const handleEnableNotifications = async () => {
    try {
      const granted = await requestPermission();
      if (granted) {
        toast({ title: 'Notifications enabled!', description: "You'll receive reminders even when the app is closed" });
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
    if (pushPermission === 'granted') return 'Notifications are enabled.';
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
      {/* Voice Command Popup */}
      <VoiceCommandPopup
        isOpen={showVoicePopup && !!activeLog}
        isListening={isListening}
        transcript={transcript}
        medicationName={activeLog?.medications?.name || 'Medication'}
        onTaken={() => {
          if (activeLog) {
            // Use completeMedication via clearActiveReminder
            clearActiveReminder(activeLog.id);
            setShowVoicePopup(false);
            setActiveLog(null);
            handleMedicationAction('taken', activeLog.id);
          }
        }}
        onSnooze={() => {
          if (activeLog) {
            clearActiveReminder(activeLog.id);
            setShowVoicePopup(false);
            setActiveLog(null);
            handleMedicationAction('snooze', activeLog.id, 10);
          }
        }}
        onClose={() => {
          if (activeLog) {
            clearActiveReminder(activeLog.id);
          }
          setShowVoicePopup(false);
          setActiveLog(null);
        }}
        onStartListening={() => {
          if (activeLog) startListening(activeLog.id, activeLog);
        }}
        voiceSupported={voiceSupported}
        confidence={confidence}
        lastHeardCommand={lastHeardCommand}
        error={voiceError}
      />

      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 pb-24">
        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-elderly-lg font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                ezMed
              </h1>
              <p className="text-sm text-muted-foreground">Your health companion</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
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
            {voiceSupported && <VoiceCommandsHelp language={voiceLanguage} />}
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleLogout} className="h-12 w-12 rounded-full border-2">
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Logout</p>
              </TooltipContent>
            </Tooltip>
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
        <Card className={`mb-6 border-2 ${getStatusColor(nextPending.status)} shadow-xl overflow-hidden relative`}>
          <div className="absolute inset-0 bg-gradient-to-br from-transparent to-primary/5 pointer-events-none" />
          <CardContent className="p-6 text-center relative">
            {/* Medicine Image */}
            {nextPending.medications?.image_url && (
              <div className="mb-4 flex justify-center">
                <img 
                  src={nextPending.medications.image_url} 
                  alt={nextPending.medications.name}
                  className="w-40 h-40 object-cover rounded-xl border-2 border-primary/20 shadow-lg"
                />
              </div>
            )}
            {!nextPending.medications?.image_url && (
              <div className="mb-4 inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20">
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
              <div className="mb-4">
                <VoiceCommandFeedback
                  isListening={isListening}
                  transcript={transcript}
                  lastCommand={lastCommand}
                  confidence={confidence}
                  error={voiceError}
                />
                {lastHeardCommand && (
                  <p className="text-sm text-muted-foreground mt-2 font-medium">
                    {lastHeardCommand}
                  </p>
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
                  onClick={() => handleMedicationAction('taken', nextPending.id)}
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
                    onClick={() => handleMedicationAction('snooze', nextPending.id, mins)}
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
                      className="w-24 h-24 object-cover rounded-lg border border-border"
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
