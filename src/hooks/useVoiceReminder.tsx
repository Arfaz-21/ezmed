import { useEffect, useRef, useCallback } from 'react';
import { MedicationLog } from './useMedications';

export function useVoiceReminder(
  logs: MedicationLog[],
  onReminderTriggered?: (log: MedicationLog) => void
) {
  const spokenLogsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8; // Slower for elderly
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.lang = 'en-US';
      
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const checkReminders = useCallback(() => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    logs.forEach(log => {
      if (log.status !== 'pending' && log.status !== 'snoozed') return;

      let shouldRemind = false;
      const logKey = `${log.id}-${log.scheduled_date}`;

      if (log.status === 'pending') {
        // Check if it's time for the medication
        if (log.scheduled_time.slice(0, 5) === currentTime) {
          shouldRemind = true;
        }
      } else if (log.status === 'snoozed' && log.snoozed_until) {
        // Check if snooze period is over
        const snoozeEnd = new Date(log.snoozed_until);
        if (now >= snoozeEnd) {
          shouldRemind = true;
        }
      }

      if (shouldRemind && !spokenLogsRef.current.has(logKey)) {
        const medName = log.medications?.name || 'your medication';
        speak(`It's time to take ${medName}. Please take your medicine now.`);
        spokenLogsRef.current.add(logKey);
        onReminderTriggered?.(log);

        // Allow re-reminder after 1 minute
        setTimeout(() => {
          spokenLogsRef.current.delete(logKey);
        }, 60000);
      }
    });
  }, [logs, speak, onReminderTriggered]);

  useEffect(() => {
    // Check immediately
    checkReminders();

    // Then check every 30 seconds
    intervalRef.current = setInterval(checkReminders, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkReminders]);

  const speakNow = useCallback((text: string) => {
    speak(text);
  }, [speak]);

  return { speakNow };
}
