import { useEffect, useCallback, useState } from 'react';
import { MedicationLog } from './useMedications';
import { useVoiceRecognition } from './voice/useVoiceRecognition';
import { useReminderScheduler } from './voice/useReminderScheduler';
import {
  ActionType,
  VoiceReminderOptions,
  LANGUAGE_COMMANDS,
  isInQuietHours,
  getVoiceSettings,
} from './voice/types';

export type { ActionType } from './voice/types';

export function useVoiceReminder(
  logs: MedicationLog[],
  onReminderTriggered?: (log: MedicationLog) => void,
  options?: VoiceReminderOptions
) {
  const [voiceEnabled, setVoiceEnabled] = useState(() => getVoiceSettings().voiceRemindersEnabled);
  const [language, setLanguage] = useState(() => getVoiceSettings().voiceLanguage);

  const recognition = useVoiceRecognition(options);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) { onEnd?.(); return; }
    const settings = getVoiceSettings();
    if (isInQuietHours(settings)) { onEnd?.(); return; }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.05;
    utterance.volume = 1.0;
    utterance.lang = settings.voiceLanguage;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
      v.lang.startsWith(settings.voiceLanguage.split('-')[0]) ||
      v.name.includes('Samantha') ||
      v.name.includes('Google US English') ||
      v.name.includes('Microsoft Zira')
    );
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onend = () => onEnd?.();
    window.speechSynthesis.speak(utterance);
  }, []);

  // Unified command handler that bridges recognition → options.onAction
  const handleCommand = useCallback((action: ActionType, logId: string, snoozeMinutes?: number) => {
    const langCommands = LANGUAGE_COMMANDS[getVoiceSettings().voiceLanguage] || LANGUAGE_COMMANDS['en-US'];

    // Stop everything
    recognition.stopListening();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    scheduler.completeReminder(logId);

    // Speak confirmation
    if (action === 'taken') speak(langCommands.responses.taken);
    else if (action === 'snooze') speak(langCommands.responses.snooze(snoozeMinutes || 10));
    else if (action === 'help') speak(langCommands.responses.help);

    options?.onAction?.(action, logId, snoozeMinutes);
  }, [recognition, speak, options]);

  const scheduler = useReminderScheduler(logs, {
    onTrigger: (log) => onReminderTriggered?.(log),
    speak,
    startListening: (logId) => {
      recognition.startListening(logId, handleCommand);
    },
    enabled: voiceEnabled,
  });

  // completeMedication - single cleanup function for buttons & voice
  const completeMedication = useCallback((logId: string) => {
    recognition.stopListening();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    scheduler.completeReminder(logId);
  }, [recognition, scheduler]);

  const clearActiveReminder = completeMedication;

  const startListening = useCallback((logId: string, log?: MedicationLog) => {
    recognition.startListening(logId, handleCommand, log?.status);
  }, [recognition, handleCommand]);

  // Sync settings from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      const settings = getVoiceSettings();
      setVoiceEnabled(settings.voiceRemindersEnabled);
      setLanguage(settings.voiceLanguage);
    };
    window.addEventListener('storage', handleStorageChange);
    const settings = getVoiceSettings();
    setVoiceEnabled(settings.voiceRemindersEnabled);
    setLanguage(settings.voiceLanguage);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Load voices
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
    return () => {
      recognition.stopListening();
    };
  }, [recognition]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const newValue = !prev;
      try {
        const saved = localStorage.getItem('ezmed-settings');
        const settings = saved ? JSON.parse(saved) : {};
        settings.voiceRemindersEnabled = newValue;
        localStorage.setItem('ezmed-settings', JSON.stringify(settings));
      } catch {}
      return newValue;
    });
  }, []);

  const getLanguageCommands = useCallback(() => {
    return LANGUAGE_COMMANDS[language] || LANGUAGE_COMMANDS['en-US'];
  }, [language]);

  const testVoice = useCallback(() => {
    speak(getLanguageCommands().responses.help);
  }, [speak, getLanguageCommands]);

  const speakNow = useCallback((text: string) => speak(text), [speak]);

  return {
    speakNow,
    isListening: recognition.state.isListening,
    activeLogId: recognition.activeLogId,
    voiceEnabled,
    toggleVoice,
    startListening,
    stopListening: recognition.stopListening,
    clearActiveReminder,
    transcript: recognition.state.transcript,
    lastCommand: recognition.state.lastCommand,
    error: recognition.state.error,
    confidence: recognition.state.confidence,
    isSupported: recognition.isSupported,
    testVoice,
    language,
    availableLanguages: Object.keys(LANGUAGE_COMMANDS),
    parseVoiceCommand: recognition.parseVoiceCommand,
  };
}
