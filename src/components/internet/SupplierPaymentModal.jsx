import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { HandCoins, Wifi, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function SupplierPaymentModal({ open, onClose, accounts, salesByAccount, onSave }) {
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const accountSales = account ? (salesByAccount[account] || { count: 0, revenue: 0, unpaid: 0 }) : null;

  const handleSave = async () => {
    if (!account || !amount) return;
    setSaving(true);
    await onSave({
      account_name: account,
      amount_given: Number(amount),
      payment_date: new Date().toISOString(),
      sales_count: accountSales?.count || 0,
      total_sales_amount: accountSales?.revenue || 0,
      notes
    });
    setSaving(false);
    setAccount('');
    setAmount('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-orange-400" />
            Paiement au fournisseur
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Enregistrer l'argent donné quand le fournisseur vient</p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Compte / Application *</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir le compte..." />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Résumé du compte sélectionné */}
          {accountSales && (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Wifi className="h-3 w-3" /> Situation du compte
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Total vendu (non payé)</p>
                  <p className="font-bold text-green-400 text-lg">{accountSales.unpaid.toFixed(2)} €</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Nombre de ventes</p>
                  <p className="font-bold text-lg">{accountSales.count}</p>
                </div>
              </div>
              {accountSales.unpaid > 0 && (
                <div className="flex items-center gap-2 text-xs text-orange-400 bg-orange-500/10 rounded-lg px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  Montant dû au fournisseur : <span className="font-bold ml-1">{accountSales.unpaid.toFixed(2)} €</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Montant donné (€) *</Label>
            <Input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="text-lg font-bold"
            />
            {accountSales && amount && (
              <p className="text-xs text-muted-foreground">
                Il vous restera : <span className="font-bold text-primary">{(accountSales.unpaid - Number(amount)).toFixed(2)} €</span> à payer
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optionnel)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Passage du fournisseur le 07/03, semaine du 01 au 07..." rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !account || !amount}
              className="bg-orange-500 hover:bg-orange-600 text-white">
              {saving ? 'Enregistrement...' : 'Confirmer le paiement'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}