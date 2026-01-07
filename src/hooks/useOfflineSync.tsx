import { useState, useEffect, useCallback, useRef } from 'react';

interface PendingAction {
  id: string;
  type: 'taken' | 'snoozed';
  logId: string;
  timestamp: string;
  snoozeMinutes?: number;
  snoozeUntil?: string; // Exact time when snooze ends
}

interface PendingSnooze {
  logId: string;
  snoozeUntil: string;
  medicationName?: string;
}

const STORAGE_KEY = 'ezmed_pending_actions';
const SNOOZE_STORAGE_KEY = 'ezmed_pending_snoozes';

export function useOfflineSync(
  onSync: (action: PendingAction) => Promise<void>,
  onSnoozeExpire?: (logId: string) => void
) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const snoozeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Load pending actions from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setPendingActions(JSON.parse(stored));
    }
  }, []);

  // Save pending actions to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingActions));
  }, [pendingActions]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync when back online
  useEffect(() => {
    if (isOnline && pendingActions.length > 0) {
      syncPendingActions();
    }
  }, [isOnline]);

  // Check for expired snoozes on mount and set timers
  useEffect(() => {
    const stored = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!stored) return;

    const snoozes: PendingSnooze[] = JSON.parse(stored);
    const now = new Date();

    snoozes.forEach(snooze => {
      const snoozeEnd = new Date(snooze.snoozeUntil);
      const delay = snoozeEnd.getTime() - now.getTime();

      if (delay <= 0) {
        // Snooze already expired
        onSnoozeExpire?.(snooze.logId);
        removeSnooze(snooze.logId);
      } else {
        // Set timer for snooze expiry
        const timer = setTimeout(() => {
          onSnoozeExpire?.(snooze.logId);
          removeSnooze(snooze.logId);
        }, delay);
        snoozeTimersRef.current.set(snooze.logId, timer);
      }
    });

    return () => {
      snoozeTimersRef.current.forEach(timer => clearTimeout(timer));
      snoozeTimersRef.current.clear();
    };
  }, [onSnoozeExpire]);

  const removeSnooze = (logId: string) => {
    const stored = localStorage.getItem(SNOOZE_STORAGE_KEY);
    if (!stored) return;

    const snoozes: PendingSnooze[] = JSON.parse(stored);
    const filtered = snoozes.filter(s => s.logId !== logId);
    localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(filtered));
  };

  const syncPendingActions = async () => {
    const actions = [...pendingActions];
    
    for (const action of actions) {
      try {
        await onSync(action);
        setPendingActions(prev => prev.filter(a => a.id !== action.id));
      } catch (error) {
        console.error('Failed to sync action:', error);
      }
    }
  };

  const addPendingAction = useCallback((action: Omit<PendingAction, 'id' | 'timestamp'>) => {
    const newAction: PendingAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    // If it's a snooze, calculate exact end time and store it
    if (action.type === 'snoozed' && action.snoozeMinutes) {
      const snoozeUntil = new Date(Date.now() + action.snoozeMinutes * 60 * 1000).toISOString();
      newAction.snoozeUntil = snoozeUntil;

      // Store snooze for offline tracking
      const stored = localStorage.getItem(SNOOZE_STORAGE_KEY);
      const snoozes: PendingSnooze[] = stored ? JSON.parse(stored) : [];
      snoozes.push({ logId: action.logId, snoozeUntil });
      localStorage.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(snoozes));

      // Set timer for snooze expiry
      const delay = action.snoozeMinutes * 60 * 1000;
      const timer = setTimeout(() => {
        onSnoozeExpire?.(action.logId);
        removeSnooze(action.logId);
      }, delay);
      snoozeTimersRef.current.set(action.logId, timer);
    }

    setPendingActions(prev => [...prev, newAction]);
    return newAction;
  }, [onSnoozeExpire]);

  const clearSnoozeTimer = useCallback((logId: string) => {
    const timer = snoozeTimersRef.current.get(logId);
    if (timer) {
      clearTimeout(timer);
      snoozeTimersRef.current.delete(logId);
    }
    removeSnooze(logId);
  }, []);

  return {
    isOnline,
    pendingActions,
    addPendingAction,
    clearSnoozeTimer
  };
}
