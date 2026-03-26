import { useEffect, useRef, useCallback } from 'react';
import { MedicationLog } from '../useMedications';
import { VoiceSettings, LANGUAGE_COMMANDS, isInQuietHours, getVoiceSettings } from './types';

interface SchedulerOptions {
  onTrigger: (log: MedicationLog) => void;
  speak: (text: string, onEnd?: () => void) => void;
  startListening: (logId: string) => void;
  enabled: boolean;
}

export function useReminderScheduler(logs: MedicationLog[], options: SchedulerOptions) {
  const scheduledRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const repeatRef = useRef(new Map<string, ReturnType<typeof setInterval>>());
  const activeRef = useRef<string | null>(null);

  const clearRemindersForLog = useCallback((logId: string) => {
    scheduledRef.current.forEach((timeout, key) => {
      if (key.startsWith(logId)) {
        clearTimeout(timeout);
        scheduledRef.current.delete(key);
      }
    });
    if (repeatRef.current.has(logId)) {
      clearInterval(repeatRef.current.get(logId)!);
      repeatRef.current.delete(logId);
    }
  }, []);

  const clearAllReminders = useCallback(() => {
    scheduledRef.current.forEach(t => clearTimeout(t));
    scheduledRef.current.clear();
    repeatRef.current.forEach(i => clearInterval(i));
    repeatRef.current.clear();
    activeRef.current = null;
  }, []);

  const triggerReminder = useCallback((log: MedicationLog) => {
    if (log.status !== 'pending' && log.status !== 'snoozed') {
      clearRemindersForLog(log.id);
      return;
    }
    if (activeRef.current === log.id) return;

    const settings = getVoiceSettings();
    const langCommands = LANGUAGE_COMMANDS[settings.voiceLanguage] || LANGUAGE_COMMANDS['en-US'];

    if (isInQuietHours(settings)) return;

    activeRef.current = log.id;
    const medName = log.medications?.name || 'your medication';

    options.speak(langCommands.responses.reminder(medName), () => {
      options.startListening(log.id);
    });

    options.onTrigger(log);

    // Set up repeat interval
    if (repeatRef.current.has(log.id)) {
      clearInterval(repeatRef.current.get(log.id)!);
    }

    const repeatMs = settings.repeatInterval * 60 * 1000;
    const intervalId = setInterval(() => {
      if (activeRef.current === log.id) {
        const currentSettings = getVoiceSettings();
        const currentLang = LANGUAGE_COMMANDS[currentSettings.voiceLanguage] || LANGUAGE_COMMANDS['en-US'];
        if (isInQuietHours(currentSettings)) return;
        options.speak(currentLang.responses.repeatReminder(medName), () => {
          options.startListening(log.id);
        });
      } else {
        clearInterval(intervalId);
        repeatRef.current.delete(log.id);
      }
    }, repeatMs);

    repeatRef.current.set(log.id, intervalId);
  }, [options, clearRemindersForLog]);

  const scheduleReminder = useCallback((log: MedicationLog, targetTime: Date) => {
    const delay = targetTime.getTime() - Date.now();
    if (delay <= 0) return;

    const key = `${log.id}-${targetTime.toISOString()}`;
    if (scheduledRef.current.has(key)) {
      clearTimeout(scheduledRef.current.get(key)!);
    }

    const timeout = setTimeout(() => {
      const settings = getVoiceSettings();
      if (settings.voiceRemindersEnabled && !isInQuietHours(settings)) {
        triggerReminder(log);
      }
      scheduledRef.current.delete(key);
    }, delay);

    scheduledRef.current.set(key, timeout);
  }, [triggerReminder]);

  // Schedule/clear reminders based on logs
  useEffect(() => {
    if (!options.enabled) return;
    const now = new Date();

    logs.forEach(log => {
      if (log.status !== 'pending' && log.status !== 'snoozed') {
        clearRemindersForLog(log.id);
        return;
      }
      if (activeRef.current === log.id) return;

      let targetTime: Date | null = null;

      if (log.status === 'pending') {
        const [hours, minutes] = log.scheduled_time.split(':').map(Number);
        targetTime = new Date();
        targetTime.setHours(hours, minutes, 0, 0);
        if (now >= targetTime) {
          // Trigger if within 30 min of scheduled time
          if (now.getTime() - targetTime.getTime() < 30 * 60 * 1000) {
            triggerReminder(log);
          }
          return;
        }
      } else if (log.status === 'snoozed' && log.snoozed_until) {
        targetTime = new Date(log.snoozed_until);
        if (now >= targetTime) {
          triggerReminder(log);
          return;
        }
      }

      if (targetTime) scheduleReminder(log, targetTime);
    });

    return () => {
      scheduledRef.current.forEach(t => clearTimeout(t));
      scheduledRef.current.clear();
    };
  }, [logs, options.enabled, triggerReminder, scheduleReminder, clearRemindersForLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllReminders();
  }, [clearAllReminders]);

  return {
    clearRemindersForLog,
    clearAllReminders,
    completeReminder: useCallback((logId: string) => {
      clearRemindersForLog(logId);
      if (activeRef.current === logId) {
        activeRef.current = null;
      }
    }, [clearRemindersForLog]),
  };
}
