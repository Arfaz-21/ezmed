import { useState, useEffect, useCallback } from 'react';

interface PendingAction {
  id: string;
  type: 'taken' | 'snoozed';
  logId: string;
  timestamp: string;
  snoozeMinutes?: number;
}

const STORAGE_KEY = 'medease_pending_actions';

export function useOfflineSync(onSync: (action: PendingAction) => Promise<void>) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);

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
    setPendingActions(prev => [...prev, newAction]);
    return newAction;
  }, []);

  return {
    isOnline,
    pendingActions,
    addPendingAction
  };
}
