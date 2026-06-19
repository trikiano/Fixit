import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
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
import { DollarSign, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useAppSettings } from "@/components/settings/SettingsContext";

export default function CashRegister() {
  const { formatCurrency, settings } = useAppSettings();
  const sym = settings.currency_symbol || 'DT';
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [differenceReason, setDifferenceReason] = useState('');
  const [selectedRegister, setSelectedRegister] = useState(null);
  const qc = useQueryClient();

  const { data: registers = [], isLoading } = useQuery({ queryKey: ['cashRegisters'], queryFn: () => base44.entities.CashRegister.list('-created_date') });
  const { data: sales = [] } = useQuery({ queryKey: ['salesToday'], queryFn: () => base44.entities.Sale.filter({ status: 'completee' }, '-created_date', 200) });
  const { data: expenses = [] } = useQuery({ queryKey: ['expensesToday'], queryFn: () => base44.entities.Expense.list('-created_date', 100) });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayRegister = registers.find(r => r.date === todayStr);
  const todaySales = sales.filter(s => s.created_date?.startsWith(todayStr));
  const todayCash = todaySales.filter(s => s.payment_method === 'especes').reduce((s, v) => s + (v.total || 0), 0);
  const todayCard = todaySales.filter(s => s.payment_method === 'carte').reduce((s, v) => s + (v.total || 0), 0);
  const todayExpenses = expenses.filter(e => e.date === todayStr || e.created_date?.startsWith(todayStr)).reduce((s, e) => s + (e.amount || 0), 0);
  const expectedBalance = (todayRegister?.opening_balance || 0) + todayCash - todayExpenses;

  const openMutation = useMutation({
    mutationFn: () => base44.entities.CashRegister.create({ date: todayStr, opening_balance: openingBalance, status: 'ouverte' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashRegisters'] }); setOpenDialog(false); },
  });

  const closeMutation = useMutation({
    mutationFn: () => base44.entities.CashRegister.update(todayRegister.id, {
      closing_balance: closingBalance, expected_balance: expectedBalance,
      difference: closingBalance - expectedBalance, difference_reason: differenceReason,
      total_cash_sales: todayCash, total_card_sales: todayCard, total_expenses: todayExpenses, status: 'fermee'
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cashRegisters'] }); setCloseDialogOpen(false); },
  });

  const columns = [
    { header: "Date", render: r => <span className="text-sm font-medium">{r.date}</span> },
    { header: "Statut", render: r => <StatusBadge status={r.status} /> },
    { header: "Ouverture", render: r => <span className="text-sm">{formatCurrency(r.opening_balance || 0)}</span> },
    { header: "Clôture", render: r => <span className="text-sm">{r.closing_balance != null ? formatCurrency(r.closing_balance) : '-'}</span> },
    { header: "Espèces", render: r => <span className="text-sm">{formatCurrency(r.total_cash_sales || 0)}</span> },
    { header: "Carte", render: r => <span className="text-sm">{formatCurrency(r.total_card_sales || 0)}</span> },
    { header: "Écart", render: r => {
      const diff = r.difference || 0;
      return <span className={`text-sm font-bold ${diff !== 0 ? 'text-destructive' : 'text-foreground'}`}>{formatCurrency(diff)}</span>;
    }},
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

      {/* Today stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Solde ouverture" value={formatCurrency(todayRegister?.opening_balance || 0)} icon={DollarSign} />
        <StatCard title="Ventes espèces" value={formatCurrency(todayCash)} icon={DollarSign} />
        <StatCard title="Ventes carte" value={formatCurrency(todayCard)} icon={DollarSign} />
        <StatCard title="Solde attendu" value={formatCurrency(expectedBalance)} icon={DollarSign} />
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