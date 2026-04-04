import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Wrench, X, Home, Delete, Lock, ShieldCheck, LogOut, User } from 'lucide-react';

import { cn } from '@/lib/utils';
import { SettingsProvider, useAppSettings } from '@/components/settings/SettingsContext';
import { useAuth } from '@/lib/AuthContext';
import HomeScreen from '@/components/shell/HomeScreen';

import { ShellContext_ } from '@/lib/ShellContext';


// Lazy-loaded pages
const PAGES = {
  Dashboard: lazy(() => import('../../pages/Dashboard')),
  Clients: lazy(() => import('../../pages/Clients')),
  Sales: lazy(() => import('../../pages/Sales')),
  Services: lazy(() => import('../../pages/Services')),
  CashRegister: lazy(() => import('../../pages/CashRegister')),
  Promotions: lazy(() => import('../../pages/Promotions')),
  Repairs: lazy(() => import('../../pages/Repairs')),
  Warranties: lazy(() => import('../../pages/Warranties')),
  Products: lazy(() => import('../../pages/Products')),
  StockMovements: lazy(() => import('../../pages/StockMovements')),
  Suppliers: lazy(() => import('../../pages/Suppliers')),
  PurchaseOrders: lazy(() => import('../../pages/PurchaseOrders')),
  SupplierInvoices: lazy(() => import('../../pages/SupplierInvoices')),
  Expenses: lazy(() => import('../../pages/Expenses')),
  AuditLogs: lazy(() => import('../../pages/AuditLogs')),
  Notifications: lazy(() => import('../../pages/Notifications')),
  Settings: lazy(() => import('../../pages/Settings')),
  POS: lazy(() => import('../../pages/POS')),
  Users: lazy(() => import('../../pages/Users')),
};


const PAGE_LABELS = {
  Dashboard: 'Dashboard', Clients: 'Clients', Sales: 'Ventes',
  Services: 'Services', CashRegister: 'Caisse', Promotions: 'Promotions',
  Repairs: 'Réparations', Warranties: 'Garanties', Products: 'Produits',
  StockMovements: 'Stock', Suppliers: 'Fournisseurs', PurchaseOrders: 'Commandes',
  SupplierInvoices: 'Factures', Expenses: 'Dépenses', AuditLogs: 'Audit',
  Notifications: 'Notifications', Settings: 'Paramètres', POS: 'Caisse POS',
};

