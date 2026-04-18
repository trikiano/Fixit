import React, { useState } from 'react';
import { fixit } from '@/api/fixitClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import ClientDetailPanel from "@/components/clients/ClientDetailPanel";
import { Users, Plus, Search, Phone, Mail, Ban, Star, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import PhoneInput from '@/components/ui/PhoneInput';

export default function Clients() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', address: '', segment: 'particulier', notes: '', credit_balance: 0 });
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => fixit.entities.Client.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editingClient ? fixit.entities.Client.update(editingClient.id, data) : fixit.entities.Client.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); closeDialog(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => fixit.entities.Client.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });
  const toggleBlacklistMutation = useMutation({
    mutationFn: ({ id, val }) => fixit.entities.Client.update(id, { is_blacklisted: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditingClient(null); setForm({ full_name: '', phone: '', email: '', address: '', segment: 'particulier', notes: '', credit_balance: 0 }); };
  const openEdit = (c) => { setEditingClient(c); setForm({ full_name: c.full_name, phone: c.phone, email: c.email || '', address: c.address || '', segment: c.segment || 'particulier', notes: c.notes || '', credit_balance: c.credit_balance || 0 }); setDialogOpen(true); };

  const filtered = clients.filter(c =>
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { header: "Client", render: (r) => (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
          {r.full_name?.[0]}
        </div>
        <div>
          <p className="font-medium text-sm">{r.full_name}</p>
          <p className="text-xs text-muted-foreground">{r.email}</p>
        </div>
        {r.is_blacklisted && <Ban className="h-3.5 w-3.5 text-destructive" />}
      </div>
    )},
    { header: "Téléphone", render: (r) => <span className="text-sm">{r.phone}</span> },
    { header: "Segment", render: (r) => <StatusBadge status={r.segment} /> },
    { header: "Crédit", render: (r) => <span className="text-sm font-medium">{(r.credit_balance || 0).toFixed(2)}</span> },
    { header: "Points", render: (r) => <span className="text-sm">{r.loyalty_points || 0}</span> },
    { header: "Date", render: (r) => <span className="text-xs text-muted-foreground">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy') : '-'}</span> },
    { header: "Actions", render: (r) => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { if(confirm('Supprimer ce client ?')) deleteMutation.mutate(r.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Clients" subtitle={`${clients.length} clients enregistrés`}>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouveau client</Button>
      </PageHeader>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Users} title="Aucun client" description="Ajoutez votre premier client" actionLabel="Ajouter" onAction={() => setDialogOpen(true)} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={setSelectedClient} />
      )}

      {selectedClient && (
        <ClientDetailPanel client={selectedClient} onClose={() => setSelectedClient(null)} />
      )}

      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingClient ? 'Modifier client' : 'Nouveau client'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nom complet *</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} /></div>
              <div><Label>Téléphone *</Label><PhoneInput value={form.phone} onChange={v => setForm({...form, phone: v})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div><Label>Segment</Label>
                <Select value={form.segment} onValueChange={v => setForm({...form, segment: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="particulier">Particulier</SelectItem>
                    <SelectItem value="professionnel">Professionnel</SelectItem>
                    <SelectItem value="revendeur">Revendeur</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Adresse</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            <div><Label>Crédit client</Label><Input type="number" value={form.credit_balance} onChange={e => setForm({...form, credit_balance: parseFloat(e.target.value) || 0})} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            {editingClient && (
              <div className="flex items-center gap-3">
                <Switch checked={editingClient.is_blacklisted} onCheckedChange={val => toggleBlacklistMutation.mutate({ id: editingClient.id, val })} />
                <Label className="text-destructive">Blacklisté</Label>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.full_name || !form.phone}>
                {editingClient ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}