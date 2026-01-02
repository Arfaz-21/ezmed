import { useState, useEffect, useCallback } from 'react';
import { MedicationLog } from './useMedications';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      
      // Register service worker
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', reg);
      setRegistration(reg);
      
      // Listen for messages from service worker
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
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported]);

  const showNotification = useCallback(async (log: MedicationLog) => {
    if (permission !== 'granted' || !registration) {
      console.log('Cannot show notification:', { permission, hasRegistration: !!registration });
      return;
    }

    const medName = log.medications?.name || 'your medication';
    
    try {
      await registration.showNotification(`Time for ${medName}`, {
        body: `${log.medications?.dosage || ''} - Tap to respond`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `med-${log.id}`,
        requireInteraction: true,
        data: { logId: log.id }
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }, [permission, registration]);

  const scheduleNotification = useCallback((log: MedicationLog) => {
    if (permission !== 'granted') return;

    const now = new Date();
    const [hours, minutes] = log.scheduled_time.split(':').map(Number);
    
    const scheduledTime = new Date();
    scheduledTime.setHours(hours, minutes, 0, 0);
    
    // If the time has passed today, don't schedule
    if (scheduledTime <= now) return;
    
    const delay = scheduledTime.getTime() - now.getTime();
    
    console.log(`Scheduling notification for ${log.medications?.name} in ${Math.round(delay / 60000)} minutes`);
    
    setTimeout(() => {
      showNotification(log);
    }, delay);
  }, [permission, showNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    scheduleNotification
  };
}
