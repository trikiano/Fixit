import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LockContext = createContext();

const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 min d'inactivité

export const LockProvider = ({ children }) => {
  const [locked, setLocked] = useState(false);

  const lock = useCallback(() => setLocked(true), []);
  const unlock = useCallback(() => setLocked(false), []);

  const resetTimer = useCallback(() => {
    clearTimeout(window._lockTimer);
    window._lockTimer = setTimeout(() => setLocked(true), LOCK_TIMEOUT);
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearTimeout(window._lockTimer);
    };
  }, [resetTimer]);

  return (
    <LockContext.Provider value={{ locked, lock, unlock }}>
      {children}
    </LockContext.Provider>
  );
};

export const useLock = () => {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used within LockProvider');
  return ctx;
};
