import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { Receipt, Plus, Search, Trash2, Sparkles, PackageCheck, AlertTriangle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function PurchaseOrders() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [items, setItems] = useState([]);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('brouillon');
  const [receptionItems, setReceptionItems] = useState([]);
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['purchaseOrders'], queryFn: () => base44.entities.PurchaseOrder.list('-created_date') });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => base44.entities.Supplier.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  // Produits en stock faible
  const lowStockProducts = products.filter(p => p.is_active !== false && (p.quantity || 0) <= (p.min_stock || 2));

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) return base44.entities.PurchaseOrder.update(editing.id, data);
      return base44.entities.PurchaseOrder.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['purchaseOrders'] }); closeDialog(); },
  });

  const receptionMutation = useMutation({
    mutationFn: async ({ order, receivedItems }) => {
      // Fetch fresh products to get current stock
      const freshProducts = await base44.entities.Product.list();

      let allReceived = true;
      const updatedItems = order.items.map(item => {
        const rec = receivedItems.find(r => r.product_id === item.product_id);
        const qtyReceived = (item.quantity_received || 0) + (rec?.qty_now || 0);
        if (qtyReceived < item.quantity_ordered) allReceived = false;
        return { ...item, quantity_received: qtyReceived };
      });

      // Update stock for each product received
      for (const rec of receivedItems) {
        if (rec.qty_now > 0 && rec.product_id) {
          const prod = freshProducts.find(p => p.id === rec.product_id);
          if (prod) {
            const prevQty = prod.quantity || 0;
            const newQty = prevQty + rec.qty_now;
            await base44.entities.Product.update(prod.id, { quantity: newQty });
            await base44.entities.StockMovement.create({
              product_id: prod.id, product_name: prod.name, type: 'entree',
              quantity: rec.qty_now, previous_stock: prevQty, new_stock: newQty,
              reason: `Réception commande ${order.order_number}`, reference_type: 'achat', reference_id: order.id,
            });
          }
        }
      }

      const newStatus = allReceived ? 'recue' : 'partielle';
      const updatedOrder = await base44.entities.PurchaseOrder.update(order.id, { items: updatedItems, status: newStatus });

      // Créer automatiquement une facture fournisseur pour les articles reçus
      const receivedTotal = receivedItems.reduce((s, r) => {
        const item = order.items.find(i => i.product_id === r.product_id);
        return s + (r.qty_now * (item?.unit_price || 0));
      }, 0);
      if (receivedTotal > 0) {
        const invoiceNum = `FACT-${order.order_number}`;
        const description = `Réception commande ${order.order_number} — ${receivedItems.filter(r => r.qty_now > 0).map(r => `${r.product_name} x${r.qty_now}`).join(', ')}`;
        await base44.entities.SupplierInvoice.create({
          invoice_number: invoiceNum,
          supplier_id: order.supplier_id,
          supplier_name: order.supplier_name,
          description,
          invoice_date: format(new Date(), 'yyyy-MM-dd'),
          total_amount: receivedTotal,
          amount_paid: 0,
          remaining_debt: receivedTotal,
          status: 'en_attente',
          payments: [],
          purchase_order_id: order.id,
        });
      }
      return updatedOrder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['supplierInvoices'] });
      setReceptionOpen(false);
      setEditing(null);
    },
  });

  const closeDialog = () => {
    setDialogOpen(false); setEditing(null); setSupplierId(''); setSupplierName('');
    setItems([]); setExpectedDate(''); setNotes(''); setStatus('brouillon');
  };

  const openEdit = (o) => {
    setEditing(o); setSupplierId(o.supplier_id || ''); setSupplierName(o.supplier_name || '');
    setItems(o.items || []); setExpectedDate(o.expected_date || ''); setNotes(o.notes || ''); setStatus(o.status || 'brouillon');
    setDialogOpen(true);
  };

  const openReception = (o) => {
    setEditing(o);
    setReceptionItems((o.items || []).map(item => ({
      ...item,
      qty_remaining: item.quantity_ordered - (item.quantity_received || 0),
      qty_now: item.quantity_ordered - (item.quantity_received || 0),
    })));
    setReceptionOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: '', product_name: '', quantity_ordered: 1, quantity_received: 0, unit_price: 0 }]);

  const updateItem = (idx, field, value) => {
    const n = [...items]; n[idx][field] = value;
    if (field === 'product_id') { const p = products.find(x => x.id === value); if (p) { n[idx].product_name = p.name; n[idx].unit_price = p.buy_price || 0; } }
    setItems(n);
  };

  const addLowStockSuggestions = () => {
    const existing = items.map(i => i.product_id);
    const toAdd = lowStockProducts
      .filter(p => !existing.includes(p.id))
      .map(p => ({
        product_id: p.id, product_name: p.name,
        quantity_ordered: Math.max((p.min_stock || 2) * 2 - (p.quantity || 0), 1),
        quantity_received: 0, unit_price: p.buy_price || 0,
      }));
    setItems([...items, ...toAdd]);
  };

  const total = items.reduce((s, i) => s + (i.quantity_ordered * i.unit_price), 0);

  const handleSave = () => {
    const orderNum = editing?.order_number || `CMD-${Date.now().toString(36).toUpperCase()}`;
    saveMutation.mutate({ order_number: orderNum, supplier_id: supplierId, supplier_name: supplierName, status, items, total_amount: total, expected_date: expectedDate, notes });
  };

  const handleReception = () => receptionMutation.mutate({ order: editing, receivedItems: receptionItems });

  const filtered = orders.filter(o => o.order_number?.toLowerCase().includes(search.toLowerCase()) || o.supplier_name?.toLowerCase().includes(search.toLowerCase()));

  const columns = [
    { header: "N° Commande", render: r => <span className="text-sm font-mono font-medium text-primary">{r.order_number}</span> },
    { header: "Fournisseur", render: r => <span className="text-sm">{r.supplier_name}</span> },
    { header: "Statut", render: r => <StatusBadge status={r.status} /> },
    { header: "Articles", render: r => <span className="text-sm text-muted-foreground">{(r.items || []).length} article(s)</span> },
    { header: "Montant", render: r => <span className="text-sm font-medium">{(r.total_amount || 0).toFixed(2)} €</span> },
    { header: "Date prévue", render: r => <span className="text-xs text-muted-foreground">{r.expected_date || '-'}</span> },
    {
      header: "Actions", render: r => (
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          {['envoyee', 'partielle'].includes(r.status) && (
            <Button size="sm" variant="outline" className="gap-1 text-green-400 border-green-500/40 hover:bg-green-500/10" onClick={() => openReception(r)}>
              <PackageCheck className="h-3.5 w-3.5" /> Réceptionner
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )
    },
  ];

  return (
    <div>
      <PageHeader title="Commandes d'achat" subtitle={`${orders.length} commandes`}>
        {lowStockProducts.length > 0 && (
          <Badge variant="outline" className="border-amber-500/50 text-amber-400 gap-1">
            <AlertTriangle className="h-3 w-3" /> {lowStockProducts.length} produit(s) en stock faible
          </Badge>
        )}
        <Button onClick={() => { setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nouvelle commande</Button>
      </PageHeader>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Receipt} title="Aucune commande" actionLabel="Créer" onAction={() => setDialogOpen(true)} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}

      {/* ── Création / Édition ── */}
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
                <div className="flex gap-2">
                  {lowStockProducts.length > 0 && (
                    <Button variant="outline" size="sm" className="gap-1 text-amber-400 border-amber-500/40 hover:bg-amber-500/10" onClick={addLowStockSuggestions}>
                      <Sparkles className="h-3 w-3" /> Suggérer stock faible ({lowStockProducts.length})
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Ajouter</Button>
                </div>
              </div>

              {/* Suggestions visuelles */}
              {items.length === 0 && lowStockProducts.length > 0 && (
                <Card className="border-amber-500/30 bg-amber-500/5 mb-3">
                  <CardContent className="p-3">
                    <p className="text-xs text-amber-400 font-medium mb-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Produits en stock faible</p>
                    <div className="flex flex-wrap gap-2">
                      {lowStockProducts.slice(0, 8).map(p => (
                        <Badge key={p.id} variant="outline" className="border-amber-500/40 text-amber-300 cursor-pointer hover:bg-amber-500/20 text-xs"
                          onClick={() => setItems(prev => [...prev, { product_id: p.id, product_name: p.name, quantity_ordered: Math.max((p.min_stock || 2) * 2 - (p.quantity || 0), 1), quantity_received: 0, unit_price: p.buy_price || 0 }])}>
                          {p.name} ({p.quantity || 0} en stock)
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-muted/30 mb-2">
                  <div className="col-span-5">
                    <Label className="text-xs">Produit</Label>
                    <Select value={item.product_id} onValueChange={v => updateItem(idx, 'product_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} {(p.quantity || 0) <= (p.min_stock || 2) ? '⚠️' : ''}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label className="text-xs">Qté commandée</Label><Input type="number" min={1} value={item.quantity_ordered} onChange={e => updateItem(idx, 'quantity_ordered', parseInt(e.target.value) || 1)} /></div>
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
              <Button onClick={handleSave} disabled={!supplierId || saveMutation.isPending}>{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Réception / Livraison ── */}
      <Dialog open={receptionOpen} onOpenChange={v => !v && setReceptionOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-green-400" />
              Réceptionner la livraison — {editing?.order_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Vérifiez et ajustez les quantités réellement reçues. Le stock sera mis à jour automatiquement.</p>

            <div className="space-y-2">
              {receptionItems.map((item, idx) => {
                const alreadyReceived = (editing?.items?.find(i => i.product_id === item.product_id)?.quantity_received) || 0;
                return (
                  <div key={idx} className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg bg-muted/30">
                    <div className="col-span-5">
                      <p className="text-sm font-medium">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">Commandé: {item.quantity_ordered} | Déjà reçu: {alreadyReceived}</p>
                    </div>
                    <div className="col-span-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Reste à recevoir</p>
                      <Badge variant="outline" className="text-amber-400 border-amber-500/40">{item.qty_remaining}</Badge>
                    </div>
                    <div className="col-span-4">
                      <Label className="text-xs">Qté reçue maintenant</Label>
                      <Input
                        type="number" min={0} max={item.qty_remaining}
                        value={item.qty_now}
                        onChange={e => {
                          const n = [...receptionItems];
                          n[idx].qty_now = Math.min(parseInt(e.target.value) || 0, item.qty_remaining);
                          setReceptionItems(n);
                        }}
                        className={item.qty_now < item.qty_remaining ? 'border-amber-500/50' : 'border-green-500/50'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-2">
              <div>
                {receptionItems.every(i => i.qty_now === i.qty_remaining)
                  ? <Badge className="bg-green-500/20 text-green-400">Livraison complète</Badge>
                  : <Badge className="bg-amber-500/20 text-amber-400">Livraison partielle</Badge>
                }
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setReceptionOpen(false)}>Annuler</Button>
                <Button onClick={handleReception} disabled={receptionMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                  <PackageCheck className="h-4 w-4 mr-2" />
                  {receptionMutation.isPending ? 'Traitement...' : 'Confirmer la réception'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}