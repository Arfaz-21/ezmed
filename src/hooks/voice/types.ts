import { MedicationLog } from '../useMedications';

// Web Speech API type declarations
export interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

export interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

export interface ISpeechRecognition extends EventTarget {
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

export interface VoiceReminderOptions {
  onAction?: (actionType: ActionType, logId: string, snoozeMinutes?: number) => void;
  onError?: (error: string) => void;
}

export interface VoiceSettings {
  voiceRemindersEnabled: boolean;
  voiceVolume: number;
  repeatInterval: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  voiceLanguage: string;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceRemindersEnabled: true,
  voiceVolume: 100,
  repeatInterval: 1,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  voiceLanguage: 'en-US',
};

export interface RecognitionState {
  transcript: string;
  confidence: number;
  lastCommand: { text: string; recognized: boolean; command?: string } | null;
  error: string | null;
  isListening: boolean;
}

export const INITIAL_RECOGNITION_STATE: RecognitionState = {
  transcript: '',
  confidence: 0,
  lastCommand: null,
  error: null,
  isListening: false,
};

export type RecognitionAction =
  | { type: 'START_LISTENING' }
  | { type: 'STOP_LISTENING' }
  | { type: 'SET_TRANSCRIPT'; transcript: string; confidence: number }
  | { type: 'SET_COMMAND'; lastCommand: RecognitionState['lastCommand'] }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'RESET' };

export function recognitionReducer(state: RecognitionState, action: RecognitionAction): RecognitionState {
  switch (action.type) {
    case 'START_LISTENING':
      return { ...state, isListening: true, error: null, transcript: '', confidence: 0 };
    case 'STOP_LISTENING':
      return { ...state, isListening: false, transcript: '', confidence: 0 };
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.transcript, confidence: action.confidence };
    case 'SET_COMMAND':
      return { ...state, lastCommand: action.lastCommand };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'RESET':
      return INITIAL_RECOGNITION_STATE;
    default:
      return state;
  }
}

// Multi-language command patterns
export const LANGUAGE_COMMANDS: Record<string, {
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

// Helper to check if we're in quiet hours
export const isInQuietHours = (settings: VoiceSettings): boolean => {
  if (!settings.quietHoursEnabled) return false;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const [startHour, startMin] = settings.quietHoursStart.split(':').map(Number);
  const [endHour, endMin] = settings.quietHoursEnd.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
};

// Helper to get settings from localStorage
export const getVoiceSettings = (): VoiceSettings => {
  try {
    const saved = localStorage.getItem('ezmed-settings');
    return saved ? { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_VOICE_SETTINGS;
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
};
