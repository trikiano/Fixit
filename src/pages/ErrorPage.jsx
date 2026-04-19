import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Home, ArrowLeft, RefreshCw, ShieldAlert, Clock, WifiOff, Lock } from 'lucide-react';

const ERROR_CONFIG = {
  301: {
    icon: ArrowLeft,
    title: 'Redirection permanente',
    description: 'Cette page a été déplacée définitivement vers une nouvelle adresse.',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
  302: {
    icon: ArrowLeft,
    title: 'Redirection temporaire',
    description: 'Cette page est temporairement disponible à une autre adresse.',
    color: 'text-blue-400',
    bg: 'bg-blue-50',
  },
  400: {
    icon: ShieldAlert,
    title: 'Requête invalide',
    description: 'La requête envoyée au serveur est incorrecte ou mal formée.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  401: {
    icon: Lock,
    title: 'Non autorisé',
    description: 'Vous devez être connecté pour accéder à cette page.',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },
  403: {
    icon: Lock,
    title: 'Accès refusé',
    description: "Vous n'avez pas les droits nécessaires pour accéder à cette ressource.",
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  404: {
    icon: ShieldAlert,
    title: 'Page introuvable',
    description: "La page que vous recherchez n'existe pas ou a été supprimée.",
    color: 'text-slate-500',
    bg: 'bg-slate-50',
  },
  408: {
    icon: Clock,
    title: 'Délai dépassé',
    description: 'La requête a pris trop de temps. Vérifiez votre connexion et réessayez.',
    color: 'text-yellow-500',
    bg: 'bg-yellow-50',
  },
  429: {
    icon: Clock,
    title: 'Trop de requêtes',
    description: 'Vous avez effectué trop de requêtes. Veuillez patienter quelques instants.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  500: {
    icon: ShieldAlert,
    title: 'Erreur serveur',
    description: 'Une erreur interne est survenue. Notre équipe a été notifiée.',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  502: {
    icon: WifiOff,
    title: 'Passerelle invalide',
    description: 'Le serveur a reçu une réponse invalide. Réessayez dans quelques instants.',
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  503: {
    icon: WifiOff,
    title: 'Service indisponible',
    description: 'Le service est temporairement indisponible. Réessayez dans quelques minutes.',
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  504: {
    icon: Clock,
    title: 'Délai de passerelle',
    description: 'Le serveur met trop de temps à répondre. Réessayez dans quelques instants.',
    color: 'text-red-400',
    bg: 'bg-red-50',
  },
};

export default function ErrorPage({ code = 500, message }) {
  const navigate = useNavigate();
  const config = ERROR_CONFIG[code] || ERROR_CONFIG[500];
  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
            <Wrench className="h-7 w-7 text-primary-foreground" />
          </div>
        </div>

        {/* Error icon + code */}
        <div className="relative mb-6">
          <p className="text-[120px] font-black text-muted/20 leading-none select-none">{code}</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`h-20 w-20 rounded-full ${config.bg} flex items-center justify-center`}>
              <Icon className={`h-10 w-10 ${config.color}`} />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">{config.title}</h1>
        <p className="text-muted-foreground mb-2">{message || config.description}</p>
        <p className="text-xs text-muted-foreground/60 mb-8 font-mono">Code d'erreur : {code}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-medium"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Réessayer
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            <Home className="h-4 w-4" />
            Accueil
          </button>
        </div>

        <div className="mt-10 p-4 rounded-xl bg-muted/40 border border-border text-left">
          <p className="text-xs font-medium text-foreground mb-1">Besoin d'aide ?</p>
          <p className="text-xs text-muted-foreground">
            Contactez le support Fixit Service si le problème persiste.
          </p>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          <span className="font-mono bg-muted px-2 py-1 rounded">Erreur {code}</span>
          {' · '}Fixit Service
        </p>
      </div>
    </div>
  );
}
