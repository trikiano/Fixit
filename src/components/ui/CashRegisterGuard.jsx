import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fixit } from '@/api/fixitClient';
import { format } from 'date-fns';
import { Button } from "@/components/ui/button";
import { AlertTriangle, Lock } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

/**
 * Hook to check if cash register is open today
 */
export function useCashRegister() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const { data: registers = [], isLoading } = useQuery({
    queryKey: ['cashRegisters'],
    queryFn: () => fixit.entities.CashRegister.list('-created_date', 10),
  });
  const todayRegister = registers.find(r => r.date === todayStr && r.status === 'ouverte');
  return { isOpen: !!todayRegister, register: todayRegister, isLoading };
}

/**
 * Wraps content and shows a warning if no cash register is open
 */
export default function CashRegisterGuard({ children, operationType = 'cette opération' }) {
  const { isOpen, isLoading } = useCashRegister();

  if (isLoading) return <div className="flex-1">{children}</div>;

  if (!isOpen) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Warning banner */}
        <div className="mb-4 p-4 rounded-xl border-2 border-orange-500/40 bg-orange-500/10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="h-9 w-9 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="font-semibold text-orange-400">Caisse non ouverte</p>
              <p className="text-sm text-muted-foreground">
                Pour enregistrer {operationType}, vous devez d'abord ouvrir la caisse du jour.
              </p>
            </div>
          </div>
          <Link to={createPageUrl('CashRegister')}>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white gap-2 flex-shrink-0" size="sm">
              <Lock className="h-4 w-4" />
              Ouvrir la caisse
            </Button>
          </Link>
        </div>
        {/* Still render children but with overlay */}
        <div className="relative flex-1">
          <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] rounded-xl pointer-events-none" />
          <div className="pointer-events-none opacity-50">
            {children}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}