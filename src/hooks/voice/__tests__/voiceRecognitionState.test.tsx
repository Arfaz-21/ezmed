import { describe, it, expect } from 'vitest';
import {
  recognitionReducer,
  INITIAL_RECOGNITION_STATE,
} from '../../voice/types';

describe('recognitionReducer', () => {
  it('transitions to listening on START_LISTENING', () => {
    const state = recognitionReducer(INITIAL_RECOGNITION_STATE, { type: 'START_LISTENING' });
    expect(state.isListening).toBe(true);
    expect(state.error).toBeNull();
    expect(state.transcript).toBe('');
  });

  it('transitions to idle on STOP_LISTENING', () => {
    const listening = { ...INITIAL_RECOGNITION_STATE, isListening: true, transcript: 'hello' };
    const state = recognitionReducer(listening, { type: 'STOP_LISTENING' });
    expect(state.isListening).toBe(false);
    expect(state.transcript).toBe('');
  });

  it('updates transcript and confidence', () => {
    const state = recognitionReducer(
      { ...INITIAL_RECOGNITION_STATE, isListening: true },
      { type: 'SET_TRANSCRIPT', transcript: 'taken', confidence: 0.95 }
    );
    expect(state.transcript).toBe('taken');
    expect(state.confidence).toBe(0.95);
  });

  it('stores last command', () => {
    const cmd = { text: 'taken', recognized: true, command: 'taken' };
    const state = recognitionReducer(INITIAL_RECOGNITION_STATE, { type: 'SET_COMMAND', lastCommand: cmd });
    expect(state.lastCommand).toEqual(cmd);
  });

  it('stores error', () => {
    const state = recognitionReducer(INITIAL_RECOGNITION_STATE, { type: 'SET_ERROR', error: 'mic denied' });
    expect(state.error).toBe('mic denied');
  });

  it('resets to initial state', () => {
    const modified = {
      isListening: true,
      transcript: 'hello',
      confidence: 0.9,
      lastCommand: { text: 'hi', recognized: false },
      error: 'some error',
    };
    const state = recognitionReducer(modified, { type: 'RESET' });
    expect(state).toEqual(INITIAL_RECOGNITION_STATE);
  });
});
