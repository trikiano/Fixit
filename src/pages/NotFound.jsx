import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <Wrench className="h-7 w-7 text-primary-foreground" />
          </div>
        </div>

        {/* 404 */}
        <div className="relative mb-6">
          <p className="text-[120px] font-black text-muted/20 leading-none select-none">404</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="h-16 w-16 text-muted-foreground/40" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Page introuvable</h1>
        <p className="text-muted-foreground mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Home className="h-4 w-4" />
            Accueil
          </button>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          <span className="font-mono bg-muted px-2 py-1 rounded">Erreur 404</span>
          {' · '}Fixit Service
        </p>
      </div>
    </div>
  );
}
