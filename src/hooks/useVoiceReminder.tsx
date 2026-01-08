import { useEffect, useRef, useCallback, useState } from 'react';
import { MedicationLog } from './useMedications';

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

export type ActionType = 'taken' | 'snooze' | 'help' | 'cancel';

interface VoiceReminderOptions {
  onAction?: (actionType: ActionType, logId: string, snoozeMinutes?: number) => void;
  onError?: (error: string) => void;
}

interface VoiceSettings {
  voiceRemindersEnabled: boolean;
  voiceVolume: number;
  repeatInterval: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  voiceLanguage: string;
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceRemindersEnabled: true,
  voiceVolume: 100,
  repeatInterval: 1,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  voiceLanguage: 'en-US',
};

// Multi-language command patterns - expanded to handle more phrases
const LANGUAGE_COMMANDS: Record<string, {
  taken: string[];
  snooze: string[];
  help: string[];
  cancel: string[];
  responses: {
    taken: string;
    snooze: (min: number) => string;
    help: string;
    notUnderstood: string;
    reminder: (name: string) => string;
    repeatReminder: (name: string) => string;
  };
}> = {
  'en-US': {
    taken: ['taken', 'take', 'took', 'i took it', 'done', 'yes', 'okay', 'ok', 'already', 'already done', 'i already took it', 'i took my medicine', 'took my medicine', 'i have taken', 'finished', 'complete', 'completed', 'i did', 'did it', 'mark as taken', 'mark taken'],
    snooze: ['snooze', 'later', 'wait', 'remind me', 'remind me later', 'not now', 'come back', 'snooze for', 'delay', 'postpone', 'in a bit', 'in a while', 'few minutes', 'later please', 'not yet'],
    help: ['help', 'what can i say', 'commands', 'what are the commands', 'options', 'what should i say'],
    cancel: ['cancel', 'never mind', 'stop', 'stop listening', 'quiet', 'dismiss', 'close', 'exit', 'go away'],
    responses: {
      taken: 'Marking as taken. Great job!',
      snooze: (min) => `Snoozing for ${min} minutes.`,
      help: 'You can say: Taken, to mark as taken. Snooze, to be reminded later. Or Cancel, to stop listening.',
      notUnderstood: "Didn't catch that, please try again. Say Taken, Snooze, or Help.",
      reminder: (name) => `It's time to take ${name}. Please say taken or snooze.`,
      repeatReminder: (name) => `Reminder: Please take ${name}. Say taken or snooze.`,
    },
  },
  'es-ES': {
    taken: ['tomado', 'lo tomé', 'listo', 'sí', 'ya', 'ya lo hice', 'hecho', 'terminado'],
    snooze: ['posponer', 'después', 'espera', 'recuérdame', 'más tarde', 'ahora no', 'retrasar'],
    help: ['ayuda', 'qué puedo decir', 'comandos', 'opciones'],
    cancel: ['cancelar', 'olvídalo', 'parar', 'silencio', 'cerrar'],
    responses: {
      taken: '¡Marcado como tomado. Buen trabajo!',
      snooze: (min) => `Posponiendo por ${min} minutos.`,
      help: 'Puede decir: Tomado, para marcar. Posponer, para recordar después. O Cancelar.',
      notUnderstood: 'No entendí. Por favor intente de nuevo. Diga Tomado, Posponer o Ayuda.',
      reminder: (name) => `Es hora de tomar ${name}. Diga tomado o posponer.`,
      repeatReminder: (name) => `Recordatorio: Por favor tome ${name}. Diga tomado o posponer.`,
    },
  },
};

// Store scheduled reminders to trigger at exact times
const scheduledReminders = new Map<string, ReturnType<typeof setTimeout>>();
// Store repeat intervals
const repeatIntervals = new Map<string, ReturnType<typeof setInterval>>();

