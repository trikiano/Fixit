import React, { useState } from 'react';
import { Clock, X, CreditCard } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

export default function TrialBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (!user) return null;

  const status = user.subscription_status;
  if (status === 'active' || status === 'demo' || user.role === 'super_admin') return null;
  if (status !== 'trial') return null;

  const trialEndsAt = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
  if (!trialEndsAt) return null;

  const now = new Date();
  const daysLeft = Math.ceil((trialEndsAt - now) / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) {
    return (
      <div className="w-full bg-destructive text-destructive-foreground px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="font-medium">Votre période d'essai est expirée. Contactez l'administrateur pour activer votre abonnement.</span>
        </div>
      </div>
    );
  }

  const isUrgent = daysLeft <= 2;
  const isWarning = daysLeft <= 5;

  return (
    <div className={`w-full px-4 py-2 flex items-center justify-between text-sm ${
      isUrgent ? 'bg-destructive text-destructive-foreground' :
      isWarning ? 'bg-orange-500 text-white' :
      'bg-primary text-primary-foreground'
    }`}>
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          <span className="font-bold">{daysLeft} jour{daysLeft > 1 ? 's' : ''}</span>
          {' '}restant{daysLeft > 1 ? 's' : ''} dans votre essai gratuit
          {isUrgent && ' — Contactez l\'admin pour continuer'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setDismissed(true)}
          className="opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
