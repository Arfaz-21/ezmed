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
}

interface VoiceSettings {
  voiceRemindersEnabled: boolean;
  voiceVolume: number;
  repeatInterval: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceRemindersEnabled: true,
  voiceVolume: 80,
  repeatInterval: 1,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
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
    const saved = localStorage.getItem('medease-settings');
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
  const [lastCommand, setLastCommand] = useState<{ text: string; recognized: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check browser support
  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) &&
    'speechSynthesis' in window;

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
    utterance.lang = 'en-US';

    // Try to use a clear, friendly voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
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
  }, []);

  const clearActiveReminder = useCallback(() => {
    activeReminderRef.current = null;
    setActiveLogId(null);
    setTranscript('');
    setLastCommand(null);
    stopListening();
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, [stopListening]);

  const processVoiceCommand = useCallback((transcriptText: string, logId: string): boolean => {
    const lower = transcriptText.toLowerCase().trim();
    console.log('Processing voice command:', lower);

    // Check for "taken" command - expanded keywords
    if (
      lower.includes('taken') || 
      lower.includes('take') || 
      lower.includes('took') ||
      lower.includes('i took it') ||
      lower.includes('done') || 
      lower.includes('yes') ||
      lower.includes('okay') ||
      lower.includes('ok')
    ) {
      setLastCommand({ text: transcriptText, recognized: true });
      speak('Marking as taken. Great job!');
      options?.onTaken?.(logId);
      clearActiveReminder();
      return true;
    }

    // Check for snooze commands
    const snoozeMatch = lower.match(/snooze(?:\s+for)?\s*(\d+)?\s*(?:minutes?|mins?)?/);
    if (lower.includes('snooze') || lower.includes('later') || lower.includes('wait') || lower.includes('remind me')) {
      let minutes = 5; // default
      if (snoozeMatch && snoozeMatch[1]) {
        minutes = parseInt(snoozeMatch[1], 10);
      } else if (lower.includes('10')) {
        minutes = 10;
      } else if (lower.includes('15')) {
        minutes = 15;
      }
      
      setLastCommand({ text: transcriptText, recognized: true });
      speak(`Snoozing for ${minutes} minutes.`);
      options?.onSnooze?.(logId, minutes);
      clearActiveReminder();
      return true;
    }

    setLastCommand({ text: transcriptText, recognized: false });
    return false;
  }, [speak, options, clearActiveReminder]);

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

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setActiveLogId(logId);
      console.log('Voice recognition started');
    };

    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      const transcriptText = result[0].transcript;
      
      // Show interim results
      setTranscript(transcriptText);
      
      if (result.isFinal) {
        processVoiceCommand(transcriptText, logId);
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
    
    // Check quiet hours
    if (isInQuietHours(settings)) {
      console.log('In quiet hours, skipping reminder');
      return;
    }
    
    activeReminderRef.current = log.id;
    const medName = log.medications?.name || 'your medication';
    const message = `It's time to take ${medName}. Please say taken, or snooze.`;
    
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
        // Re-check quiet hours before repeating
        if (isInQuietHours(getVoiceSettings())) {
          console.log('Entered quiet hours, stopping repeats');
          return;
        }
        console.log('Repeating reminder for:', medName);
        speak(`Reminder: Please take ${medName}. Say taken, or snooze.`, () => {
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

  // Sync voiceEnabled state with settings
  useEffect(() => {
    const handleStorageChange = () => {
      const settings = getVoiceSettings();
      setVoiceEnabled(settings.voiceRemindersEnabled);
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also check on mount
    const settings = getVoiceSettings();
    setVoiceEnabled(settings.voiceRemindersEnabled);
    
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
        const saved = localStorage.getItem('medease-settings');
        const settings = saved ? JSON.parse(saved) : {};
        settings.voiceRemindersEnabled = newValue;
        localStorage.setItem('medease-settings', JSON.stringify(settings));
      } catch (e) {
        console.error('Could not save voice setting', e);
      }
      return newValue;
    });
  }, []);

  // Test voice function
  const testVoice = useCallback(() => {
    speak('Voice reminders are working correctly. Say taken or snooze to respond.');
  }, [speak]);

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
    isSupported,
    testVoice,
  };
}
