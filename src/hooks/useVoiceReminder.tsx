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

interface VoiceReminderOptions {
  onTaken?: (logId: string) => void;
  onSnooze?: (logId: string, minutes: number) => void;
  onSkip?: (logId: string) => void;
  onHelp?: () => void;
  onCancel?: () => void;
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
  voiceVolume: 80,
  repeatInterval: 1,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  voiceLanguage: 'en-US',
};

// Multi-language command patterns
const LANGUAGE_COMMANDS: Record<string, {
  taken: string[];
  snooze: string[];
  skip: string[];
  help: string[];
  cancel: string[];
  responses: {
    taken: string;
    snooze: (min: number) => string;
    skip: string;
    help: string;
    notUnderstood: string;
    reminder: (name: string) => string;
    repeatReminder: (name: string) => string;
  };
}> = {
  'en-US': {
    taken: ['taken', 'take', 'took', 'i took it', 'done', 'yes', 'okay', 'ok', 'already', 'already done', 'i already took it'],
    snooze: ['snooze', 'later', 'wait', 'remind me', 'remind me later', 'not now', 'come back'],
    skip: ['skip', 'skip this', 'skip this one', 'not today', 'pass'],
    help: ['help', 'what can i say', 'commands', 'what are the commands'],
    cancel: ['cancel', 'never mind', 'stop', 'stop listening', 'quiet'],
    responses: {
      taken: 'Marking as taken. Great job!',
      snooze: (min) => `Snoozing for ${min} minutes.`,
      skip: 'Skipping this medication.',
      help: 'You can say: Taken, to mark as taken. Snooze, to be reminded later. Skip, to skip this one. Or Cancel, to stop listening.',
      notUnderstood: 'I didn\'t understand. Try saying Taken, Snooze, Skip, or Help.',
      reminder: (name) => `It's time to take ${name}. Please say taken, snooze, or skip.`,
      repeatReminder: (name) => `Reminder: Please take ${name}. Say taken, snooze, or skip.`,
    },
  },
  'es-ES': {
    taken: ['tomado', 'lo tomé', 'listo', 'sí', 'ya', 'ya lo hice', 'hecho'],
    snooze: ['posponer', 'después', 'espera', 'recuérdame', 'más tarde', 'ahora no'],
    skip: ['omitir', 'saltar', 'hoy no', 'pasar'],
    help: ['ayuda', 'qué puedo decir', 'comandos'],
    cancel: ['cancelar', 'olvídalo', 'parar', 'silencio'],
    responses: {
      taken: '¡Marcado como tomado. Buen trabajo!',
      snooze: (min) => `Posponiendo por ${min} minutos.`,
      skip: 'Omitiendo este medicamento.',
      help: 'Puede decir: Tomado, para marcar. Posponer, para recordar después. Omitir, para saltar. O Cancelar.',
      notUnderstood: 'No entendí. Diga Tomado, Posponer, Omitir o Ayuda.',
      reminder: (name) => `Es hora de tomar ${name}. Diga tomado, posponer u omitir.`,
      repeatReminder: (name) => `Recordatorio: Por favor tome ${name}. Diga tomado, posponer u omitir.`,
    },
  },
  'fr-FR': {
    taken: ['pris', 'je l\'ai pris', 'fait', 'oui', 'déjà', 'déjà fait'],
    snooze: ['reporter', 'plus tard', 'attends', 'rappelle-moi', 'pas maintenant'],
    skip: ['ignorer', 'sauter', 'pas aujourd\'hui', 'passer'],
    help: ['aide', 'que puis-je dire', 'commandes'],
    cancel: ['annuler', 'oublie', 'stop', 'silence'],
    responses: {
      taken: 'Marqué comme pris. Bien joué!',
      snooze: (min) => `Reporté de ${min} minutes.`,
      skip: 'Médicament ignoré.',
      help: 'Vous pouvez dire: Pris, pour marquer. Reporter, pour rappeler plus tard. Ignorer, pour sauter. Ou Annuler.',
      notUnderstood: 'Je n\'ai pas compris. Dites Pris, Reporter, Ignorer ou Aide.',
      reminder: (name) => `C'est l'heure de prendre ${name}. Dites pris, reporter ou ignorer.`,
      repeatReminder: (name) => `Rappel: Veuillez prendre ${name}. Dites pris, reporter ou ignorer.`,
    },
  },
  'de-DE': {
    taken: ['genommen', 'habe ich genommen', 'fertig', 'ja', 'schon', 'schon gemacht', 'erledigt'],
    snooze: ['verschieben', 'später', 'warte', 'erinnere mich', 'nicht jetzt'],
    skip: ['überspringen', 'heute nicht', 'auslassen'],
    help: ['hilfe', 'was kann ich sagen', 'befehle'],
    cancel: ['abbrechen', 'vergiss es', 'stop', 'ruhe'],
    responses: {
      taken: 'Als genommen markiert. Gut gemacht!',
      snooze: (min) => `Verschoben um ${min} Minuten.`,
      skip: 'Medikament übersprungen.',
      help: 'Sie können sagen: Genommen, zum markieren. Verschieben, für später. Überspringen, zum auslassen. Oder Abbrechen.',
      notUnderstood: 'Ich habe nicht verstanden. Sagen Sie Genommen, Verschieben, Überspringen oder Hilfe.',
      reminder: (name) => `Zeit für ${name}. Sagen Sie genommen, verschieben oder überspringen.`,
      repeatReminder: (name) => `Erinnerung: Bitte nehmen Sie ${name}. Sagen Sie genommen, verschieben oder überspringen.`,
    },
  },
  'pt-BR': {
    taken: ['tomado', 'eu tomei', 'pronto', 'sim', 'já', 'já fiz', 'feito'],
    snooze: ['adiar', 'depois', 'espere', 'me lembre', 'mais tarde', 'agora não'],
    skip: ['pular', 'hoje não', 'passar'],
    help: ['ajuda', 'o que posso dizer', 'comandos'],
    cancel: ['cancelar', 'esquece', 'parar', 'silêncio'],
    responses: {
      taken: 'Marcado como tomado. Muito bem!',
      snooze: (min) => `Adiado por ${min} minutos.`,
      skip: 'Pulando este medicamento.',
      help: 'Você pode dizer: Tomado, para marcar. Adiar, para lembrar depois. Pular, para ignorar. Ou Cancelar.',
      notUnderstood: 'Não entendi. Diga Tomado, Adiar, Pular ou Ajuda.',
      reminder: (name) => `Hora de tomar ${name}. Diga tomado, adiar ou pular.`,
      repeatReminder: (name) => `Lembrete: Por favor tome ${name}. Diga tomado, adiar ou pular.`,
    },
  },
  'zh-CN': {
    taken: ['已服用', '吃了', '完成', '是', '好了', '已经吃了'],
    snooze: ['延后', '稍后', '等等', '提醒我', '待会儿', '现在不行'],
    skip: ['跳过', '今天不要', '不吃'],
    help: ['帮助', '我能说什么', '命令'],
    cancel: ['取消', '算了', '停止', '安静'],
    responses: {
      taken: '已标记为服用。做得好！',
      snooze: (min) => `延后${min}分钟。`,
      skip: '跳过此药物。',
      help: '您可以说：已服用，来标记。延后，稍后提醒。跳过，来跳过。或取消。',
      notUnderstood: '我没听懂。说 已服用、延后、跳过 或 帮助。',
      reminder: (name) => `该服用${name}了。说 已服用、延后 或 跳过。`,
      repeatReminder: (name) => `提醒：请服用${name}。说 已服用、延后 或 跳过。`,
    },
  },
};

