import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Plus } from 'lucide-react';
import { useAppSettings } from "@/components/settings/SettingsContext";

export default function CardTopupModal({ open, onClose, cards, onSave }) {
  const [cardId, setCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCard = cards.find(c => c.id === cardId);

  const handleSave = async () => {
    if (!cardId || !amount || parseFloat(amount) <= 0) return;
    setSaving(true);
    await onSave({
      card_id: cardId,
      card_name: selectedCard?.name,
      amount: parseFloat(amount),
      date: new Date().toISOString(),
      notes,
    });
    setCardId(''); setAmount(''); setNotes('');
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-green-500" />
            Recharger une carte
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Carte à recharger</Label>
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choisir une carte..." />
              </SelectTrigger>
              <SelectContent>
                {cards.filter(c => c.is_active !== false).map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — Solde: {(c.current_balance || 0).toFixed(2)} {c.currency || 'DZD'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedCard && (
            <div className="bg-muted/30 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">Solde actuel</p>
              <p className="text-2xl font-bold text-primary">{(selectedCard.current_balance || 0).toFixed(2)} <span className="text-sm">{selectedCard.currency || 'DZD'}</span></p>
              {selectedCard.card_number && <p className="text-xs text-muted-foreground mt-1">N° {selectedCard.card_number}</p>}
            </div>
          )}
          <div>
            <Label>Montant à recharger</Label>
            <Input className="mt-1" type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Notes (optionnel)</Label>
            <Input className="mt-1" placeholder="Référence virement..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2" onClick={handleSave} disabled={saving || !cardId || !amount}>
              <Plus className="h-4 w-4" />{saving ? 'Enregistrement...' : 'Recharger'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}