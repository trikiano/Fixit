import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Wrench, X, Home, Delete, Lock, ShieldCheck, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SettingsProvider, useAppSettings } from '@/components/settings/SettingsContext';
import HomeScreen from '@/components/shell/HomeScreen';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

const LOCK_TIMEOUT = 5 * 60 * 1000; // 5 min

function roleEffective(role) {
  return role === 'admin' ? 'superadmin' : role;
}
function roleAvatarBg(role) {
  const er = roleEffective(role);
  if (er === 'superadmin') return 'bg-violet-500';
  if (er === 'responsable') return 'bg-sky-500';
  return 'bg-emerald-500';
}
function roleRing(role) {
  const er = roleEffective(role);
  if (er === 'superadmin') return 'ring-violet-400';
  if (er === 'responsable') return 'ring-sky-400';
  return 'ring-emerald-400';
}
function roleBadge(role) {
  const er = roleEffective(role);
  if (er === 'superadmin') return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300';
  if (er === 'responsable') return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
}
function roleLabel(role) {
  const er = roleEffective(role);
  if (er === 'superadmin') return 'Super Admin';
  if (er === 'responsable') return 'Responsable';
  return 'Vendeur';
}
function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function LockScreen({ onUnlock }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { settings } = useAppSettings();

  useEffect(() => {
    base44.auth.lockScreenUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  const isAdmin = (u) => roleEffective(u.role) === 'superadmin';

  const handleSubmit = async (pin) => {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const { token } = await base44.auth.login(selectedUser.email, pin);
      localStorage.setItem('fixit_token', token);
      onUnlock();
    } catch {
      setError(true);
      setInput('');
    } finally {
      setSubmitting(false);
    }
  };

  const pressDigit = (d) => {
    if (input.length >= 4 || submitting) return;
    const next = input + d;
    setInput(next);
    setError(false);
    if (next.length === 4) setTimeout(() => handleSubmit(next), 150);
  };

  const delDigit = () => { setInput(p => p.slice(0, -1)); setError(false); };

  const selectUser = (u) => { setSelectedUser(u); setInput(''); setError(false); };
  const backToGrid = () => { setSelectedUser(null); setInput(''); setError(false); };

  const shopName = settings?.shop_name || 'TechRepair Pro';

  // ── Phase 1 : sélection du profil ───────────────────────────────────────────
  if (!selectedUser) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-8 gap-10">
        {/* Header */}
        <div className="flex flex-col items-center gap-2">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{shopName}</h2>
          <p className="text-sm text-muted-foreground">Sélectionnez votre profil pour continuer</p>
        </div>

        {/* Grille utilisateurs */}
        {loadingUsers ? (
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        ) : (
          <div className="flex flex-wrap justify-center gap-5 max-w-2xl">
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => selectUser(u)}
                className="group flex flex-col items-center gap-3 p-5 rounded-2xl hover:bg-muted/60 transition-all w-36"
              >
                {/* Avatar */}
                <div className={cn(
                  'h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ring-transparent group-hover:scale-105 transition-all',
                  roleAvatarBg(u.role),
                  `group-hover:${roleRing(u.role)}`
                )}>
                  {initials(u.name)}
                </div>
                {/* Nom */}
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-foreground leading-tight">{u.name}</p>
                  <span className={cn('inline-block text-[10px] font-medium px-2 py-0.5 rounded-full', roleBadge(u.role))}>
                    {roleLabel(u.role)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Phase 2 : saisie du mot de passe / PIN ──────────────────────────────────
  const admin = isAdmin(selectedUser);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Panneau gauche — saisie */}
      <div className="flex-1 flex flex-col items-center justify-center bg-card px-8 relative gap-5">
        {/* Retour */}
        <button
          onClick={backToGrid}
          className="absolute top-5 left-5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Changer d'utilisateur
        </button>

        {/* Avatar */}
        <div className={cn(
          'h-24 w-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-xl ring-4',
          roleAvatarBg(selectedUser.role),
          roleRing(selectedUser.role)
        )}>
          {initials(selectedUser.name)}
        </div>

        {/* Identité */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-foreground">{selectedUser.name}</h2>
          <span className={cn('inline-block text-xs font-medium px-2.5 py-0.5 rounded-full', roleBadge(selectedUser.role))}>
            {roleLabel(selectedUser.role)}
          </span>
        </div>

        {admin ? (
          /* ── Mot de passe admin (texte libre) ── */
          <form
            onSubmit={(e) => { e.preventDefault(); if (input) handleSubmit(input); }}
            className="w-full max-w-xs space-y-3 mt-2"
          >
            <p className="text-sm text-muted-foreground text-center">Entrez votre mot de passe</p>
            <Input
              type="password"
              value={input}
              onChange={e => { setInput(e.target.value); setError(false); }}
              placeholder="Mot de passe"
              className={cn('text-center text-base', error && 'border-destructive focus-visible:ring-destructive')}
              autoFocus
              disabled={submitting}
            />
            {error && <p className="text-xs text-destructive text-center">Mot de passe incorrect</p>}
            <Button type="submit" className="w-full" disabled={submitting || !input}>
              {submitting ? 'Vérification...' : 'Déverrouiller'}
            </Button>
          </form>
        ) : (
          /* ── PIN 4 chiffres (numpad) ── */
          <div className="flex flex-col items-center gap-5 mt-2">
            <p className="text-sm text-muted-foreground">Entrez votre code PIN (4 chiffres)</p>

            {/* Points */}
            <div className="flex gap-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={cn(
                  'h-4 w-4 rounded-full border-2 transition-all',
                  input.length > i
                    ? error ? 'bg-destructive border-destructive' : 'bg-primary border-primary'
                    : 'border-muted-foreground/40'
                )} />
              ))}
            </div>
            {error && <p className="text-xs text-destructive -mt-3">Code PIN incorrect</p>}

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3 w-64">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button key={n} onClick={() => pressDigit(String(n))}
                  disabled={submitting}
                  className="h-16 rounded-2xl bg-muted/60 hover:bg-muted text-xl font-semibold text-foreground transition-all active:scale-95 shadow-sm disabled:opacity-40">
                  {n}
                </button>
              ))}
              <div />
              <button onClick={() => pressDigit('0')}
                disabled={submitting}
                className="h-16 rounded-2xl bg-muted/60 hover:bg-muted text-xl font-semibold text-foreground transition-all active:scale-95 shadow-sm disabled:opacity-40">
                0
              </button>
              <button onClick={delDigit}
                className="h-16 rounded-2xl bg-muted/40 hover:bg-muted text-muted-foreground flex items-center justify-center transition-all active:scale-95">
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Panneau droit — image déco */}
      <div className="hidden md:flex flex-1 relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1601972599720-36938d4ecd31?w=900&q=80"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/20" />
        <div className="absolute bottom-10 left-8 right-8">
          <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-6 text-white">
            <ShieldCheck className="h-8 w-8 mb-3 text-emerald-400" />
            <h3 className="text-lg font-bold">Système sécurisé</h3>
            <p className="text-sm text-white/70 mt-1">
              Votre espace de travail est verrouillé. Entrez votre code pour continuer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShellInner() {
  const { checkAppState } = useAuth();
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [locked, setLocked] = useState(false);

  // Écoute l'événement "retour accueil" émis depuis les pages internes (ex: POS)
  useEffect(() => {
    const handler = () => setActiveTab('home');
    window.addEventListener('shell:go-home', handler);
    return () => window.removeEventListener('shell:go-home', handler);
  }, []);

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

  if (locked) return <LockScreen onUnlock={async () => { await checkAppState(); setLocked(false); }} />;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center bg-card border-b border-border h-11 overflow-x-auto flex-shrink-0" style={{WebkitOverflowScrolling:'touch'}}>
        {/* Logo — retour accueil */}
        <div
          onPointerDown={() => setActiveTab('home')}
          className="flex items-center justify-center w-11 h-full border-r border-border cursor-pointer hover:bg-muted/40 transition-colors flex-shrink-0"
          title="Accueil"
        >
          <Wrench className="h-4 w-4 text-primary" />
        </div>

        {/* Home tab */}
        <div
          onPointerDown={() => setActiveTab('home')}
          className={cn(
            "flex items-center gap-1.5 px-4 h-full border-r border-border text-sm font-medium flex-shrink-0 transition-colors cursor-pointer select-none",
            activeTab === 'home'
              ? "bg-background border-b-2 border-b-primary text-primary"
              : "text-muted-foreground hover:bg-muted/40"
          )}
        >
          <Home className="h-3.5 w-3.5" />
          <span>Accueil</span>
        </div>

        {tabs.map(tab => (
          <div
            key={tab.id}
            className={cn(
              "flex items-center h-full border-r border-border text-sm font-medium flex-shrink-0 transition-colors select-none",
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
              <div className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-destructive/10">
                <X className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
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