// Store scheduled reminders to trigger at exact times
const scheduledReminders = new Map<string, ReturnType<typeof setTimeout>>();

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

export function useVoiceReminder(
  logs: MedicationLog[],
  onReminderTriggered?: (log: MedicationLog) => void,
  options?: VoiceReminderOptions
) {
  const activeReminderRef = useRef<string | null>(null);
  const repeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
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
    if (!('speechSynthesis' in window)) return;
    
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
    utterance.rate = 0.85; // Slower for elderly
    utterance.pitch = 1;
    utterance.volume = settings.voiceVolume / 100;
    utterance.lang = settings.voiceLanguage;

    // Try to use a clear, friendly voice
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

    utterance.onend = () => {
      onEnd?.();
    };
    
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setTranscript('');
    setConfidence(0);
  }, []);

  const clearActiveReminder = useCallback(() => {
    activeReminderRef.current = null;
    setActiveLogId(null);
    setTranscript('');
    setLastCommand(null);
    setConfidence(0);
    stopListening();
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, [stopListening]);

  const processVoiceCommand = useCallback((transcriptText: string, logId: string, conf: number): boolean => {
    const lower = transcriptText.toLowerCase().trim();
    const langCommands = getLanguageCommands();
    console.log('Processing voice command:', lower, 'confidence:', conf);

    setConfidence(conf);

    // Check for "taken" command
    if (langCommands.taken.some(cmd => lower.includes(cmd))) {
      setLastCommand({ text: transcriptText, recognized: true, command: 'taken' });
      speak(langCommands.responses.taken);
      options?.onTaken?.(logId);
      clearActiveReminder();
      return true;
    }

    // Check for snooze commands
    const snoozeMatch = lower.match(/(\d+)/);
    if (langCommands.snooze.some(cmd => lower.includes(cmd))) {
      let minutes = 5; // default
      if (snoozeMatch && snoozeMatch[1]) {
        const parsed = parseInt(snoozeMatch[1], 10);
        if (parsed >= 1 && parsed <= 60) {
          minutes = parsed;
        }
      }
      
      setLastCommand({ text: transcriptText, recognized: true, command: 'snooze' });
      speak(langCommands.responses.snooze(minutes));
      options?.onSnooze?.(logId, minutes);
      clearActiveReminder();
      return true;
    }

    // Check for skip commands
    if (langCommands.skip.some(cmd => lower.includes(cmd))) {
      setLastCommand({ text: transcriptText, recognized: true, command: 'skip' });
      speak(langCommands.responses.skip);
      options?.onSkip?.(logId);
      clearActiveReminder();
      return true;
    }

    // Check for help commands
    if (langCommands.help.some(cmd => lower.includes(cmd))) {
      setLastCommand({ text: transcriptText, recognized: true, command: 'help' });
      speak(langCommands.responses.help);
      options?.onHelp?.();
      return true;
    }

    // Check for cancel commands
    if (langCommands.cancel.some(cmd => lower.includes(cmd))) {
      setLastCommand({ text: transcriptText, recognized: true, command: 'cancel' });
      window.speechSynthesis.cancel();
      options?.onCancel?.();
      clearActiveReminder();
      return true;
    }

    setLastCommand({ text: transcriptText, recognized: false });
    return false;
  }, [speak, options, clearActiveReminder, getLanguageCommands]);

  const startListening = useCallback((logId: string) => {
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      console.log('Speech recognition not supported');
      return;
    }

    stopListening(); // Stop any existing recognition
    setError(null);
    setTranscript('');
    setConfidence(0);

    const settings = getVoiceSettings();
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.voiceLanguage;

    recognition.onstart = () => {
      setIsListening(true);
      setActiveLogId(logId);
      console.log('Voice recognition started');
    };

    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      const transcriptText = result[0].transcript;
      const conf = result[0].confidence;
      
      // Show interim results
      setTranscript(transcriptText);
      setConfidence(conf);
      
      if (result.isFinal) {
        processVoiceCommand(transcriptText, logId, conf);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        // Try to restart on error
        setTimeout(() => {
          if (activeReminderRef.current === logId) {
            try {
              recognition.start();
            } catch (e) {
              console.log('Could not restart recognition');
            }
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      // Restart if still active
      if (activeReminderRef.current === logId) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.log('Could not restart recognition');
          }
        }, 500);
      } else {
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
      setError('Could not start voice recognition');
    }
  }, [stopListening, processVoiceCommand]);

  const triggerReminder = useCallback((log: MedicationLog) => {
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

    // Set up repeat reminders based on settings
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
    }
    
    const repeatMs = settings.repeatInterval * 60 * 1000;
    
    repeatIntervalRef.current = setInterval(() => {
      if (activeReminderRef.current === log.id) {
        const currentSettings = getVoiceSettings();
        const currentLangCommands = LANGUAGE_COMMANDS[currentSettings.voiceLanguage] || LANGUAGE_COMMANDS['en-US'];
        
        // Re-check quiet hours before repeating
        if (isInQuietHours(currentSettings)) {
          console.log('Entered quiet hours, stopping repeats');
          return;
        }
        console.log('Repeating reminder for:', medName);
        speak(currentLangCommands.responses.repeatReminder(medName), () => {
          startListening(log.id);
        });
      } else {
        if (repeatIntervalRef.current) {
          clearInterval(repeatIntervalRef.current);
          repeatIntervalRef.current = null;
        }
      }
    }, repeatMs);
  }, [speak, startListening, onReminderTriggered]);

  // Schedule reminders at exact times
  const scheduleReminder = useCallback((log: MedicationLog, targetTime: Date) => {
    const now = new Date();
    const delay = targetTime.getTime() - now.getTime();
    
    if (delay <= 0) return; // Time already passed

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
    
    // Also check on mount
    const settings = getVoiceSettings();
    setVoiceEnabled(settings.voiceRemindersEnabled);
    setLanguage(settings.voiceLanguage);
    
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Check and schedule reminders
  useEffect(() => {
    const settings = getVoiceSettings();
    if (!settings.voiceRemindersEnabled) return;

    const now = new Date();

    logs.forEach(log => {
      if (log.status !== 'pending' && log.status !== 'snoozed') return;
      if (activeReminderRef.current === log.id) return; // Already active

      let targetTime: Date | null = null;

      if (log.status === 'pending') {
        // Parse scheduled time
        const [hours, minutes] = log.scheduled_time.split(':').map(Number);
        targetTime = new Date();
        targetTime.setHours(hours, minutes, 0, 0);
        
        // If time has passed, trigger immediately
        if (now >= targetTime) {
          const timeDiff = now.getTime() - targetTime.getTime();
          // Only trigger if within the last 5 minutes
          if (timeDiff < 5 * 60 * 1000) {
            triggerReminder(log);
          }
          return;
        }
      } else if (log.status === 'snoozed' && log.snoozed_until) {
        targetTime = new Date(log.snoozed_until);
        
        // If snooze time has passed, trigger immediately
        if (now >= targetTime) {
          triggerReminder(log);
          return;
        }
      }

      if (targetTime) {
        scheduleReminder(log, targetTime);
      }
    });

    // Cleanup function
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
      // Some browsers need this event
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    return () => {
      if (repeatIntervalRef.current) {
        clearInterval(repeatIntervalRef.current);
      }
      stopListening();
    };
  }, [stopListening]);

  const speakNow = useCallback((text: string) => {
    speak(text);
  }, [speak]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => {
      const newValue = !prev;
      // Also update localStorage
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

  // Test voice function
  const testVoice = useCallback(() => {
    const langCommands = getLanguageCommands();
    speak(langCommands.responses.help);
  }, [speak, getLanguageCommands]);

  // Get available languages
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
  };
}
