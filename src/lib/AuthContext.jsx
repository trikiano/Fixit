import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState({ id: 'local', public_settings: {} });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    const token = localStorage.getItem('fixit_token');
    if (!token) {
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      return;
    }
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch {
      localStorage.removeItem('fixit_token');
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required', message: 'Session expirée, veuillez vous reconnecter' });
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const login = async (email, password) => {
    const { token, user: u } = await base44.auth.login(email, password);
    localStorage.setItem('fixit_token', token);
    setUser(u);
    setIsAuthenticated(true);
    setAuthError(null);
  };

  const logout = () => {
    base44.auth.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  // 'admin' legacy → traité comme 'superadmin'
  const effectiveRole = user?.role === 'admin' ? 'superadmin' : (user?.role || null);
  const isSuperAdmin = effectiveRole === 'superadmin';
  const isResponsableOrAbove = ['superadmin', 'responsable'].includes(effectiveRole);
  const can = (...roles) => roles.includes(effectiveRole);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      effectiveRole,
      isSuperAdmin,
      isResponsableOrAbove,
      can,
      login,
      logout,
      navigateToLogin,
      checkAppState,
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
