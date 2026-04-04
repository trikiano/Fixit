import React, { useState } from 'react';
import { fixit } from '@/api/fixitClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { Shield, Plus, Search } from 'lucide-react';

const emptyForm = { type: 'vente', reference_number: '', client_name: '', product_name: '', start_date: '', end_date: '', status: 'active', claim_description: '', resolution: 'reparation', resolution_notes: '', notes: '' };

export default function Warranties() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: warranties = [], isLoading } = useQuery({ queryKey: ['warranties'], queryFn: () => fixit.entities.Warranty.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? fixit.entities.Warranty.update(editing.id, data) : fixit.entities.Warranty.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warranties'] }); closeDialog(); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const openEdit = (w) => {
    setEditing(w);
    setForm({ type: w.type, reference_number: w.reference_number || '', client_name: w.client_name, product_name: w.product_name, start_date: w.start_date || '', end_date: w.end_date || '', status: w.status || 'active', claim_description: w.claim_description || '', resolution: w.resolution || 'reparation', resolution_notes: w.resolution_notes || '', notes: w.notes || '' });
    setDialogOpen(true);
  };

  const filtered = warranties.filter(w => {
    const ms = w.client_name?.toLowerCase().includes(search.toLowerCase()) || w.product_name?.toLowerCase().includes(search.toLowerCase());
    const mf = statusFilter === 'all' || w.status === statusFilter;
    return ms && mf;
  });

  const columns = [
    { header: "Type", render: r => <span className="text-sm capitalize">{r.type}</span> },
    { header: "Référence", render: r => <span className="text-sm font-mono">{r.reference_number || '-'}</span> },
    { header: "Client", render: r => <span className="text-sm">{r.client_name}</span> },
    { header: "Produit", render: r => <span className="text-sm">{r.product_name}</span> },
    { header: "Début", render: r => <span className="text-xs">{r.start_date || '-'}</span> },
    { header: "Fin", render: r => <span className="text-xs">{r.end_date || '-'}</span> },
    { header: "Statut", render: r => <StatusBadge status={r.status} /> },
  ];

  return (
    <div>
      <PageHeader title="Garanties & SAV" subtitle={`${warranties.length} garanties`}>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouvelle garantie</Button>
      </PageHeader>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expiree">Expirée</SelectItem>
            <SelectItem value="utilisee">Utilisée</SelectItem>
            <SelectItem value="annulee">Annulée</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Shield} title="Aucune garantie" actionLabel="Créer" onAction={() => setDialogOpen(true)} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}
      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Modifier garantie' : 'Nouvelle garantie'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="vente">Vente</SelectItem><SelectItem value="reparation">Réparation</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Statut</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem><SelectItem value="expiree">Expirée</SelectItem>
                    <SelectItem value="utilisee">Utilisée</SelectItem><SelectItem value="annulee">Annulée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>N° Référence</Label><Input value={form.reference_number} onChange={e => setForm({...form, reference_number: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Client *</Label><Input value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} /></div>
              <div><Label>Produit *</Label><Input value={form.product_name} onChange={e => setForm({...form, product_name: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date début *</Label><Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
              <div><Label>Date fin *</Label><Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
            </div>
            <div><Label>Description réclamation</Label><Textarea value={form.claim_description} onChange={e => setForm({...form, claim_description: e.target.value})} /></div>
            <div><Label>Résolution</Label>
              <Select value={form.resolution} onValueChange={v => setForm({...form, resolution: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="remplacement">Remplacement</SelectItem><SelectItem value="reparation">Réparation</SelectItem>
                  <SelectItem value="remboursement">Remboursement</SelectItem><SelectItem value="avoir">Avoir</SelectItem><SelectItem value="rejet">Rejet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notes résolution</Label><Textarea value={form.resolution_notes} onChange={e => setForm({...form, resolution_notes: e.target.value})} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.client_name || !form.product_name || !form.start_date || !form.end_date}>{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}