import React, { createContext, useState, useContext, useEffect } from 'react';
import { fixit, setToken, clearToken, getToken } from '@/api/fixitClient';

// Decode JWT payload without library
function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    // Listen for unauthorized events dispatched by the API client
    const handleUnauthorized = () => {
      setUser(null);
      setIsAuthenticated(false);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, []);

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    const token = localStorage.getItem('fixit_token');
    if (!token) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return;
    }
    try {
      const currentUser = await fixit.auth.me();
      const claims = decodeJWT(token);
      setUser({ ...currentUser, ...claims });
      setIsAuthenticated(true);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    }
    setIsLoadingAuth(false);
  };

  const login = async (email, password) => {
    const data = await fixit.auth.login(email, password);
    // Merge JWT claims (subscription_status, trial_ends_at, shop_id) into user
    const claims = decodeJWT(getToken());
    setUser({ ...data.user, ...claims });
    setIsAuthenticated(true);
    return data;
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      login,
      logout,
      checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
