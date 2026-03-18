import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingBag, AlertTriangle } from 'lucide-react';
import { useAppSettings } from "@/components/settings/SettingsContext";

const paymentMethods = [
  { value: 'especes', label: 'Espèces' },
  { value: 'carte', label: 'Carte bancaire' },
  { value: 'virement', label: 'Virement' },
  { value: 'credit_client', label: 'Crédit client' },
];

export default function NewServiceSaleModal({ open, onClose, services, cards, onSave }) {
  const { formatCurrency, settings } = useAppSettings();
  const sym = settings.currency_symbol || 'DA';
  const [form, setForm] = useState({
    client_name: '', client_phone: '',
    service_id: '', card_id: '',
    cost_price: '', sell_price: '',
    payment_method: 'especes',
    activation_code: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  const selectedService = services.find(s => s.id === form.service_id);
  const selectedCard = cards.find(c => c.id === form.card_id);

  useEffect(() => {
    if (selectedService) {
      setForm(f => ({
        ...f,
        cost_price: selectedService.cost_price || '',
        sell_price: selectedService.sell_price || '',
      }));
    }
  }, [form.service_id]);

  const profit = (parseFloat(form.sell_price) || 0) - (parseFloat(form.cost_price) || 0);
  const insufficientBalance = selectedCard && parseFloat(form.cost_price) > (selectedCard.current_balance || 0);

  const handleSave = async () => {
    if (!form.client_name || !form.service_id || !form.card_id || !form.sell_price) return;
    setSaving(true);
    await onSave({
      ...form,
      service_name: selectedService?.name,
      category_id: selectedService?.category_id,
      category_name: selectedService?.category_name,
      card_name: selectedCard?.name,
      cost_price: parseFloat(form.cost_price) || 0,
      sell_price: parseFloat(form.sell_price) || 0,
      sale_date: new Date().toISOString(),
    });
    setForm({ client_name: '', client_phone: '', service_id: '', card_id: '', cost_price: '', sell_price: '', payment_method: 'especes', activation_code: '', notes: '' });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Nouvelle vente de service
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Client */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nom client *</Label>
              <Input className="mt-1" placeholder="Nom..." value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input className="mt-1" placeholder="0X XX XX XX..." value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} />
            </div>
          </div>

          {/* Service */}
          <div>
            <Label>Service *</Label>
            <Select value={form.service_id} onValueChange={v => setForm(f => ({ ...f, service_id: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir un service..." /></SelectTrigger>
              <SelectContent>
                {services.filter(s => s.is_active !== false).map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <span>{s.name}</span>
                    {s.category_name && <span className="text-muted-foreground ml-2 text-xs">— {s.category_name}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Carte source */}
          <div>
            <Label>Carte prépayée utilisée *</Label>
            <Select value={form.card_id} onValueChange={v => setForm(f => ({ ...f, card_id: v }))}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir la carte..." /></SelectTrigger>
              <SelectContent>
                {cards.filter(c => c.is_active !== false).map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} — Solde: {(c.current_balance || 0).toFixed(2)} {sym}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {insufficientBalance && (
              <div className="flex items-center gap-2 mt-1 text-xs text-amber-600 bg-amber-500/10 rounded p-2">
                <AlertTriangle className="h-3 w-3" />
                Solde insuffisant sur cette carte !
              </div>
            )}
          </div>

          {/* Prix */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Coût carte (débité)</Label>
              <Input className="mt-1" type="number" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} />
            </div>
            <div>
              <Label>Prix client (encaissé)</Label>
              <Input className="mt-1" type="number" value={form.sell_price} onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))} />
            </div>
          </div>

          {/* Bénéfice */}
          {(form.cost_price || form.sell_price) && (
            <div className={`text-sm rounded-lg p-2 flex justify-between ${profit >= 0 ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}`}>
              <span>Bénéfice sur cette vente</span>
              <span className="font-bold">{profit.toFixed(2)} {sym}</span>
            </div>
          )}

          {/* Paiement */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mode de paiement client</Label>
              <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Code / Réf activation</Label>
              <Input className="mt-1" placeholder="Optionnel..." value={form.activation_code} onChange={e => setForm(f => ({ ...f, activation_code: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Input className="mt-1" placeholder="Optionnel..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Annuler</Button>
            <Button className="flex-1 gap-2" onClick={handleSave} disabled={saving || !form.client_name || !form.service_id || !form.card_id}>
              <ShoppingBag className="h-4 w-4" />{saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}