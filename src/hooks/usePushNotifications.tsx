import { useState, useEffect, useCallback, useRef } from 'react';
import { MedicationLog } from './useMedications';

// Track scheduled notifications to prevent duplicates and allow clearing
const scheduledNotifications = new Map<string, ReturnType<typeof setTimeout>>();

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const hasRequestedPermission = useRef(false);

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', reg);
      setRegistration(reg);
      
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('Message from SW:', event.data);
        if (event.data.type === 'NOTIFICATION_ACTION') {
          window.dispatchEvent(new CustomEvent('medication-action', {
            detail: event.data
          }));
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  };

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;
    
    // Prevent multiple permission requests
    if (hasRequestedPermission.current && permission !== 'default') {
      return permission === 'granted';
    }
    
    hasRequestedPermission.current = true;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported, permission]);

  const showNotification = useCallback(async (log: MedicationLog) => {
    if (permission !== 'granted') {
      console.log('Cannot show notification: permission not granted');
      return;
    }

    const medName = log.medications?.name || 'your medication';
    
    try {
      // Use registration if available, otherwise use Notification API directly
      if (registration) {
        await registration.showNotification(`Time for ${medName}`, {
          body: `${log.medications?.dosage || ''} - Tap to respond`,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: `med-${log.id}`,
          requireInteraction: true,
          data: { logId: log.id }
        });
      } else {
        // Fallback to basic Notification
        new Notification(`Time for ${medName}`, {
          body: `${log.medications?.dosage || ''} - Tap to respond`,
          icon: '/favicon.ico',
          tag: `med-${log.id}`,
          requireInteraction: true
        });
      }
      console.log('Notification shown for:', medName);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [permission, registration]);

  // Clear scheduled notification for a specific log
  const clearScheduledNotification = useCallback((logId: string) => {
    if (scheduledNotifications.has(logId)) {
      clearTimeout(scheduledNotifications.get(logId)!);
      scheduledNotifications.delete(logId);
      console.log('Cleared scheduled notification for:', logId);
    }
  }, []);

  // Schedule notification at exact LOCAL time
  const scheduleNotification = useCallback((log: MedicationLog) => {
    if (permission !== 'granted') return;
    
    // Don't schedule for non-pending logs
    if (log.status !== 'pending') {
      clearScheduledNotification(log.id);
      return;
    }

    const now = new Date();
    const [hours, minutes] = log.scheduled_time.split(':').map(Number);
    
    // Use LOCAL time
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);
    
    // If the time has passed today, don't schedule
    if (scheduledTime <= now) {
      console.log('Scheduled time already passed for:', log.medications?.name);
      return;
    }
    
    const delay = scheduledTime.getTime() - now.getTime();
    
    // Clear any existing scheduled notification for this log
    clearScheduledNotification(log.id);
    
    console.log(`Scheduling notification for ${log.medications?.name} at ${scheduledTime.toLocaleTimeString()} (in ${Math.round(delay / 60000)} minutes)`);
    
    const timeoutId = setTimeout(() => {
      // Double-check the log is still pending before showing
      showNotification(log);
      scheduledNotifications.delete(log.id);
    }, delay);
    
    scheduledNotifications.set(log.id, timeoutId);
  }, [permission, showNotification, clearScheduledNotification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      scheduledNotifications.forEach((timeout) => clearTimeout(timeout));
      scheduledNotifications.clear();
    };
  }, []);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    scheduleNotification,
    clearScheduledNotification
  };
}
