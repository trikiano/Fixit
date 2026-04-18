import React, { useEffect, useState } from 'react';
import { OfflineManager } from '@/api/OfflineManager';
import { Wifi, WifiOff, RefreshCcw, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function OfflineSyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const unsub = OfflineManager.subscribe((online, isSyncing) => {
      if (isOnline && !online) {
        toast.error("Connexion perdue", { description: "L'application fonctionne désormais en mode hors ligne." });
      }
      if (!isOnline && online) {
        toast.info("Connexion rétablie", { description: "Synchronisation des données en cours..." });
      }
      
      setIsOnline(online);
      setSyncing(isSyncing);
    });

    const handleSynced = () => {
      qc.invalidateQueries();
      setShowSyncSuccess(true);
      setTimeout(() => setShowSyncSuccess(false), 3000);
    };

    window.addEventListener('offline:synced', handleSynced);
    return () => {
      unsub();
      window.removeEventListener('offline:synced', handleSynced);
    };
  }, [isOnline, qc]);

  if (isOnline && !syncing && !showSyncSuccess) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[999] animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!isOnline ? (
        <div className="bg-destructive text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold border border-white/20">
          <WifiOff className="h-3.5 w-3.5" /> MODE HORS LIGNE ACTIF
        </div>
      ) : syncing ? (
        <div className="bg-primary text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold animate-pulse border border-white/20">
          <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> SYNCHRONISATION...
        </div>
      ) : showSyncSuccess ? (
        <div className="bg-emerald-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold border border-white/20">
          <CheckCircle className="h-3.5 w-3.5" /> DONNÉES SYNCHRONISÉES
        </div>
      ) : null}
    </div>
  );
}
