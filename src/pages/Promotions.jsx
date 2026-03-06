import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { Tag, Plus, Search } from 'lucide-react';

const emptyForm = { name: '', code: '', type: 'pourcentage', value: 0, min_purchase: 0, applicable_to: 'tous', start_date: '', end_date: '', max_uses: 0, is_active: true };

export default function Promotions() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: promos = [], isLoading } = useQuery({ queryKey: ['promotions'], queryFn: () => base44.entities.Promotion.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Promotion.update(editing.id, data) : base44.entities.Promotion.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['promotions'] }); closeDialog(); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, code: p.code || '', type: p.type, value: p.value, min_purchase: p.min_purchase || 0, applicable_to: p.applicable_to || 'tous', start_date: p.start_date || '', end_date: p.end_date || '', max_uses: p.max_uses || 0, is_active: p.is_active !== false });
    setDialogOpen(true);
  };

  const filtered = promos.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()) || p.code?.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { header: "Promotion", render: r => (
      <div>
        <p className="font-medium text-sm">{r.name}</p>
        {r.code && <Badge variant="outline" className="text-xs font-mono mt-1">{r.code}</Badge>}
      </div>
    )},
    { header: "Type", render: r => <span className="text-sm capitalize">{r.type?.replace('_', ' ')}</span> },
    { header: "Valeur", render: r => <span className="text-sm font-bold">{r.type === 'pourcentage' ? `${r.value}%` : `${r.value} €`}</span> },
    { header: "Applicable", render: r => <span className="text-xs capitalize">{r.applicable_to?.replace('_', ' ')}</span> },
    { header: "Utilisation", render: r => <span className="text-sm">{r.current_uses || 0}/{r.max_uses || '∞'}</span> },
    { header: "Actif", render: r => <Badge variant={r.is_active ? "default" : "secondary"} className="text-xs">{r.is_active ? 'Actif' : 'Inactif'}</Badge> },
    { header: "Période", render: r => <span className="text-xs text-muted-foreground">{r.start_date || '-'} → {r.end_date || '-'}</span> },
  ];

  return (
    <div>
      <PageHeader title="Promotions & Fidélité" subtitle={`${promos.length} promotions`}>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouvelle promotion</Button>
      </PageHeader>
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Tag} title="Aucune promotion" actionLabel="Créer" onAction={() => setDialogOpen(true)} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}
      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Modifier promotion' : 'Nouvelle promotion'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nom *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>Code promo</Label><Input value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="EX: SUMMER20" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pourcentage">Pourcentage</SelectItem>
                    <SelectItem value="montant_fixe">Montant fixe</SelectItem>
                    <SelectItem value="produit_offert">Produit offert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valeur {form.type === 'pourcentage' ? '(%)' : '(€)'}</Label><Input type="number" value={form.value} onChange={e => setForm({...form, value: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Achat minimum (€)</Label><Input type="number" value={form.min_purchase} onChange={e => setForm({...form, min_purchase: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Utilisations max</Label><Input type="number" value={form.max_uses} onChange={e => setForm({...form, max_uses: parseInt(e.target.value) || 0})} placeholder="0 = illimité" /></div>
            </div>
            <div><Label>Applicable à</Label>
              <Select value={form.applicable_to} onValueChange={v => setForm({...form, applicable_to: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tous">Tous</SelectItem>
                  <SelectItem value="vente">Ventes</SelectItem>
                  <SelectItem value="reparation">Réparations</SelectItem>
                  <SelectItem value="categorie_specifique">Catégorie spécifique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date début</Label><Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
              <div><Label>Date fin</Label><Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm({...form, is_active: v})} />
              <Label>Active</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name}>{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}