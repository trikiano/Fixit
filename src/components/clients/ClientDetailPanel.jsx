import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/ui/StatusBadge";
import { Wrench, ShoppingBag, Ban, Phone, Mail } from 'lucide-react';
import { useAppSettings } from "@/components/settings/SettingsContext";
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';

export default function ClientDetailPanel({ client, onClose }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    full_name: client.full_name, phone: client.phone, email: client.email || '',
    address: client.address || '', segment: client.segment || 'particulier',
    notes: client.notes || '', credit_balance: client.credit_balance || 0
  });

  const { data: allRepairs = [] } = useQuery({
    queryKey: ['repairs'],
    queryFn: () => base44.entities.Repair.list('-created_date', 500),
  });
  const { data: allSales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => base44.entities.Sale.list('-created_date', 500),
  });

  const repairs = allRepairs.filter(r =>
    r.client_id === client.id || r.client_name === client.full_name || r.client_phone === client.phone
  );
  const sales = allSales.filter(s =>
    s.client_id === client.id || s.client_name === client.full_name
  );

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.update(client.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const toggleBlacklistMutation = useMutation({
    mutationFn: (val) => base44.entities.Client.update(client.id, { is_blacklisted: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clients'] }),
  });

  const handleNewRepair = () => {
    onClose();
    navigate(createPageUrl('Repairs') + `?client_name=${encodeURIComponent(client.full_name)}&client_phone=${encodeURIComponent(client.phone)}`);
  };

  const totalPurchases = sales.reduce((s, v) => s + (v.total || 0), 0);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0">
              {client.full_name?.[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold">{client.full_name}</p>
                {client.is_blacklisted && <Ban className="h-4 w-4 text-destructive" />}
                <StatusBadge status={client.segment} />
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground font-normal mt-0.5">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{client.phone}</span>
                {client.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{client.email}</span>}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Stats rapides */}
        <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
          <div className="text-center">
            <p className="text-lg font-bold text-primary">{repairs.length}</p>
            <p className="text-xs text-muted-foreground">Réparations</p>
          </div>
          <div className="text-center border-x border-border/50">
            <p className="text-lg font-bold text-primary">{sales.length}</p>
            <p className="text-xs text-muted-foreground">Achats</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-primary">{totalPurchases.toFixed(0)} €</p>
            <p className="text-xs text-muted-foreground">Total dépensé</p>
          </div>
        </div>

        {/* Action rapide */}
        <Button size="sm" onClick={handleNewRepair} className="w-full">
          <Wrench className="h-4 w-4 mr-2" />Créer une nouvelle réparation pour ce client
        </Button>

        <Tabs defaultValue="repairs">
          <TabsList className="w-full">
            <TabsTrigger value="repairs" className="flex-1">Réparations ({repairs.length})</TabsTrigger>
            <TabsTrigger value="sales" className="flex-1">Ventes ({sales.length})</TabsTrigger>
            <TabsTrigger value="info" className="flex-1">Modifier</TabsTrigger>
          </TabsList>

          {/* Réparations */}
          <TabsContent value="repairs" className="mt-3">
            {repairs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Wrench className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Aucune réparation pour ce client</p>
                <Button size="sm" className="mt-3" onClick={handleNewRepair}>Créer une réparation</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {repairs.map(r => (
                  <div key={r.id} className="flex items-start justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono font-bold text-primary">{r.ticket_number || '-'}</span>
                        <StatusBadge status={r.status} />
                        <StatusBadge status={r.priority} />
                      </div>
                      <p className="text-sm font-medium">{r.device_brand} {r.device_model}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{r.problem_description}</p>
                      {r.parts_used?.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">🔧 {r.parts_used.length} pièce(s) utilisée(s)</p>
                      )}
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-sm font-bold">{(r.final_cost || r.estimated_cost || 0).toFixed(2)} €</p>
                      <p className="text-xs text-muted-foreground">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy') : '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Ventes */}
          <TabsContent value="sales" className="mt-3">
            {sales.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Aucune vente pour ce client</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sales.map(s => (
                  <div key={s.id} className="flex items-start justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono font-bold text-primary">{s.sale_number || '-'}</span>
                        <StatusBadge status={s.status} />
                        <StatusBadge status={s.payment_method} />
                      </div>
                      {s.items?.length > 0 && (
                        <div className="space-y-0.5">
                          {s.items.map((item, i) => (
                            <p key={i} className="text-xs text-muted-foreground">• {item.product_name} x{item.quantity} — {(item.total || 0).toFixed(2)} €</p>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-sm font-bold">{(s.total || 0).toFixed(2)} €</p>
                      <p className="text-xs text-muted-foreground">{s.created_date ? format(new Date(s.created_date), 'dd/MM/yyyy') : '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Modifier */}
          <TabsContent value="info" className="mt-3">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nom complet</Label><Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} /></div>
                <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
              <div><Label>Crédit client (€)</Label><Input type="number" value={form.credit_balance} onChange={e => setForm({...form, credit_balance: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <div className="flex items-center gap-3">
                <Switch checked={client.is_blacklisted} onCheckedChange={val => toggleBlacklistMutation.mutate(val)} />
                <Label className="text-destructive">Blacklisté</Label>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}