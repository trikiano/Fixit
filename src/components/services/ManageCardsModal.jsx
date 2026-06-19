import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ConfirmDialog from "@/components/ui/confirm-dialog";

const emptyCard = { name: '', card_number: '', provider: '', currency: 'TND', current_balance: '', notes: '' };

export default function ManageCardsModal({ open, onClose, cards }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyCard);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PrepaidCard.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prepaid-cards'] }); setShowForm(false); setForm(emptyCard); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PrepaidCard.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prepaid-cards'] }),
  });

  const handleCreate = () => {
    if (!form.name) return;
    createMutation.mutate({ ...form, current_balance: parseFloat(form.current_balance) || 0, total_loaded: parseFloat(form.current_balance) || 0, total_spent: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Gestion des cartes prépayées
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {cards.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
              <div>
                <p className="font-semibold text-sm">{c.name}</p>
                {c.card_number && <p className="text-xs text-muted-foreground font-mono">{c.card_number}</p>}
                {c.provider && <p className="text-xs text-muted-foreground">{c.provider}</p>}
              </div>
              <div className="text-right flex items-center gap-3">
                <div>
                  <p className="font-bold text-primary">{(c.current_balance || 0).toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{c.currency || 'TND'}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {cards.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Aucune carte enregistrée</p>}
        </div>

        {!showForm ? (
          <Button variant="outline" className="w-full gap-2 mt-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />Ajouter une carte
          </Button>
        ) : (
          <div className="border border-border/50 rounded-lg p-4 space-y-3 mt-2">
            <p className="font-semibold text-sm">Nouvelle carte</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nom *</Label>
                <Input className="mt-1" placeholder="Carte Ooredoo Tunisie 1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>N° carte</Label>
                <Input className="mt-1" placeholder="xxxxxxxxxxxx" value={form.card_number} onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))} />
              </div>
              <div>
                <Label>Opérateur</Label>
                <Input className="mt-1" placeholder="Ooredoo, Orange, Tunisie Telecom..." value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} />
              </div>
              <div>
                <Label>Devise</Label>
                <Input className="mt-1" placeholder="TND" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Label>Solde initial</Label>
                <Input className="mt-1" type="number" placeholder="0.00" value={form.current_balance} onChange={e => setForm(f => ({ ...f, current_balance: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Annuler</Button>
              <Button className="flex-1" onClick={handleCreate} disabled={!form.name || createMutation.isPending}>Créer</Button>
            </div>
          </div>
        )}
      </DialogContent>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={v => !v && setDeleteTarget(null)}
        title="Supprimer cette carte ?"
        description="Cette action est irréversible."
        onConfirm={() => { deleteMutation.mutate(deleteTarget); setDeleteTarget(null); }}
      />
    </Dialog>
  );
}