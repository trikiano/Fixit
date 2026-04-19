import { OfflineManager } from './OfflineManager';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';


export function getToken() {
  return localStorage.getItem('fixit_token');
}
export function setToken(token) {
  localStorage.setItem('fixit_token', token);
}
export function clearToken() {
  localStorage.removeItem('fixit_token');
}

export async function fixitFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  // 2. Add timeout to fetch to prevent hanging in "half-offline" states
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout



  try {
    const res = await fetch(`${API_BASE}${path}`, { 
      ...options, 
      headers,
      signal: controller.signal 
    });
    
    clearTimeout(timeoutId);

    // Auth errors — only redirect if NOT on login/register page
    if (res.status === 401) {
      const isAuthRoute = path.includes('/auth/login') || path.includes('/auth/register');
      if (!isAuthRoute) {
        clearToken();
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Non authentifié');
    }

    if (res.status === 403) {
      window.location.href = '/403';
      throw new Error('Accès refusé');
    }

    if (res.status === 503) {
      window.location.href = '/503';
      throw new Error('Service indisponible');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    
    // Detect net error or timeout
    if (err.name === 'AbortError' || (err.name === 'TypeError' && err.message.includes('fetch'))) {
      OfflineManager.setOnline(false);
      throw new Error('OFFLINE');
    }
    throw err;
  }

}
