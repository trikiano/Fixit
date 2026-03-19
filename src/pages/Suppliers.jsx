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
import { Truck, Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react';
import SupplierDetailPanel from '@/components/suppliers/SupplierDetailPanel';

const emptyForm = { name: '', contact_name: '', phone: '', email: '', address: '', payment_terms: 'comptant', notes: '' };

export default function Suppliers() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailSupplier, setDetailSupplier] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Supplier.update(editing.id, data) : base44.entities.Supplier.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['suppliers'] }); closeDialog(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supplier.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const openEdit = (s) => { setEditing(s); setForm({ name: s.name, contact_name: s.contact_name || '', phone: s.phone, email: s.email || '', address: s.address || '', payment_terms: s.payment_terms || 'comptant', notes: s.notes || '' }); setDialogOpen(true); };

  const filtered = suppliers.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.contact_name?.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { header: "Fournisseur", render: r => (
      <div>
        <p className="font-medium text-sm">{r.name}</p>
        <p className="text-xs text-muted-foreground">{r.contact_name}</p>
      </div>
    )},
    { header: "Téléphone", render: r => <span className="text-sm">{r.phone}</span> },
    { header: "Email", render: r => <span className="text-sm text-muted-foreground">{r.email || '-'}</span> },
    { header: "Conditions", render: r => <span className="text-xs capitalize">{r.payment_terms?.replace('_', ' ')}</span> },
    { header: "Commandes", render: r => <span className="text-sm">{r.total_orders || 0}</span> },
    { header: "Total", render: r => <span className="text-sm font-medium">{(r.total_amount || 0).toFixed(2)} €</span> },
    { header: "Actions", render: r => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setDetailSupplier(r)}><Eye className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { if(confirm('Supprimer ce fournisseur ?')) deleteMutation.mutate(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Fournisseurs" subtitle={`${suppliers.length} fournisseurs`}>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouveau fournisseur</Button>
      </PageHeader>
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Truck} title="Aucun fournisseur" actionLabel="Ajouter" onAction={() => setDialogOpen(true)} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={setDetailSupplier} />
      )}
      <SupplierDetailPanel supplier={detailSupplier} open={!!detailSupplier} onClose={() => setDetailSupplier(null)} />

      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Modifier fournisseur' : 'Nouveau fournisseur'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nom *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>Contact</Label><Input value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Téléphone *</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            </div>
            <div><Label>Adresse</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            <div><Label>Conditions paiement</Label>
              <Select value={form.payment_terms} onValueChange={v => setForm({...form, payment_terms: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="comptant">Comptant</SelectItem>
                  <SelectItem value="30_jours">30 jours</SelectItem>
                  <SelectItem value="60_jours">60 jours</SelectItem>
                  <SelectItem value="90_jours">90 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.phone}>{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}