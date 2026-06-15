import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

import { fixit } from '@/api/fixitClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";
import StatCard from "@/components/ui/StatCard";
import CashRegisterDetail from "@/components/cashregister/CashRegisterDetail";
import { DollarSign, Lock, Unlock, AlertTriangle, Receipt, FileText, Wrench, Zap, TrendingUp, Banknote } from 'lucide-react';

import { format } from 'date-fns';
import { useAppSettings } from "@/components/settings/SettingsContext";

export default function CashRegister() {
  const { formatCurrency, settings } = useAppSettings();
  const { user } = useAuth();

  const sym = settings.currency_symbol || 'DT';

  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [differenceReason, setDifferenceReason] = useState('');
  const [selectedRegister, setSelectedRegister] = useState(null);
  const qc = useQueryClient();

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: registers = [], isLoading } = useQuery({
    queryKey: ['cashRegisters'],
    queryFn: () => fixit.entities.CashRegister.list('-created_date'),
  });

  // Ventes du jour — filtre par sale_date (serveur) avec fallback created_date (client)
  const { data: todaySales = [] } = useQuery({
    queryKey: ['salesToday', todayStr],
    queryFn: async () => {
      try {
        const bySaleDate = await fixit.entities.Sale.filter({ sale_date: todayStr }, '-created_date', 500);
        if (Array.isArray(bySaleDate) && bySaleDate.length > 0) return bySaleDate;
      } catch (_) {}
      const all = await fixit.entities.Sale.list('-created_date', 500);
      return all.filter(s => s && (
        String(s.sale_date  || '').slice(0, 10) === todayStr ||
        String(s.created_date || '').slice(0, 10) === todayStr
      ));
    },
    staleTime: 0,
  });

  // Dépenses du jour
  const { data: allExpenses = [] } = useQuery({
    queryKey: ['expensesToday', todayStr],
    queryFn: () => fixit.entities.Expense.list('-created_date', 200),
    staleTime: 0,
  });

  // Réparations encaissées du jour
  const { data: allRepairs = [] } = useQuery({
    queryKey: ['repairsToday', todayStr],
    queryFn: () => fixit.entities.Repair.list('-created_date', 300),
    staleTime: 0,
  });

  // Services du jour
  const { data: allServiceSales = [] } = useQuery({
    queryKey: ['serviceSalesToday', todayStr],
    queryFn: () => fixit.entities.ServiceSale.list('-created_date', 300),
    staleTime: 0,
  });

  const todayRegister = registers.find(r => r.date === todayStr);

  // Calculs ventes
  const todayCash  = todaySales.filter(s => s.payment_method === 'especes').reduce((acc, v) => acc + (Number(v.total) || 0), 0);
  const todayCard  = todaySales.filter(s => s.payment_method === 'carte').reduce((acc, v) => acc + (Number(v.total) || 0), 0);
  const todaySalesTotal = todaySales.reduce((acc, v) => acc + (Number(v.total) || 0), 0);

  // Calculs réparations
  const todayRepairs = allRepairs.filter(r => {
    if ((Number(r.final_cost) || 0) <= 0) return false;
    const d = String(r.completed_date || r.created_date || '').slice(0, 10);
    return d === todayStr;
  });
  const todayRepairsTotal = todayRepairs.reduce((acc, r) => acc + (Number(r.final_cost) || 0), 0);
  const todayRepairCash   = todayRepairs.filter(r => r.payment_method === 'especes').reduce((acc, r) => acc + (Number(r.final_cost) || 0), 0);

  // Calculs services
  const todayServices = allServiceSales.filter(ss =>
    String(ss.sale_date || ss.created_date || '').slice(0, 10) === todayStr
  );
  const todayServicesTotal = todayServices.reduce((acc, ss) => acc + (Number(ss.total) || 0), 0);
  const todayServiceCash   = todayServices.filter(ss => ss.payment_method === 'especes').reduce((acc, ss) => acc + (Number(ss.total) || 0), 0);

  // Calculs dépenses
  const todayExpenses = allExpenses
    .filter(e => String(e.date || e.created_date || '').slice(0, 10) === todayStr)
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  // Totaux consolidés
  const todayTotalRevenue = todaySalesTotal + todayRepairsTotal + todayServicesTotal;
  const todayAllCash      = todayCash + todayRepairCash + todayServiceCash;

  // Solde espèces attendu (physique caisse)
  const expectedBalance = (todayRegister?.opening_balance || 0) + todayAllCash - todayExpenses;

  const openMutation = useMutation({
    mutationFn: () => fixit.entities.CashRegister.create({ 
      date: todayStr, 
      opening_balance: openingBalance, 
      status: 'ouverte',
      opened_by: user?.full_name || 'Haj',
      created_date: new Date().toISOString()
    }),

    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashRegisters'] }); setOpenDialog(false); },
  });


  const closeMutation = useMutation({
    mutationFn: () => fixit.entities.CashRegister.update(todayRegister.id, {
      closing_balance: closingBalance,
      expected_balance: expectedBalance,
      difference: closingBalance - expectedBalance,
      difference_reason: differenceReason,
      total_cash_sales: todayAllCash,
      total_card_sales: todayCard,
      total_expenses: todayExpenses,
      status: 'fermee',
      closed_by: user?.full_name || 'Haj',
      closing_date: new Date().toISOString(),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashRegisters'] }); setCloseDialogOpen(false); },
  });

  // Quick-close: save computed totals if it's today's register
  const quickCloseMutation = useMutation({
    mutationFn: (registerId) => {
      const reg = registers.find(r => r.id === registerId);
      const isToday = reg?.date === todayStr;
      return fixit.entities.CashRegister.update(registerId, {
        status: 'fermee',
        closed_by: user?.full_name || 'Admin',
        closing_date: new Date().toISOString(),
        ...(isToday ? {
          total_cash_sales: todayAllCash,
          total_card_sales: todayCard + (todayRepairsTotal - todayRepairCash) + (todayServicesTotal - todayServiceCash),
          total_expenses: todayExpenses,
          expected_balance: expectedBalance,
        } : {}),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashRegisters'] }); },
  });

  // Helper: get live or stored totals for a register row
  const getRowTotals = (r) => {
    if (r.date === todayStr) {
      // Always use live-computed values for today
      return {
        caTotal: todayTotalRevenue,
        especes: todayAllCash,
        carte: todayCard + (todayRepairsTotal - todayRepairCash) + (todayServicesTotal - todayServiceCash),
        isLive: true,
      };
    }
    const storedCash  = Number(r.total_cash_sales) || 0;
    const storedCard  = Number(r.total_card_sales)  || 0;
    return {
      caTotal: storedCash + storedCard,
      especes: storedCash,
      carte:   storedCard,
      isLive: false,
    };
  };

  const columns = [
    { header: "Date", render: r => (
      <span className="text-sm font-medium">
        {r.date}
        {r.date === todayStr && <span className="ml-1 text-xs text-primary font-normal">(aujourd'hui)</span>}
      </span>
    )},
    { header: "Statut", render: r => <StatusBadge status={r.status} /> },
    { header: "Fond ouv.", render: r => <span className="text-sm">{formatCurrency(r.opening_balance || 0)}</span> },
    { header: "CA Total", render: r => {
      const { caTotal, isLive } = getRowTotals(r);
      return (
        <span className={`text-sm font-bold ${isLive ? 'text-primary' : ''}`}>
          {caTotal > 0 ? formatCurrency(caTotal) : <span className="text-muted-foreground font-normal text-xs">Voir détails</span>}
        </span>
      );
    }},
    { header: "Espèces", render: r => {
      const { especes } = getRowTotals(r);
      return <span className="text-sm">{especes > 0 ? formatCurrency(especes) : <span className="text-muted-foreground">—</span>}</span>;
    }},
    { header: "Carte", render: r => {
      const { carte } = getRowTotals(r);
      return <span className="text-sm">{carte > 0 ? formatCurrency(carte) : <span className="text-muted-foreground">—</span>}</span>;
    }},
    { header: "Solde clôture", render: r => (
      <span className="text-sm">{r.closing_balance != null ? formatCurrency(r.closing_balance) : <span className="text-muted-foreground">—</span>}</span>
    )},
    { header: "Écart", render: r => {
      const diff = r.difference || 0;
      return <span className={`text-sm font-bold ${diff !== 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
        {r.closing_balance != null ? formatCurrency(diff) : '—'}
      </span>;
    }},
    { header: "Actions", render: r => (
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedRegister(r); }}>
          <Receipt className="h-4 w-4 mr-1" /> Détails
        </Button>
        <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10" onClick={(e) => { e.stopPropagation(); setSelectedRegister(r); }}>
          <FileText className="h-4 w-4 mr-1" /> PDF
        </Button>
        {r.status === 'ouverte' && (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); quickCloseMutation.mutate(r.id); }}>
            <Lock className="h-4 w-4 mr-1" /> Fermer
          </Button>
        )}
      </div>
    )},
  ];


  return (
    <div>
      <PageHeader title="Caisse" subtitle="Gestion de la caisse quotidienne">
        {!todayRegister ? (
          <Button onClick={() => setOpenDialog(true)}><Unlock className="h-4 w-4 mr-2" />Ouvrir la caisse</Button>
        ) : todayRegister.status === 'ouverte' ? (
          <Button variant="destructive" onClick={() => setCloseDialogOpen(true)}><Lock className="h-4 w-4 mr-2" />Fermer la caisse</Button>
        ) : null}
      </PageHeader>

      {/* Today stats — toutes sources */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard title="CA Ventes" value={formatCurrency(todaySalesTotal)}
          icon={DollarSign} description={`${todaySales.length} ticket${todaySales.length > 1 ? 's' : ''}`} />
        <StatCard title="CA Réparations" value={formatCurrency(todayRepairsTotal)}
          icon={Wrench} description={`${todayRepairs.length} dossier${todayRepairs.length > 1 ? 's' : ''}`} />
        <StatCard title="CA Services" value={formatCurrency(todayServicesTotal)}
          icon={Zap} description={`${todayServices.length} vente${todayServices.length > 1 ? 's' : ''}`} />
        <StatCard title="CA Total jour" value={formatCurrency(todayTotalRevenue)}
          icon={TrendingUp} description="Toutes sources" />
        <StatCard title="Espèces caisse" value={formatCurrency(todayAllCash)}
          icon={Banknote} description="Toutes sources" />
        <StatCard title="Solde attendu" value={formatCurrency(expectedBalance)}
          icon={DollarSign} description={`Fond + espèces - dép.`} />
      </div>

      <DataTable columns={columns} data={registers} isLoading={isLoading} emptyMessage="Aucune caisse enregistrée" onRowClick={setSelectedRegister} />

      {selectedRegister && (
        <CashRegisterDetail register={selectedRegister} onClose={() => setSelectedRegister(null)} />
      )}

      {/* Open Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ouvrir la caisse</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Solde d'ouverture ({sym})</Label><Input type="number" value={openingBalance} onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)} /></div>
            <Button onClick={() => openMutation.mutate()} className="w-full">Ouvrir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Close Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fermer la caisse</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Solde de fermeture ({sym})</Label><Input type="number" value={closingBalance} onChange={e => setClosingBalance(parseFloat(e.target.value) || 0)} /></div>
            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground">Solde attendu: <span className="font-bold text-foreground">{formatCurrency(expectedBalance)}</span></p>
              <p className="text-sm text-muted-foreground">Écart: <span className={`font-bold ${(closingBalance - expectedBalance) !== 0 ? 'text-destructive' : 'text-foreground'}`}>{formatCurrency(closingBalance - expectedBalance)}</span></p>
            </div>
            {(closingBalance - expectedBalance) !== 0 && (
              <div><Label>Raison de l'écart *</Label><Textarea value={differenceReason} onChange={e => setDifferenceReason(e.target.value)} placeholder="Justification obligatoire..." /></div>
            )}
            <Button onClick={() => closeMutation.mutate()} className="w-full" disabled={(closingBalance - expectedBalance) !== 0 && !differenceReason}>
              Fermer la caisse
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}