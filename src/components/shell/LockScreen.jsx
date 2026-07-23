import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, ArrowLeft, Delete } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

export default function LockScreen({ onUnlock }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { settings } = useAppSettings();
  const { checkAppState } = useAuth();

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
      await checkAppState();
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
        <div className="flex flex-col items-center gap-2">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{shopName}</h2>
          <p className="text-sm text-muted-foreground">Sélectionnez votre profil pour continuer</p>
        </div>

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
                <div className={cn(
                  'h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg ring-4 ring-transparent group-hover:scale-105 transition-all',
                  roleAvatarBg(u.role),
                  `group-hover:${roleRing(u.role)}`
                )}>
                  {initials(u.name)}
                </div>
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

  // ── Phase 2 : saisie PIN / mot de passe ─────────────────────────────────────
  const admin = isAdmin(selectedUser);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Panneau gauche */}
      <div className="flex-1 flex flex-col items-center justify-center bg-card px-8 relative gap-5">
        <button
          onClick={backToGrid}
          className="absolute top-5 left-5 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Changer d'utilisateur
        </button>

        <div className={cn(
          'h-24 w-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-xl ring-4',
          roleAvatarBg(selectedUser.role),
          roleRing(selectedUser.role)
        )}>
          {initials(selectedUser.name)}
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-foreground">{selectedUser.name}</h2>
          <span className={cn('inline-block text-xs font-medium px-2.5 py-0.5 rounded-full', roleBadge(selectedUser.role))}>
            {roleLabel(selectedUser.role)}
          </span>
        </div>

        {admin ? (
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
          <div className="flex flex-col items-center gap-5 mt-2">
            <p className="text-sm text-muted-foreground">Entrez votre code PIN (4 chiffres)</p>
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
            <div className="grid grid-cols-3 gap-3 w-64">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button key={n} onClick={() => pressDigit(String(n))}
                  disabled={submitting}
                  className="h-16 rounded-2xl bg-muted/60 hover:bg-muted text-xl font-semibold text-foreground transition-all active:scale-95 shadow-sm disabled:opacity-40">
                  {n}
                </button>
              ))}
              <div />
              <button onClick={() => pressDigit('0')} disabled={submitting}
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
            <p className="text-sm text-white/70 mt-1">Votre espace de travail est verrouillé. Entrez votre code pour continuer.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
