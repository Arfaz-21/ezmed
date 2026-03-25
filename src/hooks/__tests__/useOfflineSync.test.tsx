import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOfflineSync } from '../useOfflineSync';

describe('useOfflineSync', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts online', () => {
    const onSync = vi.fn();
    const { result } = renderHook(() => useOfflineSync(onSync));
    expect(result.current.isOnline).toBe(true);
  });

  it('queues actions via addPendingAction', () => {
    const onSync = vi.fn();
    const { result } = renderHook(() => useOfflineSync(onSync));

    act(() => {
      result.current.addPendingAction({ type: 'taken', logId: 'log-1' });
    });

    expect(result.current.pendingActions).toHaveLength(1);
    expect(result.current.pendingActions[0].logId).toBe('log-1');
  });

  it('persists pending actions to localStorage', () => {
    const onSync = vi.fn();
    const { result } = renderHook(() => useOfflineSync(onSync));

    act(() => {
      result.current.addPendingAction({ type: 'taken', logId: 'log-2' });
    });

    const stored = JSON.parse(localStorage.getItem('ezmed_pending_actions') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].logId).toBe('log-2');
  });

  it('stores snooze timer for snoozed actions', () => {
    const onSync = vi.fn();
    const onSnoozeExpire = vi.fn();
    const { result } = renderHook(() => useOfflineSync(onSync, onSnoozeExpire));

    act(() => {
      result.current.addPendingAction({ type: 'snoozed', logId: 'log-3', snoozeMinutes: 5 });
    });

    const snoozes = JSON.parse(localStorage.getItem('ezmed_pending_snoozes') || '[]');
    expect(snoozes).toHaveLength(1);
    expect(snoozes[0].logId).toBe('log-3');
  });

  it('calls onSnoozeExpire when snooze timer fires', () => {
    const onSync = vi.fn();
    const onSnoozeExpire = vi.fn();
    const { result } = renderHook(() => useOfflineSync(onSync, onSnoozeExpire));

    act(() => {
      result.current.addPendingAction({ type: 'snoozed', logId: 'log-4', snoozeMinutes: 1 });
    });

    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });

    expect(onSnoozeExpire).toHaveBeenCalledWith('log-4');
  });

  it('clears snooze timer via clearSnoozeTimer', () => {
    const onSync = vi.fn();
    const onSnoozeExpire = vi.fn();
    const { result } = renderHook(() => useOfflineSync(onSync, onSnoozeExpire));

    act(() => {
      result.current.addPendingAction({ type: 'snoozed', logId: 'log-5', snoozeMinutes: 1 });
    });

    act(() => {
      result.current.clearSnoozeTimer('log-5');
    });

    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });

    expect(onSnoozeExpire).not.toHaveBeenCalled();
  });
});
