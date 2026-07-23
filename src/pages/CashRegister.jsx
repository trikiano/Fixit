import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";
import StatCard from "@/components/ui/StatCard";
import CashRegisterDetail from "@/components/cashregister/CashRegisterDetail";
import { DollarSign, Lock, Unlock, BookOpen, Package, Tag, Wrench, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAppSettings } from "@/components/settings/SettingsContext";
import { useAuth } from "@/lib/AuthContext";

function itemType(item) {
  if (!item) return 'product';
  if (item.product_id) return 'product';
  const name = item.product_name || '';
  if (name.startsWith('🔧')) return 'repair';
  return 'service';
}

export default function CashRegister() {
  const { formatCurrency, settings } = useAppSettings();
  const { isResponsableOrAbove } = useAuth();
  const sym = settings.currency_symbol || 'DT';
  const [openDialog, setOpenDialog] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [showCloseTicket, setShowCloseTicket] = useState(false);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [differenceReason, setDifferenceReason] = useState('');
  const [selectedRegister, setSelectedRegister] = useState(null);
  const qc = useQueryClient();

  const { data: registers = [], isLoading } = useQuery({ queryKey: ['cashRegisters'], queryFn: () => base44.entities.CashRegister.list('-created_date') });
  const { data: sales = [] } = useQuery({ queryKey: ['salesToday'], queryFn: () => base44.entities.Sale.list('-created_date', 200) });
  const { data: expenses = [] } = useQuery({ queryKey: ['expensesToday'], queryFn: () => base44.entities.Expense.list('-created_date', 100) });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayRegister = registers.find(r => r.date === todayStr);
  const todaySalesAll = sales.filter(s => s.created_date?.startsWith(todayStr));
  const todaySales = todaySalesAll.filter(s => s.status !== 'non_payee');
  const todayArdoiseSales = todaySalesAll.filter(s => s.status === 'non_payee');
  const todayRetours = todaySales.filter(s => s.type === 'retour');
  const todayVentes = todaySales.filter(s => s.type !== 'retour');
  const sign = s => s.type === 'retour' ? -1 : 1;
  const todayArdoise = todayArdoiseSales.reduce((s, v) => s + (v.total || 0), 0);
  const todayCash = todaySales.filter(s => s.payment_method === 'especes').reduce((s, v) => s + sign(v) * (v.total || 0), 0);
  const todayCard = todaySales.filter(s => s.payment_method === 'carte').reduce((s, v) => s + sign(v) * (v.total || 0), 0);
  const todayExpenses = expenses.filter(e => e.date === todayStr || e.created_date?.startsWith(todayStr)).reduce((s, e) => s + (e.amount || 0), 0);
  const expectedBalance = (todayRegister?.opening_balance || 0) + todayCash - todayExpenses;

  // Catégorisation des articles
  const allVenteItems = todayVentes.flatMap(s => s.items || []);
  const produitItems = allVenteItems.filter(i => i.product_id);
  const reparationItems = allVenteItems.filter(i => !i.product_id && i.product_name?.startsWith('🔧'));
  const serviceItems = allVenteItems.filter(i => !i.product_id && !i.product_name?.startsWith('🔧'));
  const produitTotal = produitItems.reduce((s, i) => s + (i.total || 0), 0);
  const reparationTotal = reparationItems.reduce((s, i) => s + (i.total || 0), 0);
  const serviceTotal = serviceItems.reduce((s, i) => s + (i.total || 0), 0);
  const retourTotal = todayRetours.reduce((s, r) => s + (r.total || 0), 0);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashRegisters'] });
      setCloseDialogOpen(false);
      setShowCloseTicket(true);
    },
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

  const diff = closingBalance - expectedBalance;

  return (
    <div>
      <PageHeader title="Caisse" subtitle="Gestion de la caisse quotidienne">
        {!todayRegister ? (
          <Button onClick={() => setOpenDialog(true)}><Unlock className="h-4 w-4 mr-2" />Ouvrir la caisse</Button>
        ) : todayRegister.status === 'ouverte' ? (
          isResponsableOrAbove ? <Button variant="destructive" onClick={() => setCloseDialogOpen(true)}><Lock className="h-4 w-4 mr-2" />Fermer la caisse</Button> : null
        ) : null}
      </PageHeader>

      {/* Stats du jour */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard title="Solde ouverture" value={formatCurrency(todayRegister?.opening_balance || 0)} icon={DollarSign} />
        <StatCard title="Ventes espèces" value={formatCurrency(todayCash)} icon={DollarSign} />
        <StatCard title="Ventes carte" value={formatCurrency(todayCard)} icon={DollarSign} />
        <StatCard title="Ardoises (non payé)" value={formatCurrency(todayArdoise)} icon={BookOpen} />
        <StatCard title="Solde attendu" value={formatCurrency(expectedBalance)} icon={DollarSign} />
      </div>

      <DataTable columns={columns} data={registers} isLoading={isLoading} emptyMessage="Aucune caisse enregistrée" onRowClick={setSelectedRegister} />

      {selectedRegister && (
        <CashRegisterDetail register={selectedRegister} onClose={() => setSelectedRegister(null)} />
      )}

      {/* Dialog Ouverture */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ouvrir la caisse</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Solde d'ouverture ({sym})</Label><Input type="number" value={openingBalance} onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)} /></div>
            <Button onClick={() => openMutation.mutate()} className="w-full">Ouvrir</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Fermeture */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" />Fermer la caisse</DialogTitle></DialogHeader>
          <div className="space-y-4">

            {/* Récap journée avant fermeture */}
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5 text-sm">
              <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Récap de la journée</p>
              <div className="flex justify-between"><span className="text-muted-foreground">Ouverture</span><span className="font-medium">{formatCurrency(todayRegister?.opening_balance || 0)}</span></div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>+ Espèces reçues</span><span className="font-medium">{formatCurrency(Math.max(0, todayCash))}</span></div>
              {todayCard > 0 && <div className="flex justify-between text-blue-600 dark:text-blue-400"><span>+ Carte</span><span className="font-medium">{formatCurrency(todayCard)}</span></div>}
              {todayExpenses > 0 && <div className="flex justify-between text-destructive"><span>− Dépenses</span><span className="font-medium">{formatCurrency(todayExpenses)}</span></div>}
              {todayRetours.length > 0 && <div className="flex justify-between text-rose-600 dark:text-rose-400"><span>− Retours ({todayRetours.length})</span><span className="font-medium">{formatCurrency(retourTotal)}</span></div>}
              {todayArdoise > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" />Ardoises non encaissées ({todayArdoiseSales.length})</span>
                  <span className="font-medium">−{formatCurrency(todayArdoise)}</span>
                </div>
              )}
              <div className="border-t border-border pt-1.5 flex justify-between font-bold">
                <span>Solde attendu en caisse</span>
                <span className="text-primary">{formatCurrency(expectedBalance)}</span>
              </div>
            </div>

            {todayArdoise > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span><strong>{formatCurrency(todayArdoise)}</strong> en ardoise ne sont pas dans la caisse physique. Ces montants sont suivis séparément.</span>
              </div>
            )}

            <div><Label>Solde de fermeture réel ({sym})</Label><Input type="number" value={closingBalance} onChange={e => setClosingBalance(parseFloat(e.target.value) || 0)} /></div>

            <div className="p-3 rounded-lg bg-muted/30">
              <p className="text-sm text-muted-foreground">Solde attendu : <span className="font-bold text-foreground">{formatCurrency(expectedBalance)}</span></p>
              <p className="text-sm text-muted-foreground">
                Écart : <span className={cn("font-bold", diff !== 0 ? 'text-destructive' : 'text-foreground')}>{diff > 0 ? '+' : ''}{formatCurrency(diff)}</span>
              </p>
            </div>

            {diff !== 0 && (
              <div><Label>Raison de l'écart *</Label><Textarea value={differenceReason} onChange={e => setDifferenceReason(e.target.value)} placeholder="Justification obligatoire..." /></div>
            )}

            <Button onClick={() => closeMutation.mutate()} className="w-full" disabled={(diff !== 0 && !differenceReason) || closeMutation.isPending}>
              <Lock className="h-4 w-4 mr-2" />
              {closeMutation.isPending ? 'Fermeture...' : 'Confirmer la fermeture'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket de clôture */}
      <Dialog open={showCloseTicket} onOpenChange={setShowCloseTicket}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              Ticket de clôture — {format(new Date(), 'dd MMMM yyyy', { locale: fr })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">

            {/* Résumé financier */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 border-b border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Résumé financier</p>
              </div>
              <div className="px-4 py-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solde d'ouverture</span>
                  <span className="font-medium">{formatCurrency(todayRegister?.opening_balance || 0)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>+ Encaissements espèces</span>
                  <span className="font-medium">{formatCurrency(Math.max(0, todayCash))}</span>
                </div>
                {todayCard > 0 && (
                  <div className="flex justify-between text-blue-600 dark:text-blue-400">
                    <span>+ Encaissements carte</span>
                    <span className="font-medium">{formatCurrency(todayCard)}</span>
                  </div>
                )}
                {todayExpenses > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>− Dépenses</span>
                    <span className="font-medium">{formatCurrency(todayExpenses)}</span>
                  </div>
                )}
                {retourTotal > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>− Remboursements retours</span>
                    <span className="font-medium">{formatCurrency(retourTotal)}</span>
                  </div>
                )}
                <div className="border-t border-border/50 pt-1.5 space-y-1">
                  <div className="flex justify-between font-semibold">
                    <span>Solde attendu en caisse</span>
                    <span className="text-primary">{formatCurrency(expectedBalance)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Solde réel constaté</span>
                    <span>{formatCurrency(closingBalance)}</span>
                  </div>
                  <div className={cn("flex justify-between font-bold text-base border-t border-border pt-1", (closingBalance - expectedBalance) !== 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                    <span>Écart</span>
                    <span>{closingBalance - expectedBalance > 0 ? '+' : ''}{formatCurrency(closingBalance - expectedBalance)}</span>
                  </div>
                  {differenceReason && (
                    <p className="text-xs text-muted-foreground italic">💬 {differenceReason}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Ventes par catégorie */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/40 px-4 py-2 border-b border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ventes par catégorie — {todayVentes.length} ticket(s)
                </p>
              </div>
              <div className="divide-y divide-border/50">
                {/* Produits */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 font-medium text-blue-600 dark:text-blue-400">
                      <Package className="h-4 w-4" /> Produits ({produitItems.length} article{produitItems.length > 1 ? 's' : ''})
                    </span>
                    <span className="font-bold">{formatCurrency(produitTotal)}</span>
                  </div>
                  {produitItems.length > 0 && (
                    <div className="ml-6 space-y-0.5">
                      {produitItems.slice(0, 8).map((it, i) => (
                        <div key={i} className="flex justify-between text-xs text-muted-foreground">
                          <span>{it.product_name} × {it.quantity}</span>
                          <span>{formatCurrency(it.total || 0)}</span>
                        </div>
                      ))}
                      {produitItems.length > 8 && <p className="text-xs text-muted-foreground">+ {produitItems.length - 8} autres...</p>}
                    </div>
                  )}
                </div>

                {/* Services */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                      <Tag className="h-4 w-4" /> Services ({serviceItems.length} prestation{serviceItems.length > 1 ? 's' : ''})
                    </span>
                    <span className="font-bold">{formatCurrency(serviceTotal)}</span>
                  </div>
                  {serviceItems.length > 0 && (
                    <div className="ml-6 space-y-0.5">
                      {serviceItems.slice(0, 5).map((it, i) => (
                        <div key={i} className="flex justify-between text-xs text-muted-foreground">
                          <span>{it.product_name} × {it.quantity}</span>
                          <span>{formatCurrency(it.total || 0)}</span>
                        </div>
                      ))}
                      {serviceItems.length > 5 && <p className="text-xs text-muted-foreground">+ {serviceItems.length - 5} autres...</p>}
                    </div>
                  )}
                </div>

                {/* Réparations */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-2 font-medium text-orange-600 dark:text-orange-400">
                      <Wrench className="h-4 w-4" /> Réparations ({reparationItems.length})
                    </span>
                    <span className="font-bold">{formatCurrency(reparationTotal)}</span>
                  </div>
                  {reparationItems.length > 0 && (
                    <div className="ml-6 space-y-0.5">
                      {reparationItems.slice(0, 5).map((it, i) => (
                        <div key={i} className="flex justify-between text-xs text-muted-foreground">
                          <span>{it.product_name}</span>
                          <span>{formatCurrency(it.total || 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Retours */}
            {todayRetours.length > 0 && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-800 overflow-hidden">
                <div className="bg-rose-50/50 dark:bg-rose-950/20 px-4 py-2 border-b border-rose-200 dark:border-rose-800">
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Retours — {todayRetours.length} transaction(s)
                  </p>
                </div>
                <div className="px-4 py-3 space-y-1.5">
                  {todayRetours.map((r, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{r.sale_number}</p>
                        <p className="text-xs text-muted-foreground">{r.client_name || 'Client anonyme'} · {r.payment_method === 'especes' ? '💵' : r.payment_method === 'carte' ? '💳' : '🎫'} {r.payment_method}</p>
                      </div>
                      <span className="font-bold text-rose-600 dark:text-rose-400">−{formatCurrency(r.total || 0)}</span>
                    </div>
                  ))}
                  <div className="border-t border-rose-200 dark:border-rose-800 pt-1.5 flex justify-between font-bold text-rose-600 dark:text-rose-400">
                    <span>Total remboursé</span>
                    <span>−{formatCurrency(retourTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Ardoises */}
            {todayArdoiseSales.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 overflow-hidden">
                <div className="bg-amber-50/50 dark:bg-amber-950/20 px-4 py-2 border-b border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5" /> Ardoises — Non encaissé ({todayArdoiseSales.length})
                  </p>
                </div>
                <div className="px-4 py-3 space-y-3">
                  {todayArdoiseSales.map((s, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-amber-700 dark:text-amber-400">👤 {s.client_name || 'Non identifié'}</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(s.total || 0)}</span>
                      </div>
                      {(s.items || []).map((it, j) => (
                        <div key={j} className="ml-4 flex justify-between text-xs text-muted-foreground">
                          <span>{it.product_name} × {it.quantity}</span>
                          <span>{formatCurrency(it.total || 0)}</span>
                        </div>
                      ))}
                      {s.notes && <p className="ml-4 text-xs text-amber-600 dark:text-amber-400 italic">💬 {s.notes}</p>}
                    </div>
                  ))}
                  <div className="border-t border-amber-200 dark:border-amber-800 pt-1.5 flex justify-between font-bold text-amber-700 dark:text-amber-400">
                    <span>Total ardoises</span>
                    <span>{formatCurrency(todayArdoise)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Note explicative */}
            <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm">📋 Note explicative</p>
              <p>
                <strong>Solde attendu</strong> = Ouverture + Espèces encaissées − Dépenses − Remboursements.
                Il représente le montant théorique qui doit physiquement être dans la caisse.
              </p>
              {todayArdoise > 0 && (
                <p>
                  <strong>Ardoises ({formatCurrency(todayArdoise)})</strong> : ces ventes ont quitté le magasin sans règlement immédiat.
                  Elles ne sont PAS incluses dans le solde attendu et doivent être récupérées auprès des personnes concernées.
                </p>
              )}
              {todayRetours.length > 0 && (
                <p>
                  <strong>Retours ({formatCurrency(retourTotal)})</strong> : montants remboursés aux clients, déjà déduits du solde espèces.
                </p>
              )}
              {(closingBalance - expectedBalance) !== 0 && (
                <p className="text-destructive font-medium">
                  ⚠️ Un écart de <strong>{formatCurrency(Math.abs(closingBalance - expectedBalance))}</strong> a été constaté.
                  {differenceReason ? ` Raison : ${differenceReason}` : ' Aucune raison fournie.'}
                </p>
              )}
            </div>

            <Button className="w-full" onClick={() => setShowCloseTicket(false)}>
              <CheckCircle className="h-4 w-4 mr-2" /> Fermer le ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
