import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { Receipt, Plus, Search, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function PurchaseOrders() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [items, setItems] = useState([]);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('brouillon');
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['purchaseOrders'], queryFn: () => base44.entities.PurchaseOrder.list('-created_date') });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) {
        // If status changed to recue, update stock
        if (data.status === 'recue' && editing.status !== 'recue') {
          for (const item of data.items) {
            if (item.product_id) {
              const prod = products.find(p => p.id === item.product_id);
              if (prod) {
                const qty = item.quantity_ordered - (item.quantity_received || 0);
                await base44.entities.Product.update(prod.id, { quantity: (prod.quantity || 0) + qty });
                await base44.entities.StockMovement.create({
                  product_id: prod.id, product_name: prod.name, type: 'entree',
                  quantity: qty, previous_stock: prod.quantity, new_stock: (prod.quantity || 0) + qty,
                  reason: `Commande ${data.order_number}`, reference_type: 'achat'
                });
              }
            }
          }
        }
        return base44.entities.PurchaseOrder.update(editing.id, data);
      }
      return base44.entities.PurchaseOrder.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchaseOrders'] }); qc.invalidateQueries({ queryKey: ['products'] }); closeDialog(); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setSupplierId(''); setSupplierName(''); setItems([]); setExpectedDate(''); setNotes(''); setStatus('brouillon'); };

  const openEdit = (o) => {
    setEditing(o); setSupplierId(o.supplier_id || ''); setSupplierName(o.supplier_name || '');
    setItems(o.items || []); setExpectedDate(o.expected_date || ''); setNotes(o.notes || ''); setStatus(o.status || 'brouillon');
    setDialogOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: '', product_name: '', quantity_ordered: 1, quantity_received: 0, unit_price: 0 }]);
  const updateItem = (idx, field, value) => {
    const n = [...items]; n[idx][field] = value;
    if (field === 'product_id') { const p = products.find(x => x.id === value); if (p) { n[idx].product_name = p.name; n[idx].unit_price = p.buy_price || 0; } }
    setItems(n);
  };
  const total = items.reduce((s, i) => s + (i.quantity_ordered * i.unit_price), 0);

  const handleSave = () => {
    const orderNum = editing?.order_number || `CMD-${Date.now().toString(36).toUpperCase()}`;
    saveMutation.mutate({ order_number: orderNum, supplier_id: supplierId, supplier_name: supplierName, status, items, total_amount: total, expected_date: expectedDate, notes });
  };

  const filtered = orders.filter(o => o.order_number?.toLowerCase().includes(search.toLowerCase()) || o.supplier_name?.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { header: "N° Commande", render: r => <span className="text-sm font-mono font-medium text-primary">{r.order_number}</span> },
    { header: "Fournisseur", render: r => <span className="text-sm">{r.supplier_name}</span> },
    { header: "Statut", render: r => <StatusBadge status={r.status} /> },
    { header: "Montant", render: r => <span className="text-sm font-medium">{(r.total_amount || 0).toFixed(2)} €</span> },
    { header: "Date prévue", render: r => <span className="text-xs text-muted-foreground">{r.expected_date || '-'}</span> },
    { header: "Créée le", render: r => <span className="text-xs text-muted-foreground">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy') : '-'}</span> },
  ];

  return (
    <div>
      <PageHeader title="Commandes d'achat" subtitle={`${orders.length} commandes`}>
        <Button onClick={() => { setDialogOpen(true); addItem(); }}><Plus className="h-4 w-4 mr-2" />Nouvelle commande</Button>
      </PageHeader>
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Receipt} title="Aucune commande" actionLabel="Créer" onAction={() => { setDialogOpen(true); addItem(); }} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}
      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Commande ${editing.order_number}` : 'Nouvelle commande'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {editing && (
              <div><Label>Statut</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brouillon">Brouillon</SelectItem>
                    <SelectItem value="envoyee">Envoyée</SelectItem>
                    <SelectItem value="partielle">Partielle</SelectItem>
                    <SelectItem value="recue">Reçue</SelectItem>
                    <SelectItem value="annulee">Annulée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fournisseur *</Label>
                <Select value={supplierId} onValueChange={v => { setSupplierId(v); setSupplierName(suppliers.find(s => s.id === v)?.name || ''); }}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date prévue</Label><Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Articles</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Ajouter</Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-muted/30 mb-2">
                  <div className="col-span-5">
                    <Label className="text-xs">Produit</Label>
                    <Select value={item.product_id} onValueChange={v => updateItem(idx, 'product_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label className="text-xs">Qté</Label><Input type="number" min={1} value={item.quantity_ordered} onChange={e => updateItem(idx, 'quantity_ordered', parseInt(e.target.value) || 1)} /></div>
                  <div className="col-span-2"><Label className="text-xs">Prix unit.</Label><Input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} /></div>
                  <div className="col-span-2 text-right font-bold text-sm pt-5">{(item.quantity_ordered * item.unit_price).toFixed(2)}€</div>
                  <div className="col-span-1 pt-5"><Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} className="w-64" /></div>
              <div className="text-right"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold text-primary">{total.toFixed(2)} €</p></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={handleSave} disabled={!supplierId}>{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}