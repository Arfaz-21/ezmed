import { useReducer, useRef, useCallback } from 'react';
import {
  ISpeechRecognition,
  ActionType,
  VoiceReminderOptions,
  RecognitionState,
  INITIAL_RECOGNITION_STATE,
  recognitionReducer,
  LANGUAGE_COMMANDS,
  getVoiceSettings,
} from './types';

export function useVoiceRecognition(options?: VoiceReminderOptions) {
  const [state, dispatch] = useReducer(recognitionReducer, INITIAL_RECOGNITION_STATE);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isStoppedRef = useRef(false);
  const activeLogIdRef = useRef<string | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) &&
    'speechSynthesis' in window;

  const getLanguageCommands = useCallback(() => {
    const settings = getVoiceSettings();
    return LANGUAGE_COMMANDS[settings.voiceLanguage] || LANGUAGE_COMMANDS['en-US'];
  }, []);

  const parseVoiceCommand = useCallback((transcriptText: string): { action: ActionType | null; snoozeMinutes?: number } => {
    const lower = transcriptText.toLowerCase().trim();
    const langCommands = getLanguageCommands();

    if (langCommands.taken.some(cmd => lower.includes(cmd))) {
      return { action: 'taken' };
    }
    if (langCommands.snooze.some(cmd => lower.includes(cmd))) {
      let minutes = 10;
      const snoozeMatch = lower.match(/(\d+)/);
      if (snoozeMatch?.[1]) {
        const parsed = parseInt(snoozeMatch[1], 10);
        if (parsed >= 1 && parsed <= 60) minutes = parsed;
      }
      return { action: 'snooze', snoozeMinutes: minutes };
    }
    if (langCommands.help.some(cmd => lower.includes(cmd))) {
      return { action: 'help' };
    }
    if (langCommands.cancel.some(cmd => lower.includes(cmd))) {
      return { action: 'cancel' };
    }
    return { action: null };
  }, [getLanguageCommands]);

  const stopListening = useCallback(() => {
    isStoppedRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    activeLogIdRef.current = null;
    dispatch({ type: 'STOP_LISTENING' });
  }, []);

  const startListening = useCallback((
    logId: string,
    onCommand: (action: ActionType, logId: string, snoozeMinutes?: number) => void,
    logStatus?: string,
  ) => {
    if (logStatus && logStatus !== 'pending' && logStatus !== 'snoozed') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      dispatch({ type: 'SET_ERROR', error: 'Speech recognition not supported in this browser' });
      options?.onError?.('Speech recognition not supported in this browser');
      return;
    }

    // Stop existing
    isStoppedRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    isStoppedRef.current = false;
    dispatch({ type: 'RESET' });

    const settings = getVoiceSettings();
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = settings.voiceLanguage;

    recognition.onstart = () => {
      activeLogIdRef.current = logId;
      dispatch({ type: 'START_LISTENING' });
    };

    recognition.onresult = (event) => {
      if (isStoppedRef.current) return;
      const last = event.results.length - 1;
      const result = event.results[last];
      const text = result[0].transcript;
      const conf = result[0].confidence;

      dispatch({ type: 'SET_TRANSCRIPT', transcript: text, confidence: conf });

      if (result.isFinal) {
        const normalized = text.toLowerCase().trim();
        const { action, snoozeMinutes } = parseVoiceCommand(normalized);
        const langCommands = getLanguageCommands();

        if (action) {
          dispatch({ type: 'SET_COMMAND', lastCommand: { text, recognized: true, command: action } });
          onCommand(action, logId, snoozeMinutes);
        } else {
          dispatch({ type: 'SET_COMMAND', lastCommand: { text, recognized: false } });
          dispatch({ type: 'SET_ERROR', error: langCommands.responses.notUnderstood });
          options?.onError?.(langCommands.responses.notUnderstood);
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        dispatch({ type: 'SET_ERROR', error: 'Microphone access denied. Please allow microphone access.' });
        dispatch({ type: 'STOP_LISTENING' });
        options?.onError?.('Microphone access denied.');
      } else if (event.error === 'no-speech') {
        if (!isStoppedRef.current && activeLogIdRef.current === logId) {
          setTimeout(() => {
            if (!isStoppedRef.current && activeLogIdRef.current === logId) {
              try { recognition.start(); } catch { dispatch({ type: 'STOP_LISTENING' }); }
            }
          }, 500);
        }
      } else if (event.error === 'aborted') {
        dispatch({ type: 'STOP_LISTENING' });
      } else {
        if (!isStoppedRef.current && activeLogIdRef.current === logId) {
          setTimeout(() => {
            if (!isStoppedRef.current && activeLogIdRef.current === logId) {
              try { recognition.start(); } catch { dispatch({ type: 'STOP_LISTENING' }); }
            }
          }, 1000);
        }
      }
    };

    recognition.onend = () => {
      if (!isStoppedRef.current && activeLogIdRef.current === logId) {
        setTimeout(() => {
          if (!isStoppedRef.current && activeLogIdRef.current === logId) {
            try { recognition.start(); } catch { dispatch({ type: 'STOP_LISTENING' }); }
          }
        }, 500);
      } else {
        dispatch({ type: 'STOP_LISTENING' });
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      dispatch({ type: 'SET_ERROR', error: 'Could not start voice recognition' });
      options?.onError?.('Could not start voice recognition');
    }
  }, [parseVoiceCommand, getLanguageCommands, options]);

  return {
    state,
    startListening,
    stopListening,
    parseVoiceCommand,
    isSupported,
    activeLogId: activeLogIdRef.current,
  };
}
