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

// Store scheduled reminders to trigger at exact times
const scheduledReminders = new Map<string, ReturnType<typeof setTimeout>>();

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
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85; // Slower for elderly
      utterance.pitch = 1;
      utterance.volume = 1;
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
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const clearActiveReminder = useCallback(() => {
    activeReminderRef.current = null;
    setActiveLogId(null);
    stopListening();
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }, [stopListening]);

  const processVoiceCommand = useCallback((transcript: string, logId: string) => {
    const lower = transcript.toLowerCase().trim();
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
      
      speak(`Snoozing for ${minutes} minutes.`);
      options?.onSnooze?.(logId, minutes);
      clearActiveReminder();
      return true;
    }

    return false;
  }, [speak, options, clearActiveReminder]);

  const startListening = useCallback((logId: string) => {
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log('Speech recognition not supported');
      return;
    }

    stopListening(); // Stop any existing recognition

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
      const transcript = event.results[last][0].transcript;
      
      if (event.results[last].isFinal) {
        processVoiceCommand(transcript, logId);
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
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
      }
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (e) {
      console.error('Could not start speech recognition:', e);
    }
  }, [stopListening, processVoiceCommand]);

  const triggerReminder = useCallback((log: MedicationLog) => {
    // Don't re-trigger if already active for this log
    if (activeReminderRef.current === log.id) return;
    
    activeReminderRef.current = log.id;
    const medName = log.medications?.name || 'your medication';
    const message = `It's time to take ${medName}. Please say taken, or snooze.`;
    
    console.log('Triggering voice reminder for:', medName);
    
    speak(message, () => {
      // Start listening after speaking
      startListening(log.id);
    });
    
    onReminderTriggered?.(log);

    // Set up repeat reminders every 60 seconds until responded
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
    }
    
    repeatIntervalRef.current = setInterval(() => {
      if (activeReminderRef.current === log.id) {
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
    }, 60000);
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
      if (voiceEnabled) {
        triggerReminder(log);
      }
      scheduledReminders.delete(key);
    }, delay);
    
    scheduledReminders.set(key, timeout);
  }, [triggerReminder, voiceEnabled]);

  // Check and schedule reminders
  useEffect(() => {
    if (!voiceEnabled) return;

    const now = new Date();
    const today = now.toISOString().split('T')[0];

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
      scheduledReminders.forEach((timeout, key) => {
        clearTimeout(timeout);
      });
      scheduledReminders.clear();
    };
  }, [logs, voiceEnabled, triggerReminder, scheduleReminder]);

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
    setVoiceEnabled(prev => !prev);
  }, []);

  return { 
    speakNow, 
    isListening, 
    activeLogId, 
    voiceEnabled, 
    toggleVoice,
    startListening,
    stopListening,
    clearActiveReminder
  };
}
