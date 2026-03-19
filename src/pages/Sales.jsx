import React, { useState } from 'react';
import { useAppSettings } from "@/components/settings/SettingsContext";
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { ShoppingCart, Plus, Search, Trash2 } from 'lucide-react';
import ClientSelector from "@/components/ui/ClientSelector";
import { format } from 'date-fns';

export default function Sales() {
  const { formatCurrency, generateTicketNumber, settings } = useAppSettings();
  const sym = settings.currency_symbol || '€';
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [items, setItems] = useState([]);
  const [clientName, setClientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('especes');
  const [promoCode, setPromoCode] = useState('');
  const [notes, setNotes] = useState('');
  const qc = useQueryClient();

  const { data: sales = [], isLoading } = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.Sale.list('-created_date') });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  const saveMutation = useMutation({
    mutationFn: async (saleData) => {
      if (editing) return base44.entities.Sale.update(editing.id, saleData);
      // Decrease stock for each item
      for (const item of saleData.items) {
        if (item.product_id) {
          const prod = products.find(p => p.id === item.product_id);
          if (prod) {
            await base44.entities.Product.update(prod.id, { quantity: Math.max(0, (prod.quantity || 0) - item.quantity) });
            await base44.entities.StockMovement.create({
              product_id: prod.id, product_name: prod.name, type: 'sortie',
              quantity: item.quantity, previous_stock: prod.quantity, new_stock: Math.max(0, (prod.quantity || 0) - item.quantity),
              reason: `Vente ${saleData.sale_number}`, reference_type: 'vente'
            });
          }
        }
      }
      return base44.entities.Sale.create(saleData);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['products'] }); closeDialog(); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setItems([]); setClientName(''); setPaymentMethod('especes'); setPromoCode(''); setNotes(''); };

  const addItem = () => { setItems([...items, { product_id: '', product_name: '', quantity: 1, unit_price: 0, discount: 0, total: 0 }]); };
  const updateItem = (idx, field, value) => {
    const newItems = [...items];
    newItems[idx][field] = value;
    if (field === 'product_id') {
      const prod = products.find(p => p.id === value);
      if (prod) { newItems[idx].product_name = prod.name; newItems[idx].unit_price = prod.sell_price || 0; }
    }
    newItems[idx].total = (newItems[idx].quantity * newItems[idx].unit_price) - (newItems[idx].discount || 0);
    setItems(newItems);
  };
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));
  const total = items.reduce((s, i) => s + (i.total || 0), 0);

  const handleSave = () => {
    const saleNum = generateTicketNumber('sale');
    saveMutation.mutate({
      sale_number: editing?.sale_number || saleNum, client_name: clientName, type: 'vente',
      items, subtotal: total, discount_total: items.reduce((s, i) => s + (i.discount || 0), 0),
      promo_code: promoCode, total, payment_method: paymentMethod,
      payments: [{ method: paymentMethod, amount: total }], status: 'completee', notes
    });
  };

  const openEdit = (s) => {
    setEditing(s); setItems(s.items || []); setClientName(s.client_name || '');
    setPaymentMethod(s.payment_method || 'especes'); setPromoCode(s.promo_code || ''); setNotes(s.notes || '');
    setDialogOpen(true);
  };

  const filtered = sales.filter(s => s.sale_number?.toLowerCase().includes(search.toLowerCase()) || s.client_name?.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { header: "N° Vente", render: r => <span className="text-sm font-mono font-medium text-primary">{r.sale_number || '-'}</span> },
    { header: "Client", render: r => <span className="text-sm">{r.client_name || 'Anonyme'}</span> },
    { header: "Type", render: r => <StatusBadge status={r.type === 'vente' ? 'completee' : r.type} /> },
    { header: "Total", render: r => <span className="text-sm font-bold">{formatCurrency(r.total || 0)}</span> },
    { header: "Paiement", render: r => <span className="text-xs capitalize">{r.payment_method?.replace('_', ' ')}</span> },
    { header: "Statut", render: r => <StatusBadge status={r.status} /> },
    { header: "Date", render: r => <span className="text-xs text-muted-foreground">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy HH:mm') : '-'}</span> },
  ];

  return (
    <div>
      <PageHeader title="Ventes" subtitle={`${sales.length} ventes`}>
        <Button onClick={() => { setDialogOpen(true); addItem(); }}><Plus className="h-4 w-4 mr-2" />Nouvelle vente</Button>
      </PageHeader>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={ShoppingCart} title="Aucune vente" description="Effectuez votre première vente" actionLabel="Vendre" onAction={() => { setDialogOpen(true); addItem(); }} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}

      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Vente ${editing.sale_number}` : 'Nouvelle vente'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client</Label>
                <ClientSelector
                  clientName={clientName}
                  clientPhone={''}
                  onSelect={(name) => setClientName(name)}
                  defaultPassager={true}
                />
              </div>
              <div><Label>Paiement</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="especes">Espèces</SelectItem>
                    <SelectItem value="carte">Carte</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                    <SelectItem value="mixte">Mixte</SelectItem>
                    <SelectItem value="credit_client">Crédit client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Articles</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Ajouter</Button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-muted/30">
                    <div className="col-span-4">
                      <Label className="text-xs">Produit</Label>
                      <Select value={item.product_id} onValueChange={v => updateItem(idx, 'product_id', v)}>
                        <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                        <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.quantity})</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Label className="text-xs">Qté</Label><Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} /></div>
                    <div className="col-span-2"><Label className="text-xs">Prix unit.</Label><Input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} /></div>
                    <div className="col-span-2"><Label className="text-xs">Remise</Label><Input type="number" value={item.discount} onChange={e => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)} /></div>
                    <div className="col-span-1 text-right font-bold text-sm pt-5">{formatCurrency(item.total || 0)}</div>
                    <div className="col-span-1 pt-5"><Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Code promo</Label><Input value={promoCode} onChange={e => setPromoCode(e.target.value)} /></div>
              <div className="flex items-end justify-end">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={handleSave} disabled={items.length === 0}>{editing ? 'Mettre à jour' : 'Valider la vente'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}