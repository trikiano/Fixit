import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wifi, Plus, Trash2, Pencil, Power } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAppSettings } from '@/components/settings/SettingsContext';
import ConfirmDialog from "@/components/ui/confirm-dialog";

const emptyForm = { name: '', data_amount: '', validity_days: '', sell_price: '', cost_price: '' };

export default function ManagePackagesModal({ open, onClose, packages }) {
  const { formatCurrency, settings } = useAppSettings();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['internet-packages'] });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.InternetPackage.update(editing.id, data) : base44.entities.InternetPackage.create(data),
    onSuccess: () => { invalidate(); closeForm(); },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, is_active }) => base44.entities.InternetPackage.update(id, { is_active }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InternetPackage.delete(id),
    onSuccess: invalidate,
  });

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); };

  const openEdit = (pkg) => {
    setEditing(pkg);
    setForm({
      name: pkg.name || '',
      data_amount: pkg.data_amount || '',
      validity_days: pkg.validity_days || '',
      sell_price: pkg.sell_price ?? '',
      cost_price: pkg.cost_price ?? '',
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.name || !form.sell_price) return;
    saveMutation.mutate({
      ...form,
      validity_days: parseInt(form.validity_days) || 0,
      sell_price: parseFloat(form.sell_price) || 0,
      cost_price: parseFloat(form.cost_price) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Gestion des forfaits internet
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {packages.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{p.name}</p>
                  <Badge variant={p.is_active !== false ? 'default' : 'outline'} className="text-xs">
                    {p.is_active !== false ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {p.data_amount || '—'} {p.validity_days ? `• ${p.validity_days}j` : ''} • Coût {formatCurrency(p.cost_price || 0)} → Vente {formatCurrency(p.sell_price || 0)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" title={p.is_active !== false ? 'Désactiver' : 'Activer'}
                  onClick={() => toggleActiveMutation.mutate({ id: p.id, is_active: p.is_active === false })}>
                  <Power className={`h-3.5 w-3.5 ${p.is_active !== false ? 'text-green-500' : 'text-muted-foreground'}`} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(p.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {packages.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Aucun forfait configuré</p>}
        </div>

        {!showForm ? (
          <Button variant="outline" className="w-full gap-2 mt-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />Ajouter un forfait
          </Button>
        ) : (
          <div className="border border-border/50 rounded-lg p-4 space-y-3 mt-2">
            <p className="font-semibold text-sm">{editing ? 'Modifier le forfait' : 'Nouveau forfait'}</p>
            <div>
              <Label>Nom *</Label>
              <Input className="mt-1" placeholder="20GB - 30 jours" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Volume données</Label>
                <Input className="mt-1" placeholder="ex: 20GB" value={form.data_amount} onChange={e => setForm(f => ({ ...f, data_amount: e.target.value }))} />
              </div>
              <div>
                <Label>Validité (jours)</Label>
                <Input className="mt-1" type="number" placeholder="30" value={form.validity_days} onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prix coûtant ({settings.currency_symbol})</Label>
                <Input className="mt-1" type="number" placeholder="0.00" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} />
              </div>
              <div>
                <Label>Prix vente ({settings.currency_symbol}) *</Label>
                <Input className="mt-1" type="number" placeholder="0.00" value={form.sell_price} onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={closeForm}>Annuler</Button>
              <Button className="flex-1" onClick={handleSave} disabled={!form.name || !form.sell_price || saveMutation.isPending}>
                {editing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={v => !v && setDeleteTarget(null)}
        title="Supprimer ce forfait ?"
        description="Cette action est irréversible."
        onConfirm={() => { deleteMutation.mutate(deleteTarget); setDeleteTarget(null); }}
      />
    </Dialog>
  );
}
