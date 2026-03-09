import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function RepairPayments({ payments = [], finalCost = 0, onChange }) {
  const [showForm, setShowForm] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: '', method: 'especes',
    date: format(new Date(), 'yyyy-MM-dd'), notes: ''
  });

  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const remaining = Math.max(0, (finalCost || 0) - totalPaid);

  const methodLabel = { especes: '💵 Espèces', carte: '💳 Carte', virement: '🏦 Virement' };

  const addPayment = () => {
    if (!newPayment.amount || parseFloat(newPayment.amount) <= 0) return;
    onChange([...payments, { ...newPayment, amount: parseFloat(newPayment.amount) }]);
    setNewPayment({ amount: '', method: 'especes', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    setShowForm(false);
  };

  return (
    <div className="border border-border/50 rounded-lg p-4 space-y-3">
      {/* Header avec totaux */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">💰 Paiements & Acomptes</h3>
        <div className="flex gap-3 text-xs">
          <span className="text-muted-foreground">Total: <span className="font-bold text-foreground">{(finalCost || 0).toFixed(2)} €</span></span>
          <span className="text-green-500">Payé: <span className="font-bold">{totalPaid.toFixed(2)} €</span></span>
          <span className={remaining > 0 ? 'text-orange-400 font-semibold' : 'text-green-500'}>
            Restant: <span className="font-bold">{remaining.toFixed(2)} €</span>
          </span>
        </div>
      </div>

      {/* Barre de progression */}
      {finalCost > 0 && (
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: `${Math.min(100, (totalPaid / finalCost) * 100)}%` }}
          />
        </div>
      )}

      {/* Liste des paiements */}
      {payments.length > 0 && (
        <div className="space-y-1.5">
          {payments.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-muted/30 rounded-md px-3 py-2">
              <span className="text-muted-foreground text-xs w-20 flex-shrink-0">{p.date || '—'}</span>
              <span className="font-bold text-green-400 w-20 flex-shrink-0">{(p.amount || 0).toFixed(2)} €</span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {methodLabel[p.method] || p.method}
              </span>
              {p.notes && <span className="text-xs text-muted-foreground truncate flex-1">{p.notes}</span>}
              <button onClick={() => onChange(payments.filter((_, j) => j !== i))} className="ml-auto text-muted-foreground hover:text-destructive flex-shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire ajout */}
      {!showForm ? (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)} className="w-full gap-2">
          <Plus className="h-3.5 w-3.5" />Ajouter un paiement / acompte
        </Button>
      ) : (
        <div className="border border-border/50 rounded-lg p-3 space-y-3 bg-muted/10">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Montant (€) *</Label>
              <Input type="number" placeholder={remaining > 0 ? remaining.toFixed(2) : '0.00'}
                value={newPayment.amount}
                onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))}
                className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Mode de paiement</Label>
              <Select value={newPayment.method} onValueChange={v => setNewPayment(p => ({ ...p, method: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="especes">Espèces</SelectItem>
                  <SelectItem value="carte">Carte</SelectItem>
                  <SelectItem value="virement">Virement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={newPayment.date}
                onChange={e => setNewPayment(p => ({ ...p, date: e.target.value }))}
                className="h-8 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes (optionnel)</Label>
            <Input placeholder="Ex: Acompte à la réception..." value={newPayment.notes}
              onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))}
              className="h-8 text-sm" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button size="sm" onClick={addPayment} disabled={!newPayment.amount || parseFloat(newPayment.amount) <= 0}>
              Ajouter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}