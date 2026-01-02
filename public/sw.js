// MedEase Service Worker for Push Notifications

const CACHE_NAME = 'medease-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);
  
  let notificationData = {
    title: 'Medication Reminder',
    body: 'It\'s time to take your medication',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'medication-reminder',
    requireInteraction: true,
    actions: [
      { action: 'taken', title: '✓ Taken' },
      { action: 'snooze', title: '⏰ Snooze' }
    ]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      actions: notificationData.actions,
      data: notificationData.data || {}
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          // Send message to the client
          client.postMessage({
            type: 'NOTIFICATION_ACTION',
            action: action || 'open',
            logId: data?.logId
          });
          return;
        }
      }
      
      // Open a new window if none exists
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'medication-sync') {
    event.waitUntil(syncMedicationActions());
  }
});

async function syncMedicationActions() {
  // Get pending actions from IndexedDB
  const pendingActions = await getPendingActions();
  
  for (const action of pendingActions) {
    try {
      // Send to server
      await fetch('/api/medication-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action)
      });
      
      // Remove from pending
      await removePendingAction(action.id);
    } catch (error) {
      console.error('Failed to sync action:', error);
    }
  }
}

// Placeholder functions for IndexedDB operations
async function getPendingActions() {
  return [];
}

async function removePendingAction(id) {
  console.log('Removed pending action:', id);
}
