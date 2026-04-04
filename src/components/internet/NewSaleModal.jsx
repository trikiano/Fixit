import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Wifi, CreditCard } from 'lucide-react';
import { useAppSettings } from "@/components/settings/SettingsContext";
import ClientSelector from "@/components/ui/ClientSelector";


export default function NewSaleModal({ open, onClose, packages, accounts, onSave }) {
  const { formatCurrency, settings } = useAppSettings();
  const empty = {

    client_name: '', client_phone: '', package_id: '', package_name: '',
    data_amount: '', validity_days: '', sell_price: '', cost_price: '',
    payment_method: 'especes', account_used: accounts?.[0] || '',
    activation_code: '', notes: '', sale_date: new Date().toISOString()
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const selectPackage = (pkgId) => {
    const pkg = packages.find(p => p.id === pkgId);
    if (pkg) {
      setForm(p => ({
        ...p,
        package_id: pkg.id,
        package_name: pkg.name,
        data_amount: pkg.data_amount || '',
        validity_days: pkg.validity_days || '',
        sell_price: pkg.sell_price,
        cost_price: pkg.cost_price || ''
      }));
    }
  };

  const handleSave = async () => {
    if (!form.client_name || !form.client_phone || !form.package_name || !form.sell_price) return;
    setSaving(true);
    await onSave({ ...form, sell_price: Number(form.sell_price), cost_price: Number(form.cost_price) || 0 });
    setSaving(false);
    setForm(empty);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-primary" />
            Nouvelle vente de forfait
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Client */}
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <ClientSelector
              clientName={form.client_name}
              clientPhone={form.client_phone}
              onSelect={(name, phone) => { set('client_name', name); set('client_phone', phone); }}
              defaultPassager={false}
            />
          </div>

          {/* Forfait */}
          <div className="space-y-1.5">
            <Label>Forfait *</Label>
            {packages?.length > 0 ? (
              <Select value={form.package_id} onValueChange={selectPackage}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un forfait..." />
                </SelectTrigger>
                <SelectContent>
                  {packages.filter(p => p.is_active !== false).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.data_amount} — {formatCurrency(p.sell_price)}

                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.package_name} onChange={e => set('package_name', e.target.value)} placeholder="Nom du forfait (ex: 20GB - 30 jours)" />
            )}
          </div>

          {/* Détails forfait */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Volume données</Label>
              <Input value={form.data_amount} onChange={e => set('data_amount', e.target.value)} placeholder="ex: 20GB" />
            </div>
            <div className="space-y-1.5">
              <Label>Validité (jours)</Label>
              <Input type="number" value={form.validity_days} onChange={e => set('validity_days', e.target.value)} placeholder="30" />
            </div>
            <div className="space-y-1.5">
              <Label>Prix vendu ({settings.currency_symbol || 'DT'}) *</Label>

              <Input type="number" value={form.sell_price} onChange={e => set('sell_price', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prix coûtant ({settings.currency_symbol || 'DT'})</Label>

              <Input type="number" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Paiement</Label>
              <Select value={form.payment_method} onValueChange={v => set('payment_method', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="especes">Espèces</SelectItem>
                  <SelectItem value="carte">Carte bancaire</SelectItem>
                  <SelectItem value="virement">Virement</SelectItem>
                  <SelectItem value="credit_client">Crédit client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Compte utilisé */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Compte / Application utilisé</Label>
              {accounts?.length > 0 ? (
                <Select value={form.account_used} onValueChange={v => set('account_used', v)}>
                  <SelectTrigger><SelectValue placeholder="Compte..." /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.account_used} onChange={e => set('account_used', e.target.value)} placeholder="Nom du compte" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Code / Référence activation</Label>
              <Input value={form.activation_code} onChange={e => set('activation_code', e.target.value)} placeholder="Code ou réf." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Remarques..." rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !form.client_name || !form.client_phone || !form.sell_price}>
              {saving ? 'Enregistrement...' : 'Enregistrer la vente'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}