function LockScreen({ onUnlock }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const { settings } = useAppSettings();

  const correctPin = settings.workspace_pin || '1234';

  const press = (digit) => {
    if (input.length >= 4) return;
    const next = input + digit;
    setInput(next);
    setError(false);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === correctPin) {
          onUnlock();
          setInput('');
        } else {
          setError(true);
          setInput('');
        }
      }, 100);
    }
  };

  const del = () => { setInput(p => p.slice(0, -1)); setError(false); };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Left — PIN */}
      <div className="flex-1 flex flex-col items-center justify-center bg-card px-8">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-1">{settings.shop_name || 'TechRepair Pro'}</h2>
        <p className="text-sm text-muted-foreground mb-8">Entrez votre code PIN</p>

        {/* Dots */}
        <div className="flex gap-3 mb-8">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className={cn(
              "h-4 w-4 rounded-full border-2 transition-all",
              input.length > i
                ? error ? "bg-destructive border-destructive" : "bg-primary border-primary"
                : "border-muted-foreground/40"
            )} />
          ))}
        </div>

        {error && <p className="text-xs text-destructive mb-4">Code PIN incorrect</p>}

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3 w-64">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
            <button key={n} onClick={() => press(String(n))}
              className="h-16 rounded-2xl bg-muted/60 hover:bg-muted text-xl font-semibold text-foreground transition-all active:scale-95 shadow-sm">
              {n}
            </button>
          ))}
          <div /> {/* empty */}
          <button onClick={() => press('0')}
            className="h-16 rounded-2xl bg-muted/60 hover:bg-muted text-xl font-semibold text-foreground transition-all active:scale-95 shadow-sm">
            0
          </button>
          <button onClick={del}
            className="h-16 rounded-2xl bg-muted/40 hover:bg-muted text-muted-foreground flex items-center justify-center transition-all active:scale-95">
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Right — image */}
      <div className="hidden md:flex flex-1 relative overflow-hidden">
        <img
          src="/repair_lockscreen.png"
          alt="Repair workstation"

          className="w-full h-full object-cover"
        />

        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/20" />
        <div className="absolute bottom-10 left-8 right-8">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 text-white">
            <ShieldCheck className="h-8 w-8 mb-3 text-emerald-400" />
            <h3 className="text-lg font-bold">Système sécurisé</h3>
            <p className="text-sm text-white/70 mt-1">Votre espace de travail est verrouillé. Entrez votre PIN pour continuer.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShellInner() {
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [locked, setLocked] = useState(() => {
    // Persistent lock state: lock by default if it was locked or never set
    return localStorage.getItem('fixit_locked') === 'true';
  });
  const { settings } = useAppSettings();
  const { user, logout } = useAuth();
  const [showLogout, setShowLogout] = useState(false);



  useEffect(() => {
    localStorage.setItem('fixit_locked', locked);
  }, [locked]);


  const lockTimeoutMs = parseInt(settings.lock_timeout || '5') * 60 * 1000;

  // Inactivity lock
  const resetTimer = useCallback(() => {
    clearTimeout(window._lockTimer);
    if (lockTimeoutMs > 0) {
      window._lockTimer = setTimeout(() => setLocked(true), lockTimeoutMs);
    }
  }, [lockTimeoutMs]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearTimeout(window._lockTimer);
    };
  }, [resetTimer]);

  const openTab = (page) => {
    // Permission check
    if (user && user.role !== 'admin') {
      const perms = typeof user.permissions === 'string' ? JSON.parse(user.permissions || '[]') : (user.permissions || []);
      const restrictedPages = ['Settings', 'Users', 'AuditLogs'];
      if (restrictedPages.includes(page) || (!perms.includes(page) && page !== 'home' && page !== 'Dashboard')) {
        // Optionnel: Alerter ou ignorer
        return;
      }
    }

    const existing = tabs.find(t => t.page === page);

    if (existing) {
      setActiveTab(existing.id);
    } else {
      const id = `tab_${page}_${Date.now()}`;
      setTabs(prev => [...prev, { id, page, label: PAGE_LABELS[page] || page }]);
      setActiveTab(id);
    }
  };

  const closeTab = (id, e) => {
    e.stopPropagation();
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== id);
      if (activeTab === id) {
        const idx = prev.findIndex(t => t.id === id);
        const next = remaining[idx] || remaining[idx - 1];
        setActiveTab(next ? next.id : 'home');
      }
      return remaining;
    });
  };

  const activeTabData = tabs.find(t => t.id === activeTab);
  const ActivePage = activeTabData ? PAGES[activeTabData.page] : null;

  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;

  return (
    <ShellContext_.Provider value={{ openTab }}>
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center bg-card border-b border-border h-11 flex-shrink-0 shadow-sm relative z-40" style={{WebkitOverflowScrolling:'touch'}}>
        {/* Scrollable Tabs Area */}
        <div className="flex flex-1 items-center h-full overflow-x-auto scrollbar-hide">
          {/* Home tab */}
          <div
            onPointerDown={() => setActiveTab('home')}
            className={cn(
              "flex items-center gap-1.5 px-4 h-full border-r border-border text-xs sm:text-sm font-medium flex-shrink-0 transition-colors cursor-pointer select-none",
              activeTab === 'home'
                ? "bg-background border-b-2 border-b-primary text-primary"
                : "text-muted-foreground hover:bg-muted/40"
            )}
          >
            <Home className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Accueil</span>
          </div>

          {tabs.map(tab => (
            <div
              key={tab.id}
              className={cn(
                "flex items-center h-full border-r border-border text-xs sm:text-sm font-medium flex-shrink-0 transition-colors select-none",
                activeTab === tab.id
                  ? "bg-background border-b-2 border-b-primary text-foreground"
                  : "text-muted-foreground hover:bg-muted/40"
              )}
            >
              <div
                onPointerDown={() => setActiveTab(tab.id)}
                className="flex-1 px-3 h-full flex items-center cursor-pointer min-w-0"
              >
                <span className="max-w-[100px] truncate">{tab.label}</span>
              </div>
              <div
                onPointerDown={(e) => { e.stopPropagation(); closeTab(tab.id, e); }}
                className="pr-2 h-full flex items-center cursor-pointer text-muted-foreground hover:text-destructive"
              >
                <div className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-destructive/10">
                  <X className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Fixed Right Actions */}
        <div className="flex items-center h-full border-l border-border bg-card">
          {user && (
            <div 
              className="relative h-full flex items-center"
              onMouseEnter={() => setShowLogout(true)}
              onMouseLeave={() => setShowLogout(false)}
            >
              <div className="flex items-center gap-2 px-4 h-full text-[13px] font-medium text-foreground hover:bg-muted/40 transition-colors cursor-default">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 flex-shrink-0">
                  <User className="h-3 w-3" />
                </div>
                <span className="hidden lg:inline max-w-[120px] truncate">{user.full_name || user.email}</span>
              </div>

              {showLogout && (
                <div className="absolute top-[calc(100%-4px)] right-1 p-1 bg-popover border border-border rounded-xl shadow-2xl animate-in fade-in slide-in-from-top-1 z-[100] min-w-[160px]">
                  <div className="px-2 py-1.5 border-b border-border/50 mb-1">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Session active</p>
                    <p className="text-xs font-semibold truncate">{user.full_name || user.email}</p>
                  </div>
                  <button
                    onClick={() => { logout(); window.location.href = '/login'; }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors group"
                  >
                    <LogOut className="h-3.5 w-3.5 text-destructive/70 group-hover:text-destructive" />
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setLocked(true)}
            className="flex items-center gap-1.5 px-4 h-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 flex-shrink-0 transition-colors border-l border-border"
          >
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Verrouiller</span>
          </button>
        </div>
      </div>



      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'home' ? (
          <HomeScreen openTab={openTab} />
        ) : ActivePage ? (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          }>
            <div className="p-4 lg:p-6">
              <ActivePage />
            </div>
          </Suspense>
        ) : null}
      </div>
    </div>
    </ShellContext_.Provider>
  );
}

export default function Shell() {
  return (
    <SettingsProvider>
      <ShellInner />
    </SettingsProvider>
  );
}