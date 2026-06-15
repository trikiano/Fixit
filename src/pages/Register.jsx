import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wrench, Eye, EyeOff, UserPlus, AlertCircle, CheckCircle, Store, Mail, User, Lock } from 'lucide-react';
import { fixitFetch, setToken } from '@/api/fixitFetch';
import PhoneInput from '@/components/ui/PhoneInput';

export default function Register() {
  const [form, setForm] = useState({ shop_name: '', full_name: '', email: '', phone: '', password: '', confirm_password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.shop_name || !form.email || !form.password || !form.full_name) {
      setError('Veuillez remplir tous les champs obligatoires'); return;
    }
    if (form.password !== form.confirm_password) {
      setError('Les mots de passe ne correspondent pas'); return;
    }
    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères'); return;
    }
    setLoading(true); setError('');
    try {
      const data = await fixitFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          shop_name: form.shop_name,
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          role: 'admin',
        }),
      });
      if (data.token) setToken(data.token);
      setSuccess(true);
      setTimeout(() => navigate('/', { replace: true }), 2000);
    } catch (err) {
      setError(err.message || 'Erreur lors de la création du compte');
    }
    setLoading(false);
  };

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Boutique créée !</h2>
        <p className="text-muted-foreground">Votre essai gratuit de 7 jours commence maintenant.</p>
        <p className="text-sm text-muted-foreground mt-1">Redirection en cours...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-16 py-10">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <Wrench className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Fixit</h1>
              <p className="text-xs text-muted-foreground">Gestion de boutique</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-1">Créer votre boutique</h2>
          <p className="text-sm text-muted-foreground mb-6">Essai gratuit de <span className="text-primary font-semibold">7 jours</span> — aucune carte bancaire requise</p>

          {/* Trial badge */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 mb-6">
            <CheckCircle className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm text-primary font-medium">7 jours d'essai gratuit · Accès complet · Sans engagement</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Shop name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Nom de la boutique *</label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" value={form.shop_name} onChange={set('shop_name')} placeholder="Mon Atelier Tech"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" />
              </div>
            </div>

            {/* Full name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Votre nom *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="text" value={form.full_name} onChange={set('full_name')} placeholder="Mohamed Amine"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input type="email" value={form.email} onChange={set('email')} placeholder="vous@exemple.com"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Téléphone</label>
              <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} className="h-11" />
            </div>

            {/* Password */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Mot de passe *</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-10 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" />
                  <button type="button" onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Confirmer *</label>
                <input type="password" value={form.confirm_password} onChange={set('confirm_password')} placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full h-11 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all disabled:opacity-60 shadow-sm">
              {loading ? (
                <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <><UserPlus className="h-4 w-4" />Créer ma boutique gratuitement</>
              )}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              Déjà un compte ?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">Se connecter</Link>
            </p>
          </form>
        </div>
      </div>

      {/* Right panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-primary">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 0%, transparent 60%)' }} />
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 text-primary-foreground">
          <div className="h-20 w-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-8 shadow-2xl">
            <Wrench className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-center mb-4">Tout inclus</h2>
          <p className="text-primary-foreground/80 text-center text-lg leading-relaxed max-w-xs mb-10">
            Gérez votre atelier dès le premier jour avec tous les outils.
          </p>
          <div className="space-y-3 w-full max-w-xs">
            {['✓ Réparations & Garanties', '✓ Caisse & Ventes POS', '✓ Stock & Fournisseurs', '✓ Clients & Fidélité', '✓ Rapports & Dashboard', '✓ Multi-utilisateurs'].map(f => (
              <div key={f} className="p-3 rounded-xl bg-white/10 backdrop-blur-sm text-sm font-medium">{f}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
