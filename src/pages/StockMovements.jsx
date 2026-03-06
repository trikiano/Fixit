import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { Warehouse, Plus, Search, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

const typeColors = {
  entree: "bg-emerald-500/10 text-emerald-400",
  sortie: "bg-red-500/10 text-red-400",
  ajustement: "bg-amber-500/10 text-amber-400",
  transfert: "bg-blue-500/10 text-blue-400",
  retour: "bg-purple-500/10 text-purple-400",
};

export default function StockMovements() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', type: 'ajustement', quantity: 0, reason: '' });
  const qc = useQueryClient();

  const { data: movements = [], isLoading } = useQuery({ queryKey: ['stockMovements'], queryFn: () => base44.entities.StockMovement.list('-created_date', 200) });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  const adjustMutation = useMutation({
    mutationFn: async (data) => {
      const product = products.find(p => p.id === data.product_id);
      if (!product) return;
      const newStock = data.type === 'entree' ? (product.quantity || 0) + data.quantity :
                       data.type === 'sortie' ? Math.max(0, (product.quantity || 0) - data.quantity) :
                       data.quantity; // ajustement = set to value
      await base44.entities.Product.update(product.id, { quantity: newStock });
      await base44.entities.StockMovement.create({
        product_id: product.id, product_name: product.name, type: data.type,
        quantity: data.type === 'ajustement' ? Math.abs(newStock - (product.quantity || 0)) : data.quantity,
        previous_stock: product.quantity || 0, new_stock: newStock,
        reason: data.reason, reference_type: 'inventaire'
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['stockMovements'] }); qc.invalidateQueries({ queryKey: ['products'] }); setDialogOpen(false); setForm({ product_id: '', type: 'ajustement', quantity: 0, reason: '' }); },
  });

  const filtered = movements.filter(m => {
    const ms = m.product_name?.toLowerCase().includes(search.toLowerCase());
    const mt = typeFilter === 'all' || m.type === typeFilter;
    return ms && mt;
  });

  const columns = [
    { header: "Produit", render: r => <span className="text-sm font-medium">{r.product_name}</span> },
    { header: "Type", render: r => (
      <Badge variant="outline" className={`text-xs ${typeColors[r.type] || ''}`}>
        {r.type === 'entree' && <ArrowUp className="h-3 w-3 mr-1" />}
        {r.type === 'sortie' && <ArrowDown className="h-3 w-3 mr-1" />}
        {r.type === 'ajustement' && <RefreshCw className="h-3 w-3 mr-1" />}
        {r.type}
      </Badge>
    )},
    { header: "Quantité", render: r => <span className="text-sm font-bold">{r.quantity}</span> },
    { header: "Avant", render: r => <span className="text-xs text-muted-foreground">{r.previous_stock}</span> },
    { header: "Après", render: r => <span className="text-sm font-medium">{r.new_stock}</span> },
    { header: "Raison", render: r => <span className="text-xs text-muted-foreground">{r.reason || '-'}</span> },
    { header: "Date", render: r => <span className="text-xs text-muted-foreground">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy HH:mm') : '-'}</span> },
  ];

  return (
    <div>
      <PageHeader title="Mouvements de Stock" subtitle={`${movements.length} mouvements`}>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Ajustement stock</Button>
      </PageHeader>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher produit..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="entree">Entrée</SelectItem>
            <SelectItem value="sortie">Sortie</SelectItem>
            <SelectItem value="ajustement">Ajustement</SelectItem>
            <SelectItem value="transfert">Transfert</SelectItem>
            <SelectItem value="retour">Retour</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Warehouse} title="Aucun mouvement" description="Les mouvements de stock apparaîtront ici" />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} />
      )}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) setDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ajustement de stock</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Produit *</Label>
              <Select value={form.product_id} onValueChange={v => setForm({...form, product_id: v})}>
                <SelectTrigger><SelectValue placeholder="Choisir un produit..." /></SelectTrigger>
                <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} (stock: {p.quantity || 0})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entree">Entrée</SelectItem>
                    <SelectItem value="sortie">Sortie</SelectItem>
                    <SelectItem value="ajustement">Ajustement (nouveau stock)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Quantité *</Label><Input type="number" min={0} value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})} /></div>
            </div>
            <div><Label>Raison / Justification *</Label><Input value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} placeholder="Justification obligatoire" /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={() => adjustMutation.mutate(form)} disabled={!form.product_id || !form.reason}>Valider</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}