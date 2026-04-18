import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Wrench, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Veuillez remplir tous les champs'); return; }
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Email ou mot de passe incorrect');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 lg:px-16">
        {/* Logo */}
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <Wrench className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Fixit</h1>
              <p className="text-xs text-muted-foreground">Gestion de boutique</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-1">Connexion</h2>
          <p className="text-sm text-muted-foreground mb-8">Entrez vos identifiants pour accéder à l'espace de gestion</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@fixit.local"
                autoComplete="email"
                autoFocus
                className="w-full h-11 px-4 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Mot de passe</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-11 px-4 pr-11 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full h-11 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Se connecter
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-primary font-medium hover:underline">Créer votre boutique</Link>
          </p>
        </div>
      </div>

      {/* Right panel — decorative */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-primary">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 0%, transparent 60%), radial-gradient(circle at 80% 20%, white 0%, transparent 50%)' }}
        />
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 text-primary-foreground">
          <div className="h-20 w-20 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-8 shadow-2xl">
            <Wrench className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-center mb-4">Fixit Pro</h2>
          <p className="text-primary-foreground/80 text-center text-lg leading-relaxed max-w-xs">
            Gérez votre atelier, vos ventes, votre stock et vos clients — tout en local.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-4 w-full max-w-xs">
            {['Réparations', 'Caisse POS', 'Stock', 'Clients'].map(f => (
              <div key={f} className="p-3 rounded-xl bg-white/10 backdrop-blur-sm text-center text-sm font-medium">
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
