import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { ClipboardList, Plus, Search } from 'lucide-react';
import { format } from 'date-fns';

const categories = [
  { value: 'loyer', label: 'Loyer' },
  { value: 'salaires', label: 'Salaires' },
  { value: 'fournitures', label: 'Fournitures' },
  { value: 'transport', label: 'Transport' },
  { value: 'publicite', label: 'Publicité' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'taxes', label: 'Taxes' },
  { value: 'autre', label: 'Autre' },
];

const emptyForm = { description: '', amount: 0, category: 'autre', payment_method: 'especes', date: format(new Date(), 'yyyy-MM-dd'), notes: '' };

import { useAppSettings } from "@/components/settings/SettingsContext";

export default function Expenses() {
  const { formatCurrency, settings } = useAppSettings();
  const sym = settings.currency_symbol || '€';
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: expenses = [], isLoading } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Expense.update(editing.id, data) : base44.entities.Expense.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); closeDialog(); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const openEdit = (e) => { setEditing(e); setForm({ description: e.description, amount: e.amount, category: e.category || 'autre', payment_method: e.payment_method || 'especes', date: e.date || '', notes: e.notes || '' }); setDialogOpen(true); };

  const filtered = expenses.filter(e => e.description?.toLowerCase().includes(search.toLowerCase()));
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  const columns = [
    { header: "Description", render: r => <span className="text-sm font-medium">{r.description}</span> },
    { header: "Montant", render: r => <span className="text-sm font-bold text-destructive">{formatCurrency(r.amount || 0)}</span> },
    { header: "Catégorie", render: r => <span className="text-xs capitalize">{categories.find(c => c.value === r.category)?.label || r.category}</span> },
    { header: "Paiement", render: r => <span className="text-xs capitalize">{r.payment_method}</span> },
    { header: "Date", render: r => <span className="text-xs text-muted-foreground">{r.date || (r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy') : '-')}</span> },
  ];

  return (
    <div>
      <PageHeader title="Dépenses" subtitle={`Total: ${formatCurrency(totalExpenses)} — ${expenses.length} dépenses`}>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouvelle dépense</Button>
      </PageHeader>
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={ClipboardList} title="Aucune dépense" actionLabel="Ajouter" onAction={() => setDialogOpen(true)} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}
      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Modifier dépense' : 'Nouvelle dépense'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Description *</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Montant ({settings.currency_symbol || 'DT'}) *</Label><Input type="number" value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Paiement</Label>
                <Select value={form.payment_method} onValueChange={v => setForm({...form, payment_method: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="especes">Espèces</SelectItem>
                    <SelectItem value="carte">Carte</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.description || !form.amount}>{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}