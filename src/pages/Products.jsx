import React, { useState } from 'react';
import { fixit } from '@/api/fixitClient';
import { useAppSettings } from "@/components/settings/SettingsContext";
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
import EntityRefSelect from "@/components/ui/EntityRefSelect";
import { Switch } from "@/components/ui/switch";
import { Package, Plus, Search, AlertTriangle, Upload, X, Pencil, Trash2, Printer, Info, CheckCircle2, Wrench, Sparkles } from 'lucide-react';

import { toast } from "sonner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PhotoScanner from "@/components/products/PhotoScanner";


import { cn } from "@/lib/utils";

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';


const conditions = [

  { value: 'neuf', label: 'Neuf' },
  { value: 'reconditionne', label: 'Reconditionné' },
  { value: 'occasion', label: 'Occasion' },
];

const emptyForm = { name: '', sku: '', category: '', brand: '', model: '', supplier_id: '', buy_price: 0, buy_price_avg: 0, sell_price: 0, quantity: 0, min_stock: 2, location: '', imei: '', serial_number: '', condition: 'neuf', barcode: '', image_url: '', is_spare_part: false };




export default function Products() {
  const { formatCurrency, settings } = useAppSettings();
  const sym = settings.currency_symbol || 'DT';

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmState, setConfirmState] = useState({ open: false, title: '', description: '', onConfirm: () => {}, variant: 'danger' });
  const [photoScannerOpen, setPhotoScannerOpen] = useState(false);
  const qc = useQueryClient();



  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await fixit.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, image_url: file_url }));
      toast.success("Image téléchargée avec succès");
    } catch (e) {
      console.error(e);
      toast.error("Échec du téléchargement de l'image");
    } finally {
      setUploadingImage(false);
    }
  };


  const { data: products = [], isLoading } = useQuery({ queryKey: ['products'], queryFn: () => fixit.entities.Product.list('-created_date') });
  const { data: dbCategories = [] } = useQuery({ queryKey: ['productCategories'], queryFn: () => fixit.entities.ProductCategory.list() });


  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) return fixit.entities.Product.update(editing.id, data);
      const product = await fixit.entities.Product.create(data);
      if (data.quantity > 0) {
        await fixit.entities.StockMovement.create({
          product_id: product.id,
          type: 'entree',
          quantity: data.quantity,
          previous_stock: 0,
          new_stock: data.quantity,
          reason: 'Stock initial',
          reference_type: 'inventaire',
          unit_cost: data.buy_price || 0,
        });
      }
      return product;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['stockmovements'] });
      toast.success(editing ? "Produit mis à jour" : "Produit créé");
      closeDialog();
    },
    onError: () => toast.error("Erreur lors de l'enregistrement")
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => fixit.entities.Product.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success("Produit supprimé");
    },
    onError: () => toast.error("Impossible de supprimer ce produit (vérifiez s'il est lié à une vente)")
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      let count = 0;
      for (const id of ids) {
        try {
          await fixit.entities.Product.delete(id);
          count++;
        } catch(e) { console.error(`Failed to delete ${id}`, e); }
      }
      return count;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      setSelectedIds([]);
      toast.success(`${count} produit(s) supprimé(s)`);
    },
  });



  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const openEdit = (p) => {
    setEditing(p);
    setForm({ 
      name: p.name, sku: p.sku || '', category: p.category || 'Téléphone', brand: p.brand || '', model: p.model || '', 
      supplier_id: p.supplier_id || '', buy_price: p.buy_price || 0, buy_price_avg: p.buy_price_avg || 0, 
      sell_price: p.sell_price || 0, quantity: p.quantity || 0, min_stock: p.min_stock || 2, 
      location: p.location || '', imei: p.imei || '', serial_number: p.serial_number || '', 
      condition: p.condition || 'neuf', barcode: p.barcode || '', image_url: p.image_url || '',
      is_spare_part: !!p.is_spare_part
    });


    setDialogOpen(true);
  };

  const filtered = products.filter(p => {
    const searchLow = search.toLowerCase().trim();
    const matchSearch = p.name?.toLowerCase().includes(searchLow) || 
      p.sku?.toLowerCase().includes(searchLow) || 
      p.brand?.toLowerCase().includes(searchLow);
    
    if (catFilter === 'all') return matchSearch;

    const pCat = p.category?.toLowerCase().trim() || '';
    const fCat = catFilter.toLowerCase().trim();

    // Matching exactly or with "s" plural at the end
    const matchCat = pCat === fCat || (pCat + 's') === fCat || (fCat + 's') === pCat;
    
    return matchSearch && matchCat;
  });


  const generateStockPDF = () => {
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString();
    
    doc.setFontSize(18);
    doc.text("Inventaire du Stock", 14, 20);
    doc.setFontSize(10);
    doc.text(`Date : ${dateStr}`, 14, 26);
    doc.text(`Filtre : ${catFilter === 'all' ? 'Tous' : catFilter}`, 14, 31);

    const tableData = filtered.map(p => [
      p.name,
      p.category || 'N/A',
      p.buy_price_avg ? formatCurrency(p.buy_price_avg) : (p.buy_price ? formatCurrency(p.buy_price) : '-'),
      p.quantity || 0,
      formatCurrency((p.buy_price_avg || p.buy_price || 0) * (p.quantity || 0))
    ]);

    const totalValue = filtered.reduce((acc, p) => acc + ((p.buy_price_avg || p.buy_price || 0) * (p.quantity || 0)), 0);

    doc.autoTable({
      startY: 40,
      head: [['Produit', 'Catégorie', 'P. Achat (PAMP)', 'Stock', 'Valorisation']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [52, 152, 219], textColor: 255 },
      foot: [['', '', '', 'TOTAL', formatCurrency(totalValue)]],
      footStyles: { fillColor: [52, 152, 219], textColor: 255, fontStyle: 'bold' },
    });

    doc.save(`inventaire_stock_${dateStr.replace(/\//g, '-')}.pdf`);

  };


  const columns = [
    { header: "Produit", render: r => (
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted/20 flex items-center justify-center overflow-hidden flex-shrink-0 border border-border/50">
          {r.image_url ? (
            <img src={r.image_url} alt={r.name} className="h-full w-full object-contain" />
          ) : (
            <Package className="h-5 w-5 text-muted-foreground/40" />
          )}
        </div>

        <div>
          <p className="font-medium text-sm">{r.name}</p>
          <p className="text-xs text-muted-foreground">
            {r.brand} {r.model} {r.sku ? `• ${r.sku}` : ''}
            {r.is_spare_part && (
               <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[10px] h-4 py-0 px-1 font-bold">
                 PIÈCE
               </Badge>
            )}
          </p>

        </div>
      </div>
    )},
    { header: "Catégorie", render: r => <Badge variant="outline" className="text-xs">{r.category || '-'}</Badge> },

    { header: "P. Achat (PAMP)", render: r => (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-primary">{formatCurrency(r.buy_price_avg || r.buy_price || 0)}</span>
        {r.buy_price_avg > 0 && Math.abs((r.buy_price_avg || 0) - (r.buy_price || 0)) > 0.01 && (
          <span className="text-[10px] text-muted-foreground line-through">Dernier: {formatCurrency(r.buy_price || 0)}</span>
        )}
      </div>
    )},
    { header: "Prix vente", render: r => <span className="text-sm font-medium text-green-500">{formatCurrency(r.sell_price || 0)}</span> },

    { header: "Stock", render: r => (
      <div className="flex items-center gap-2">
        <span className={cn("text-sm font-bold", r.quantity <= (r.min_stock || 2) ? "text-destructive" : "text-foreground")}>{r.quantity || 0}</span>
        {r.quantity <= (r.min_stock || 2) && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
      </div>
    )},
    { header: "Emplacement", render: r => <span className="text-xs text-muted-foreground">{r.location || '-'}</span> },
    { header: "Actions", render: r => (
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => {
          setConfirmState({
            open: true,
            title: "Supprimer le produit",
            description: `Voulez-vous vraiment supprimer "${r.name}" ? Cette action est irréversible.`,
            variant: 'danger',
            onConfirm: () => {
              setConfirmState(prev => ({ ...prev, open: false }));
              deleteMutation.mutate(r.id);
            }
          });
        }}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},

  ];

  return (
    <div>
      <PageHeader title="Produits" subtitle={`${products.length} produits`}>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateStockPDF} disabled={filtered.length === 0}>
            <Printer className="h-4 w-4 mr-2" />Imprimer Inventaire
          </Button>
          <Button
            variant="outline"
            onClick={() => setPhotoScannerOpen(true)}
            className="gap-2 border-primary/40 text-primary hover:bg-primary/10 hover:border-primary"
          >
            <Sparkles className="h-4 w-4" />Scanner par photos
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Nouveau produit
          </Button>
        </div>
      </PageHeader>


      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher par nom, SKU ou marque..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-9 h-10 shadow-sm border-border/60 focus:ring-primary/20" 
          />
        </div>
        
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-48 h-10 shadow-sm border-border/60">
            <SelectValue placeholder="Toutes catégories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {(() => {
              const fromProds = products.map(p => p.category).filter(Boolean);
              const fromDb = dbCategories.map(c => c.name);
              const all = [...new Set([...fromProds, ...fromDb])].sort();
              return all.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ));
            })()}
          </SelectContent>
        </Select>

        {selectedIds.length > 0 && (
          <Button 
            variant="destructive" 
            size="sm" 
            className="animate-in fade-in zoom-in-95 duration-200 rounded-full px-6 h-10 shadow-lg shadow-destructive/20 border-none ml-auto"
            onClick={() => {
              setConfirmState({
                open: true,
                title: "Suppression groupée",
                description: `Voulez-vous supprimer les ${selectedIds.length} produits sélectionnés ?`,
                variant: 'danger',
                onConfirm: () => {
                  setConfirmState(prev => ({ ...prev, open: false }));
                  bulkDeleteMutation.mutate(selectedIds);
                }
              });
            }}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Supprimer ({selectedIds.length})
          </Button>
        )}

      </div>



      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Package} title="Aucun produit" description="Ajoutez votre premier produit" actionLabel="Ajouter" onAction={() => setDialogOpen(true)} />
      ) : (
        <DataTable 
          columns={columns} 
          data={filtered} 
          isLoading={isLoading} 
          onRowClick={openEdit} 
          selectable={true}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}


      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Modifier produit' : 'Nouveau produit'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Image upload */}
            <div>
              <Label>Image du produit</Label>
              <div className="mt-1 flex items-center gap-3">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="Produit" className="h-20 w-20 rounded-xl object-cover border border-border" />
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, image_url: '' }))}
                      className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/20">
                    <Package className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-sm font-medium">
                    <Upload className="h-4 w-4" />
                    {uploadingImage ? 'Chargement...' : 'Choisir une image'}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nom *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Catégorie</Label>
                <EntityRefSelect 
                  entityType="category" 
                  value={form.category} 
                  onChange={v => setForm({...form, category: v, brand: '', model: ''})} 
                  placeholder="Catégorie..." 
                />
              </div>
              <div><Label>Marque</Label>
                <EntityRefSelect 
                  entityType="brand" 
                  parentFilters={{ category: form.category }} 
                  value={form.brand} 
                  onChange={v => setForm({...form, brand: v, model: ''})} 
                  placeholder="Marque..." 
                />
              </div>
              <div><Label>Modèle</Label>
                <EntityRefSelect 
                  entityType="model" 
                  parentFilters={{ category: form.category, brand: form.brand }} 
                  value={form.model} 
                  onChange={v => setForm({...form, model: v})} 
                  placeholder="Modèle..." 
                />
              </div>
              <div><Label>Fournisseur</Label>
                <EntityRefSelect entityType="supplier" value={form.supplier_id} onChange={v => setForm({...form, supplier_id: v})} placeholder="Fournisseur..." />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div><Label>État</Label>
                <Select value={form.condition} onValueChange={v => setForm({...form, condition: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{conditions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prix achat ({settings.currency_symbol || 'DT'})</Label><Input type="number" value={form.buy_price} onChange={e => setForm({...form, buy_price: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Prix vente ({settings.currency_symbol || 'DT'}) *</Label><Input type="number" value={form.sell_price} onChange={e => setForm({...form, sell_price: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Quantité {editing && <span className="text-xs text-muted-foreground font-normal">(via Mouvements de stock)</span>}</Label>
                <Input type="number" min="0" value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})} disabled={!!editing} />
              </div>


              <div><Label>Stock minimum</Label><Input type="number" value={form.min_stock} onChange={e => setForm({...form, min_stock: parseInt(e.target.value) || 0})} /></div>
              <div><Label>Emplacement</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>IMEI</Label><Input value={form.imei} onChange={e => setForm({...form, imei: e.target.value})} /></div>
              <div><Label>N° série</Label><Input value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} /></div>
              <div><Label>Code-barres</Label><Input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} /></div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border/50">
              <Switch 
                checked={form.is_spare_part} 
                onCheckedChange={v => setForm({...form, is_spare_part: v})} 
              />
              <div className="flex flex-col">
                <Label className="cursor-pointer">Pièce de rechange</Label>
                <p className="text-xs text-muted-foreground">Cochez si cet article est destiné aux réparations</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.sell_price}>{editing ? 'Mettre à jour' : 'Créer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={v => setConfirmState({...confirmState, open: v})}
        title={confirmState.title}
        description={confirmState.description}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
      />
      <PhotoScanner open={photoScannerOpen} onOpenChange={setPhotoScannerOpen} />
    </div>
  );
}