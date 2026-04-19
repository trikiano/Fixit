/**
 * Global Offline Manager
 * 
 * Intercepts API requests to allow offline work with automatic synchronization.
 * Uses localStorage to persist the queue and entity caches.
 */

const QUEUE_KEY = 'fixit_offline_queue';
const CACHE_PREFIX = 'fixit_cache_';

export const OfflineManager = {
  isOnline: true, // Default to online; real offline detection via failed fetches
  listeners: [],
  syncing: false,

  init() {
    window.addEventListener('online', () => this.setOnline(true));
    window.addEventListener('offline', () => this.setOnline(false));
  },

  setOnline(status) {
    this.isOnline = status;
    if (status) this.sync();
    this.notify();
  },

  subscribe(cb) {
    this.listeners.push(cb);
    return () => { this.listeners = this.listeners.filter(l => l !== cb); };
  },

  notify() {
    this.listeners.forEach(cb => cb(this.isOnline, this.syncing));
  },

  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch { return []; }
  },

  saveQueue(queue) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  },

  enqueue(method, path, data) {
    const queue = this.getQueue();
    const item = {
      id: Math.random().toString(36).substr(2, 9),
      method,
      path,
      data,
      timestamp: new Date().toISOString()
    };
    queue.push(item);
    this.saveQueue(queue);
    
    // Optimistic Update: If it's a create/update, try to update local cache
    this.updateCacheOptimistically(method, path, data);
    
    return item;
  },

  updateCacheOptimistically(method, path, data) {
    const parts = path.split('/');
    if (parts[1] === 'entities') {
      const entityName = parts[2];
      const id = parts[3];
      const cacheKey = `${CACHE_PREFIX}${entityName}`;
      let cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      
      if (method === 'POST') {
        const item = { ...data, id: data.id || 'temp_' + Date.now() };
        cached.unshift(item);
      } else if (method === 'PUT' && id) {
        cached = cached.map(item => item.id === id ? { ...item, ...data } : item);
      } else if (method === 'DELETE' && id) {
        cached = cached.filter(item => item.id !== id);
      }
      
      localStorage.setItem(cacheKey, JSON.stringify(cached.slice(0, 500))); // Cap at 500
    }
  },

  getCached(entityName) {
    try {
      return JSON.parse(localStorage.getItem(`${CACHE_PREFIX}${entityName}`) || '[]');
    } catch { return []; }
  },

  setCache(entityName, data) {
    if (!Array.isArray(data)) return;
    localStorage.setItem(`${CACHE_PREFIX}${entityName}`, JSON.stringify(data.slice(0, 500)));
  },

  async sync() {
    if (this.syncing || !this.isOnline) return;
    const queue = this.getQueue();
    if (queue.length === 0) return;

    this.syncing = true;
    this.notify();

    const remaining = [];
    
    // Import fixit to avoid circular dependency
    const { fixitFetch } = await import('./fixitFetch');

    for (const item of queue) {
      try {
        await fixitFetch(item.path, {
          method: item.method,
          body: JSON.stringify(item.data)
        });
      } catch (err) {
        console.error(`Offline sync failed for ${item.path}:`, err);
        remaining.push(item);
      }
    }

    this.saveQueue(remaining);
    this.syncing = false;
    this.notify();
    
    // Refresh caches after sync
    window.dispatchEvent(new CustomEvent('offline:synced'));
  }
};

OfflineManager.init();
