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

export function useVoiceReminder(
  logs: MedicationLog[],
  onReminderTriggered?: (log: MedicationLog) => void,
  options?: VoiceReminderOptions
) {
  const spokenLogsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const processVoiceCommand = useCallback((transcript: string, logId: string) => {
    const lower = transcript.toLowerCase().trim();
    console.log('Processing voice command:', lower);

    // Check for "taken" command
    if (lower.includes('taken') || lower.includes('take') || lower.includes('done') || lower.includes('yes')) {
      speak('Marking as taken. Great job!');
      options?.onTaken?.(logId);
      stopListening();
      setActiveLogId(null);
      // Clear repeat interval
      if (repeatIntervalRef.current) {
        clearInterval(repeatIntervalRef.current);
        repeatIntervalRef.current = null;
      }
      return true;
    }

    // Check for snooze commands
    const snoozeMatch = lower.match(/snooze(?:\s+for)?\s*(\d+)?\s*(?:minutes?|mins?)?/);
    if (lower.includes('snooze') || lower.includes('later') || lower.includes('wait')) {
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
      stopListening();
      setActiveLogId(null);
      // Clear repeat interval
      if (repeatIntervalRef.current) {
        clearInterval(repeatIntervalRef.current);
        repeatIntervalRef.current = null;
      }
      return true;
    }

    return false;
  }, [speak, options, stopListening]);

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
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Restart if still active
      if (activeLogId === logId && isListening) {
        try {
          recognition.start();
        } catch (e) {
          console.log('Could not restart recognition');
        }
      }
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (e) {
      console.error('Could not start speech recognition:', e);
    }
  }, [stopListening, processVoiceCommand, activeLogId, isListening]);

  const triggerReminder = useCallback((log: MedicationLog) => {
    const medName = log.medications?.name || 'your medication';
    const message = `It's time to take ${medName}. Please say taken, or snooze.`;
    
    speak(message, () => {
      // Start listening after speaking
      startListening(log.id);
    });
    
    onReminderTriggered?.(log);
  }, [speak, startListening, onReminderTriggered]);

  const checkReminders = useCallback(() => {
    if (!voiceEnabled) return;

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
        spokenLogsRef.current.add(logKey);
        triggerReminder(log);

        // Set up repeat reminders every 60 seconds
        repeatIntervalRef.current = setInterval(() => {
          if (spokenLogsRef.current.has(logKey)) {
            triggerReminder(log);
          }
        }, 60000);

        // Allow re-reminder after 2 minutes if not handled
        setTimeout(() => {
          spokenLogsRef.current.delete(logKey);
        }, 120000);
      }
    });
  }, [logs, voiceEnabled, triggerReminder]);

  useEffect(() => {
    // Load voices
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }

    // Check immediately
    checkReminders();

    // Then check every 15 seconds for more precise timing
    intervalRef.current = setInterval(checkReminders, 15000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (repeatIntervalRef.current) {
        clearInterval(repeatIntervalRef.current);
      }
      stopListening();
    };
  }, [checkReminders, stopListening]);

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
    stopListening
  };
}
