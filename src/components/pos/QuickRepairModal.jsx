import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Wrench } from 'lucide-react';
import ClientSelector from "@/components/ui/ClientSelector";

const DEVICE_TYPES = [
  { value: 'smartphone', label: '📱 Smartphone' },
  { value: 'tablette', label: '🖥️ Tablette' },
  { value: 'ordinateur_portable', label: '💻 PC Portable' },
  { value: 'ordinateur_bureau', label: '🖥️ PC Bureau' },
  { value: 'console', label: '🎮 Console' },
  { value: 'autre', label: '📦 Autre' },
];

const empty = {
  client_name: '', client_phone: '',
  device_type: 'smartphone', device_brand: '', device_model: '',
  problem_description: '', estimated_cost: '', deposit_amount: '0',
  payment_method: 'especes', status: 'reception',
};

export default function QuickRepairModal({ open, onClose, onSave }) {
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.client_name || !form.client_phone || !form.problem_description) return;
    setSaving(true);
    await onSave({
      ...form,
      estimated_cost: Number(form.estimated_cost) || 0,
      deposit_amount: Number(form.deposit_amount) || 0,
    });
    setSaving(false);
    setForm(empty);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-400" />
            Nouvelle réparation / maintenance
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <ClientSelector
              clientName={form.client_name}
              clientPhone={form.client_phone}
              onSelect={(name, phone) => { set('client_name', name); set('client_phone', phone || ''); }}
              defaultPassager={false}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Type d'appareil</Label>
              <Select value={form.device_type} onValueChange={v => set('device_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEVICE_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Marque</Label>
              <Input value={form.device_brand} onChange={e => set('device_brand', e.target.value)} placeholder="Apple, Samsung..." />
            </div>
            <div className="space-y-1.5">
              <Label>Modèle</Label>
              <Input value={form.device_model} onChange={e => set('device_model', e.target.value)} placeholder="iPhone 14..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Problème décrit *</Label>
            <Textarea value={form.problem_description} onChange={e => set('problem_description', e.target.value)} placeholder="Écran cassé, batterie HS, ne s'allume plus..." rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Coût estimé (€)</Label>
              <Input type="number" value={form.estimated_cost} onChange={e => set('estimated_cost', e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Acompte versé (€)</Label>
              <Input type="number" value={form.deposit_amount} onChange={e => set('deposit_amount', e.target.value)} placeholder="0.00" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mode de paiement acompte</Label>
            <Select value={form.payment_method} onValueChange={v => set('payment_method', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="especes">Espèces</SelectItem>
                <SelectItem value="carte">Carte bancaire</SelectItem>
                <SelectItem value="virement">Virement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Annuler</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.client_name || !form.client_phone || !form.problem_description}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {saving ? 'Enregistrement...' : 'Créer la réparation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}