// Helper to check if we're in quiet hours
const isInQuietHours = (settings: VoiceSettings): boolean => {
  if (!settings.quietHoursEnabled) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = settings.quietHoursStart.split(':').map(Number);
  const [endHour, endMin] = settings.quietHoursEnd.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  // Handle overnight quiet hours (e.g., 22:00 to 07:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

// Helper to get settings from localStorage
const getVoiceSettings = (): VoiceSettings => {
  try {
    const saved = localStorage.getItem('ezmed-settings');
    return saved ? { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_VOICE_SETTINGS;
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
};

// Helper to clear all reminders for a specific log
const clearRemindersForLog = (logId: string) => {
  // Clear scheduled reminder
  scheduledReminders.forEach((timeout, key) => {
    if (key.startsWith(logId)) {
      clearTimeout(timeout);
      scheduledReminders.delete(key);
    }
  });
  
  // Clear repeat interval
  if (repeatIntervals.has(logId)) {
    clearInterval(repeatIntervals.get(logId)!);
    repeatIntervals.delete(logId);
  }
};

export function useVoiceReminder(
  logs: MedicationLog[],
  onReminderTriggered?: (log: MedicationLog) => void,
  options?: VoiceReminderOptions
) {
  const activeReminderRef = useRef<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isStoppedRef = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(() => getVoiceSettings().voiceRemindersEnabled);
  const [transcript, setTranscript] = useState<string>('');
  const [lastCommand, setLastCommand] = useState<{ text: string; recognized: boolean; command?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [language, setLanguage] = useState<string>(() => getVoiceSettings().voiceLanguage);

  // Check browser support
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) &&
    'speechSynthesis' in window;

  const getLanguageCommands = useCallback(() => {
    return LANGUAGE_COMMANDS[language] || LANGUAGE_COMMANDS['en-US'];
  }, [language]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }
    
    const settings = getVoiceSettings();
    
    // Check quiet hours
    if (isInQuietHours(settings)) {
      console.log('In quiet hours, skipping voice');
      onEnd?.();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.05;
    utterance.volume = 1.0; // Always max volume for reminders
    utterance.lang = settings.voiceLanguage;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith(settings.voiceLanguage.split('-')[0]) ||
      v.name.includes('Samantha') || 
      v.name.includes('Google US English') ||
      v.name.includes('Microsoft Zira')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onend = () => onEnd?.();
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopListening = useCallback(() => {
    isStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // CRITICAL: Complete medication action - stops EVERYTHING and cleans up
  // This is the SINGLE function that both buttons and voice commands use
  const completeMedication = useCallback((logId: string) => {
    console.log('completeMedication called for:', logId);
    
    // 1. Stop speech recognition IMMEDIATELY
    isStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }
    
    // 2. Set isListening = false (removes "Listening..." indicator)
    setIsListening(false);
    
    // 3. Stop speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    // 4. Clear ALL reminder timers and intervals for this log
    clearRemindersForLog(logId);
    
    // 5. Reset active state
    activeReminderRef.current = null;
    setActiveLogId(null);
    setTranscript('');
    setConfidence(0);
    setError(null);
  }, []);

  // Alias for backwards compatibility
  const clearActiveReminder = completeMedication;

  // Parse voice command and return action type
  const parseVoiceCommand = useCallback((transcriptText: string): { action: ActionType | null; snoozeMinutes?: number } => {
    const lower = transcriptText.toLowerCase().trim();
    const langCommands = getLanguageCommands();
    
    console.log('Parsing voice command:', lower);

    // Check for "taken" command
    if (langCommands.taken.some(cmd => lower.includes(cmd))) {
      return { action: 'taken' };
    }

    // Check for snooze commands with optional minutes
    if (langCommands.snooze.some(cmd => lower.includes(cmd))) {
      let minutes = 10; // default
      const snoozeMatch = lower.match(/(\d+)/);
      if (snoozeMatch && snoozeMatch[1]) {
        const parsed = parseInt(snoozeMatch[1], 10);
        if (parsed >= 1 && parsed <= 60) {
          minutes = parsed;
        }
      }
      return { action: 'snooze', snoozeMinutes: minutes };
    }

    // Check for help commands
    if (langCommands.help.some(cmd => lower.includes(cmd))) {
      return { action: 'help' };
    }

    // Check for cancel commands
    if (langCommands.cancel.some(cmd => lower.includes(cmd))) {
      return { action: 'cancel' };
    }

    return { action: null };
  }, [getLanguageCommands]);

  const processVoiceCommand = useCallback((transcriptText: string, logId: string, conf: number): boolean => {
    const langCommands = getLanguageCommands();
    
    // CRITICAL: Normalize transcript - lowercase and trim
    const normalizedText = transcriptText.toLowerCase().trim();
    console.log('Processing voice command:', normalizedText, 'confidence:', conf);

    setConfidence(conf);

    const { action, snoozeMinutes } = parseVoiceCommand(normalizedText);

    if (action === 'taken') {
      setLastCommand({ text: transcriptText, recognized: true, command: 'taken' });
      
      // FIRST: Complete medication (stops everything)
      completeMedication(logId);
      
      // THEN: Speak confirmation and trigger action
      speak(langCommands.responses.taken);
      options?.onAction?.('taken', logId);
      return true;
    }

    if (action === 'snooze') {
      const minutes = snoozeMinutes || 10;
      setLastCommand({ text: transcriptText, recognized: true, command: 'snooze' });
      
      // FIRST: Complete medication (stops everything)
      completeMedication(logId);
      
      // THEN: Speak confirmation and trigger action
      speak(langCommands.responses.snooze(minutes));
      options?.onAction?.('snooze', logId, minutes);
      return true;
    }

    if (action === 'help') {
      setLastCommand({ text: transcriptText, recognized: true, command: 'help' });
      speak(langCommands.responses.help);
      options?.onAction?.('help', logId);
      return true;
    }

    if (action === 'cancel') {
      setLastCommand({ text: transcriptText, recognized: true, command: 'cancel' });
      
      // Complete medication (stops everything)
      completeMedication(logId);
      
      options?.onAction?.('cancel', logId);
      return true;
    }

    // Not recognized - show error
    setLastCommand({ text: transcriptText, recognized: false });
    setError(langCommands.responses.notUnderstood);
    options?.onError?.(langCommands.responses.notUnderstood);
    
    // Speak the "not understood" message
    speak(langCommands.responses.notUnderstood);
    
    return false;
  }, [speak, options, completeMedication, getLanguageCommands, parseVoiceCommand]);

  const startListening = useCallback((logId: string, log?: MedicationLog) => {
    // SAFETY CHECK: Don't start listening for non-pending medications
    if (log && log.status !== 'pending' && log.status !== 'snoozed') {
      console.log('Not starting listening - medication status is:', log.status);
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const errMsg = 'Speech recognition not supported in this browser';
      setError(errMsg);
      options?.onError?.(errMsg);
      console.log(errMsg);
      return;
    }

    // Stop any existing recognition first
    isStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
      recognitionRef.current = null;
    }
    
    // Reset state
    isStoppedRef.current = false;
    setError(null);
    setTranscript('');
    setConfidence(0);
    setIsListening(false);

    const settings = getVoiceSettings();
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.voiceLanguage;

    recognition.onstart = () => {
      setIsListening(true);
      setActiveLogId(logId);
      activeReminderRef.current = logId;
      console.log('Voice recognition started for log:', logId);
    };

    recognition.onresult = (event) => {
      // Don't process if we've been stopped
      if (isStoppedRef.current) return;
      
      const last = event.results.length - 1;
      const result = event.results[last];
      const transcriptText = result[0].transcript;
      const conf = result[0].confidence;
      
      setTranscript(transcriptText);
      setConfidence(conf);
      
      if (result.isFinal) {
        processVoiceCommand(transcriptText, logId, conf);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        const errMsg = 'Microphone access denied. Please allow microphone access.';
        setError(errMsg);
        options?.onError?.(errMsg);
        setIsListening(false);
      } else if (event.error === 'no-speech') {
        // This is normal, don't show error but restart if still active
        if (!isStoppedRef.current && activeReminderRef.current === logId) {
          setTimeout(() => {
            if (!isStoppedRef.current && activeReminderRef.current === logId) {
              try {
                recognition.start();
              } catch (e) {
                console.log('Could not restart recognition after no-speech');
                setIsListening(false);
              }
            }
          }, 500);
        } else {
          setIsListening(false);
        }
      } else if (event.error === 'aborted') {
        // Explicitly aborted - ensure listening state is false
        setIsListening(false);
      } else {
        // Try to restart on other errors if still active
        if (!isStoppedRef.current && activeReminderRef.current === logId) {
          setTimeout(() => {
            if (!isStoppedRef.current && activeReminderRef.current === logId) {
              try {
                recognition.start();
              } catch (e) {
                console.log('Could not restart recognition');
                setIsListening(false);
              }
            }
          }, 1000);
        } else {
          setIsListening(false);
        }
      }
    };

    recognition.onend = () => {
      // Only restart if still active for this log and not manually stopped
      if (!isStoppedRef.current && activeReminderRef.current === logId) {
        setTimeout(() => {
          if (!isStoppedRef.current && activeReminderRef.current === logId) {
            try {
              recognition.start();
            } catch (e) {
              console.log('Could not restart recognition on end');
              setIsListening(false);
            }
          }
        }, 500);
      } else {
        // CRITICAL: Always reset listening state when recognition ends
        setIsListening(false);
        setTranscript('');
        setConfidence(0);
      }
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (e) {
      console.error('Could not start speech recognition:', e);
      const errMsg = 'Could not start voice recognition';
      setError(errMsg);
      options?.onError?.(errMsg);
      setIsListening(false);
    }
  }, [processVoiceCommand, options]);

  const triggerReminder = useCallback((log: MedicationLog) => {
    // SAFETY CHECK: Don't trigger for non-pending/snoozed logs
    if (log.status !== 'pending' && log.status !== 'snoozed') {
      console.log('SAFETY: Not triggering reminder - status is:', log.status);
      // Clear any lingering reminders for this log
      clearRemindersForLog(log.id);
      return;
    }
    
    // Don't re-trigger if already active for this log
    if (activeReminderRef.current === log.id) return;
    
    const settings = getVoiceSettings();
    const langCommands = LANGUAGE_COMMANDS[settings.voiceLanguage] || LANGUAGE_COMMANDS['en-US'];
    
    // Check quiet hours
    if (isInQuietHours(settings)) {
      console.log('In quiet hours, skipping reminder');
      return;
    }
    
    activeReminderRef.current = log.id;
    const medName = log.medications?.name || 'your medication';
    const message = langCommands.responses.reminder(medName);
    
    console.log('Triggering voice reminder for:', medName);
    
    speak(message, () => {
      // Start listening after speaking
      startListening(log.id);
    });
    
    onReminderTriggered?.(log);

    // Clear any existing repeat interval for this log
    if (repeatIntervals.has(log.id)) {
      clearInterval(repeatIntervals.get(log.id)!);
    }
    
    const repeatMs = settings.repeatInterval * 60 * 1000;
    
    const intervalId = setInterval(() => {
      // Check if still active
      if (activeReminderRef.current === log.id) {
        const currentSettings = getVoiceSettings();
        const currentLangCommands = LANGUAGE_COMMANDS[currentSettings.voiceLanguage] || LANGUAGE_COMMANDS['en-US'];
        
        if (isInQuietHours(currentSettings)) {
          console.log('Entered quiet hours, stopping repeats');
          return;
        }
        console.log('Repeating reminder for:', medName);
        speak(currentLangCommands.responses.repeatReminder(medName), () => {
          startListening(log.id);
        });
      } else {
        // Clear this interval if no longer active
        clearInterval(intervalId);
        repeatIntervals.delete(log.id);
      }
    }, repeatMs);
    
    repeatIntervals.set(log.id, intervalId);
  }, [speak, startListening, onReminderTriggered]);

  // Schedule reminders at exact LOCAL times
  const scheduleReminder = useCallback((log: MedicationLog, targetTime: Date) => {
    const now = new Date();
    const delay = targetTime.getTime() - now.getTime();
    
    if (delay <= 0) return;

    const key = `${log.id}-${targetTime.toISOString()}`;
    
    // Clear any existing timeout for this key
    if (scheduledReminders.has(key)) {
      clearTimeout(scheduledReminders.get(key)!);
    }

    console.log(`Scheduling reminder for ${log.medications?.name} at ${targetTime.toLocaleTimeString()}, in ${Math.round(delay / 1000)}s`);
    
    const timeout = setTimeout(() => {
      const settings = getVoiceSettings();
      if (settings.voiceRemindersEnabled && !isInQuietHours(settings)) {
        triggerReminder(log);
      }
      scheduledReminders.delete(key);
    }, delay);
    
    scheduledReminders.set(key, timeout);
  }, [triggerReminder]);

  // Sync voiceEnabled and language state with settings
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

  // Check and schedule reminders based on LOCAL time
  useEffect(() => {
    const settings = getVoiceSettings();
    if (!settings.voiceRemindersEnabled) return;

    const now = new Date();

    logs.forEach(log => {
      // Skip if not pending/snoozed
      if (log.status !== 'pending' && log.status !== 'snoozed') {
        // If status changed from pending/snoozed, clear any reminders
        clearRemindersForLog(log.id);
        return;
      }
      
      if (activeReminderRef.current === log.id) return;

      let targetTime: Date | null = null;

      if (log.status === 'pending') {
        const [hours, minutes] = log.scheduled_time.split(':').map(Number);
        targetTime = new Date();
        targetTime.setHours(hours, minutes, 0, 0);
        
        if (now >= targetTime) {
          const timeDiff = now.getTime() - targetTime.getTime();
          // Trigger if within the last 5 minutes
          if (timeDiff < 5 * 60 * 1000) {
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

      if (targetTime) {
        scheduleReminder(log, targetTime);
      }
    });

    return () => {
      scheduledReminders.forEach((timeout) => {
        clearTimeout(timeout);
      });
      scheduledReminders.clear();
    };
  }, [logs, triggerReminder, scheduleReminder]);

  // Load voices on mount
  useEffect(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    return () => {
      // Cleanup all intervals and timeouts
      repeatIntervals.forEach((interval) => clearInterval(interval));
      repeatIntervals.clear();
      scheduledReminders.forEach((timeout) => clearTimeout(timeout));
      scheduledReminders.clear();
      stopListening();
    };
  }, [stopListening]);

  const speakNow = useCallback((text: string) => {
    speak(text);
  }, [speak]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const newValue = !prev;
      try {
        const saved = localStorage.getItem('ezmed-settings');
        const settings = saved ? JSON.parse(saved) : {};
        settings.voiceRemindersEnabled = newValue;
        localStorage.setItem('ezmed-settings', JSON.stringify(settings));
      } catch (e) {
        console.error('Could not save voice setting', e);
      }
      return newValue;
    });
  }, []);

  const testVoice = useCallback(() => {
    const langCommands = getLanguageCommands();
    speak(langCommands.responses.help);
  }, [speak, getLanguageCommands]);

  const availableLanguages = Object.keys(LANGUAGE_COMMANDS);

  return { 
    speakNow, 
    isListening, 
    activeLogId, 
    voiceEnabled, 
    toggleVoice,
    startListening,
    stopListening,
    clearActiveReminder,
    transcript,
    lastCommand,
    error,
    confidence,
    isSupported,
    testVoice,
    language,
    availableLanguages,
    parseVoiceCommand,
  };
}
