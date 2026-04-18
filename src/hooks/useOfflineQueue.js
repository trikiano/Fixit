import { useState, useEffect, useCallback } from 'react';
import { fixit } from '@/api/fixitClient';

const QUEUE_KEY = 'pos_offline_queue';

function loadQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState(loadQueue);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null); // null | { synced: n, failed: n }

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

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && queue.length > 0) {
      syncQueue();
    }
  }, [isOnline]);

  const enqueue = useCallback((salePayload) => {
    const item = { ...salePayload, _queued_at: new Date().toISOString(), _id: Date.now() };
    setQueue(prev => {
      const next = [...prev, item];
      saveQueue(next);
      return next;
    });
  }, []);

  const syncQueue = useCallback(async () => {
    const current = loadQueue();
    if (current.length === 0 || syncing) return;
    setSyncing(true);
    let synced = 0;
    let failed = 0;
    const remaining = [];

    for (const item of current) {
      try {
        const { _queued_at, _id, _stock_updates, ...saleData } = item;
        // Create the sale
        await fixit.entities.Sale.create(saleData);
        // Apply stock updates if any
        if (_stock_updates) {
          for (const upd of _stock_updates) {
            await fixit.entities.Product.update(upd.id, { quantity: upd.newQty });
            await fixit.entities.StockMovement.create(upd.movement);
          }
        }
        synced++;
      } catch {
        failed++;
        remaining.push(item);
      }
    }

    saveQueue(remaining);
    setQueue(remaining);
    setSyncing(false);
    if (synced > 0 || failed > 0) {
      setLastSyncResult({ synced, failed });
      setTimeout(() => setLastSyncResult(null), 5000);
    }
  }, [syncing]);

  return { isOnline, queue, enqueue, syncQueue, syncing, lastSyncResult };
}