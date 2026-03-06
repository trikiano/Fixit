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
import { Package, Plus, Search, AlertTriangle } from 'lucide-react';
import { cn } from "@/lib/utils";

const categories = [
  { value: 'telephone', label: 'Téléphone' },
  { value: 'accessoire', label: 'Accessoire' },
  { value: 'piece_detachee', label: 'Pièce détachée' },
  { value: 'ordinateur', label: 'Ordinateur' },
  { value: 'tablette', label: 'Tablette' },
  { value: 'console', label: 'Console' },
  { value: 'autre', label: 'Autre' },
];

const conditions = [
  { value: 'neuf', label: 'Neuf' },
  { value: 'reconditionne', label: 'Reconditionné' },
  { value: 'occasion', label: 'Occasion' },
];

const emptyForm = { name: '', sku: '', category: 'telephone', brand: '', model: '', buy_price: 0, sell_price: 0, quantity: 0, min_stock: 2, location: '', imei: '', serial_number: '', condition: 'neuf', barcode: '' };

export default function Products() {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const qc = useQueryClient();

  const { data: products = [], isLoading } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: (data) => editing ? base44.entities.Product.update(editing.id, data) : base44.entities.Product.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); closeDialog(); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ name: p.name, sku: p.sku || '', category: p.category || 'telephone', brand: p.brand || '', model: p.model || '', buy_price: p.buy_price || 0, sell_price: p.sell_price || 0, quantity: p.quantity || 0, min_stock: p.min_stock || 2, location: p.location || '', imei: p.imei || '', serial_number: p.serial_number || '', condition: p.condition || 'neuf', barcode: p.barcode || '' });
    setDialogOpen(true);
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()) || p.brand?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const columns = [
    { header: "Produit", render: r => (
      <div>
        <p className="font-medium text-sm">{r.name}</p>
        <p className="text-xs text-muted-foreground">{r.brand} {r.model} {r.sku ? `• ${r.sku}` : ''}</p>
      </div>
    )},
    { header: "Catégorie", render: r => <Badge variant="outline" className="text-xs">{categories.find(c => c.value === r.category)?.label || r.category}</Badge> },
    { header: "Prix achat", render: r => <span className="text-sm">{(r.buy_price || 0).toFixed(2)} €</span> },
    { header: "Prix vente", render: r => <span className="text-sm font-medium">{(r.sell_price || 0).toFixed(2)} €</span> },
    { header: "Stock", render: r => (
      <div className="flex items-center gap-2">
        <span className={cn("text-sm font-bold", r.quantity <= (r.min_stock || 2) ? "text-destructive" : "text-foreground")}>{r.quantity || 0}</span>
        {r.quantity <= (r.min_stock || 2) && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
      </div>
    )},
    { header: "Emplacement", render: r => <span className="text-xs text-muted-foreground">{r.location || '-'}</span> },
  ];

  return (
    <div>
      <PageHeader title="Produits" subtitle={`${products.length} produits`}>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouveau produit</Button>
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Package} title="Aucun produit" description="Ajoutez votre premier produit" actionLabel="Ajouter" onAction={() => setDialogOpen(true)} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}

      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Modifier produit' : 'Nouveau produit'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nom *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Marque</Label><Input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} /></div>
              <div><Label>Modèle</Label><Input value={form.model} onChange={e => setForm({...form, model: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>État</Label>
                <Select value={form.condition} onValueChange={v => setForm({...form, condition: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{conditions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prix achat (€)</Label><Input type="number" value={form.buy_price} onChange={e => setForm({...form, buy_price: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Prix vente (€) *</Label><Input type="number" value={form.sell_price} onChange={e => setForm({...form, sell_price: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Quantité</Label><Input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})} /></div>
              <div><Label>Stock minimum</Label><Input type="number" value={form.min_stock} onChange={e => setForm({...form, min_stock: parseInt(e.target.value) || 0})} /></div>
              <div><Label>Emplacement</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>IMEI</Label><Input value={form.imei} onChange={e => setForm({...form, imei: e.target.value})} /></div>
              <div><Label>N° série</Label><Input value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} /></div>
              <div><Label>Code-barres</Label><Input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.sell_price}>{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}