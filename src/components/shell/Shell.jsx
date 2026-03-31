import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Wrench, X, Home, Delete, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SettingsProvider, useAppSettings } from '@/components/settings/SettingsContext';
import HomeScreen from '@/components/shell/HomeScreen';

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
};

const PAGE_LABELS = {
  Dashboard: 'Dashboard', Clients: 'Clients', Sales: 'Ventes',
  Services: 'Services', CashRegister: 'Caisse', Promotions: 'Promotions',
  Repairs: 'Réparations', Warranties: 'Garanties', Products: 'Produits',
  StockMovements: 'Stock', Suppliers: 'Fournisseurs', PurchaseOrders: 'Commandes',
  SupplierInvoices: 'Factures', Expenses: 'Dépenses', AuditLogs: 'Audit',
  Notifications: 'Notifications', Settings: 'Paramètres', POS: 'Caisse POS',
};

const DEFAULT_PIN = '1234';
const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 min

function LockScreen({ onUnlock }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const { settings } = useAppSettings();

  const correctPin = localStorage.getItem('shell_pin') || DEFAULT_PIN;

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
          src="https://images.unsplash.com/photo-1601972599720-36938d4ecd31?w=900&q=80"
          alt="Repair shop"
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
  const [locked, setLocked] = useState(false);

  // Inactivity lock
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

  const openTab = (page) => {
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
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center bg-card border-b border-border h-11 overflow-x-auto flex-shrink-0">
        {/* Home tab */}
        <button
          onClick={() => setActiveTab('home')}
          className={cn(
            "flex items-center gap-1.5 px-4 h-full border-r border-border text-sm font-medium flex-shrink-0 transition-colors",
            activeTab === 'home'
              ? "bg-background border-b-2 border-b-primary text-primary"
              : "text-muted-foreground hover:bg-muted/40"
          )}
        >
          <Home className="h-3.5 w-3.5" />
          <span>Accueil</span>
        </button>

        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 h-full border-r border-border text-sm font-medium flex-shrink-0 transition-colors group",
              activeTab === tab.id
                ? "bg-background border-b-2 border-b-primary text-foreground"
                : "text-muted-foreground hover:bg-muted/40"
            )}
          >
            <span className="max-w-[120px] truncate">{tab.label}</span>
            <span
              onClick={(e) => closeTab(tab.id, e)}
              className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-all ml-1 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}

        {/* Spacer + lock button */}
        <div className="flex-1" />
        <button
          onClick={() => setLocked(true)}
          className="flex items-center gap-1.5 px-4 h-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 flex-shrink-0 transition-colors border-l border-border"
        >
          <Lock className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Verrouiller</span>
        </button>
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
  );
}

export default function Shell() {
  return (
    <SettingsProvider>
      <ShellInner />
    </SettingsProvider>
  );
}