import React, { useState } from 'react';
import { fixit } from '@/api/fixitClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import EntityRefSelect from "@/components/ui/EntityRefSelect";
import { FileText, Plus, Search, CreditCard, History, AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAppSettings } from "@/components/settings/SettingsContext";

const statusConfig = {
  en_attente: { label: 'En attente', class: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  partielle: { label: 'Partielle', class: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  soldee: { label: 'Soldée', class: 'bg-green-500/20 text-green-400 border-green-500/30' },
  annulee: { label: 'Annulée', class: 'bg-muted text-muted-foreground' },
};

const emptyForm = {
  supplier_id: '', supplier_name: '', description: '', invoice_number: '',
  invoice_date: format(new Date(), 'yyyy-MM-dd'), due_date: '',
  total_amount: '', notes: '',
};

export default function SupplierInvoices() {
  const { formatCurrency } = useAppSettings();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'especes', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
  const [filterSupplier, setFilterSupplier] = useState('');
  const qc = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({ queryKey: ['supplierInvoices'], queryFn: () => fixit.entities.SupplierInvoice.list('-created_date') });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => fixit.entities.Supplier.list() });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const total = parseFloat(data.total_amount) || 0;
      const invNum = data.invoice_number || `FACT-${Date.now().toString(36).toUpperCase()}`;
      return fixit.entities.SupplierInvoice.create({ ...data, invoice_number: invNum, total_amount: total, amount_paid: 0, remaining_debt: total, status: 'en_attente', payments: [] });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['supplierInvoices'] }); setDialogOpen(false); setForm(emptyForm); },
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ invoice, payment }) => {
      const amount = parseFloat(payment.amount) || 0;
      const newPaid = (invoice.amount_paid || 0) + amount;
      const newRemaining = invoice.total_amount - newPaid;
      const newStatus = newRemaining <= 0 ? 'soldee' : 'partielle';
      const newPayments = [...(invoice.payments || []), { date: payment.date, amount, method: payment.method, notes: payment.notes }];
      const updated = await fixit.entities.SupplierInvoice.update(invoice.id, {
        amount_paid: newPaid, remaining_debt: Math.max(newRemaining, 0),
        status: newStatus, payments: newPayments,
      });
      // Créer automatiquement une dépense pour ce paiement
      await fixit.entities.Expense.create({
        description: `Paiement facture ${invoice.invoice_number} — ${invoice.supplier_name}`,
        amount,
        category: 'fournitures',
        payment_method: payment.method,
        date: payment.date,
        notes: payment.notes || `Facture fournisseur ${invoice.invoice_number}`,
      });
      return updated;
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['supplierInvoices'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setSelected(updated);
      setPaymentOpen(false);
      setPaymentForm({ amount: '', method: 'especes', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    },
  });

  const openDetail = (inv) => { setSelected(inv); setDetailOpen(true); };
  const openPayment = (inv) => { setSelected(inv); setPaymentForm({ amount: String(inv.remaining_debt || ''), method: 'especes', date: format(new Date(), 'yyyy-MM-dd'), notes: '' }); setPaymentOpen(true); };

  const filtered = invoices.filter(inv => {
    const matchSearch = inv.supplier_name?.toLowerCase().includes(search.toLowerCase()) || inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) || inv.description?.toLowerCase().includes(search.toLowerCase());
    const matchSupplier = !filterSupplier || inv.supplier_id === filterSupplier;
    return matchSearch && matchSupplier;
  });

  const totalDebt = invoices.reduce((s, inv) => s + (inv.remaining_debt || 0), 0);
  const totalPending = invoices.filter(i => i.status !== 'soldee' && i.status !== 'annulee').length;

  const columns = [
    { header: "N° Facture", render: r => <span className="font-mono text-sm text-primary">{r.invoice_number}</span> },
    { header: "Fournisseur", render: r => <span className="text-sm font-medium">{r.supplier_name}</span> },
    { header: "Description", render: r => <span className="text-xs text-muted-foreground truncate max-w-[150px] block">{r.description}</span> },
    { header: "Total", render: r => <span className="text-sm font-bold">{formatCurrency(r.total_amount || 0)}</span> },
    { header: "Payé", render: r => <span className="text-sm text-green-400">{formatCurrency(r.amount_paid || 0)}</span> },
    { header: "Reste dû", render: r => <span className={`text-sm font-bold ${(r.remaining_debt || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>{formatCurrency(r.remaining_debt || 0)}</span> },
    { header: "Statut", render: r => { const s = statusConfig[r.status] || {}; return <Badge variant="outline" className={s.class}>{s.label}</Badge>; } },
    { header: "Actions", render: r => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        {r.status !== 'soldee' && r.status !== 'annulee' && (
          <Button size="sm" variant="outline" className="gap-1 text-green-400 border-green-500/40 hover:bg-green-500/10 text-xs" onClick={() => openPayment(r)}>
            <CreditCard className="h-3 w-3" /> Payer
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => openDetail(r)}><History className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Factures Fournisseurs" subtitle={`${totalPending} impayée(s) — Dette totale: ${formatCurrency(totalDebt)}`}>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouvelle facture</Button>
      </PageHeader>

      {/* Résumé par fournisseur */}
      {totalDebt > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {suppliers.filter(s => invoices.some(i => i.supplier_id === s.id && (i.remaining_debt || 0) > 0)).map(s => {
            const debt = invoices.filter(i => i.supplier_id === s.id).reduce((sum, i) => sum + (i.remaining_debt || 0), 0);
            return (
              <Card key={s.id} className="cursor-pointer border-red-500/20 hover:border-red-500/40" onClick={() => setFilterSupplier(filterSupplier === s.id ? '' : s.id)}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground truncate">{s.name}</p>
                  <p className="text-lg font-bold text-red-400">{formatCurrency(debt)}</p>
                  <p className="text-xs text-muted-foreground">dette</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex gap-3 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterSupplier} onValueChange={setFilterSupplier}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tous les fournisseurs" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Tous les fournisseurs</SelectItem>
            {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={FileText} title="Aucune facture" actionLabel="Créer" onAction={() => setDialogOpen(true)} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openDetail} />
      )}

      {/* Créer facture */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle facture fournisseur</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fournisseur *</Label>
                <EntityRefSelect
                  entityType="supplier"
                  value={form.supplier_id}
                  onChange={(v, label) => setForm({ ...form, supplier_id: v, supplier_name: label || suppliers.find(s => s.id === v)?.name || '' })}
                />
              </div>
              <div><Label>N° Facture</Label><Input value={form.invoice_number} onChange={e => setForm({ ...form, invoice_number: e.target.value })} placeholder="Auto-généré si vide" /></div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Montant total *</Label><Input type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
              <div><Label>Date facture</Label><Input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} /></div>
            </div>
            <div><Label>Date échéance</Label><Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={() => createMutation.mutate(form)} disabled={!form.supplier_id || !form.total_amount}>Créer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payer */}
      <Dialog open={paymentOpen} onOpenChange={v => !v && setPaymentOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-green-400" /> Enregistrer un paiement</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 text-sm space-y-1">
                <p><span className="text-muted-foreground">Fournisseur:</span> <strong>{selected.supplier_name}</strong></p>
                <p><span className="text-muted-foreground">Facture:</span> {selected.invoice_number}</p>
                <p><span className="text-muted-foreground">Reste à payer:</span> <strong className="text-red-400">{formatCurrency(selected.remaining_debt || 0)}</strong></p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Montant payé *</Label><Input type="number" value={paymentForm.amount} max={selected.remaining_debt} onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></div>
                <div><Label>Date</Label><Input type="date" value={paymentForm.date} onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })} /></div>
              </div>
              <div><Label>Mode de paiement</Label>
                <Select value={paymentForm.method} onValueChange={v => setPaymentForm({ ...paymentForm, method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="especes">Espèces</SelectItem>
                    <SelectItem value="carte">Carte</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Input value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })} /></div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPaymentOpen(false)}>Annuler</Button>
                <Button onClick={() => paymentMutation.mutate({ invoice: selected, payment: paymentForm })} disabled={!paymentForm.amount} className="bg-green-600 hover:bg-green-700 text-white">Confirmer le paiement</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Détail + Historique */}
      <Dialog open={detailOpen} onOpenChange={v => !v && setDetailOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Historique — {selected?.invoice_number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                  <p className="text-muted-foreground text-xs">Fournisseur</p>
                  <p className="font-medium">{selected.supplier_name}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                  <p className="text-muted-foreground text-xs">Statut</p>
                  <Badge variant="outline" className={statusConfig[selected.status]?.class}>{statusConfig[selected.status]?.label}</Badge>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                  <p className="text-muted-foreground text-xs">Total facture</p>
                  <p className="font-bold text-lg">{formatCurrency(selected.total_amount || 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                  <p className="text-muted-foreground text-xs">Reste dû</p>
                  <p className={`font-bold text-lg ${(selected.remaining_debt || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>{formatCurrency(selected.remaining_debt || 0)}</p>
                </div>
              </div>
              {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
              <Separator />
              <div>
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><History className="h-4 w-4" /> Historique des paiements</h4>
                {(selected.payments || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun paiement enregistré</p>
                ) : (
                  <div className="space-y-2">
                    {(selected.payments || []).map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                        <div>
                          <p className="font-medium text-green-400">+{formatCurrency(p.amount || 0)}</p>
                          <p className="text-xs text-muted-foreground">{p.method} — {p.date}</p>
                          {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                        </div>
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t border-border text-sm">
                      <span className="text-muted-foreground">Total payé</span>
                      <span className="font-bold text-green-400">{formatCurrency(selected.amount_paid || 0)}</span>
                    </div>
                  </div>
                )}
              </div>
              {selected.status !== 'soldee' && (
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => { setDetailOpen(false); openPayment(selected); }}>
                  <CreditCard className="h-4 w-4 mr-2" /> Enregistrer un paiement
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}