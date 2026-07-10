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
import { Package, Plus, Search, AlertTriangle, Upload, X, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/components/settings/SettingsContext";
import ConfirmDialog from "@/components/ui/confirm-dialog";

const categories = [
  { value: 'telephone', label: 'Téléphone' },
  { value: 'ordinateur', label: 'Ordinateur / PC' },
  { value: 'tablette', label: 'Tablette' },
  { value: 'chargeur', label: 'Chargeur' },
  { value: 'cable', label: 'Câble' },
  { value: 'accessoire', label: 'Accessoire' },
  { value: 'piece_detachee', label: 'Pièce détachée' },
  { value: 'console', label: 'Console' },
  { value: 'haut_parleur', label: 'Haut-parleur' },
  { value: 'anticasse', label: 'Anticasse' },
  { value: 'autre', label: 'Autre' },
];

const ANTICASSE_TYPES = [
  { value: 'machine_sur_mesure', label: 'Machine sur mesure' },
  { value: 'pret_fabrique', label: 'Prêt fabriqué' },
];

const ANTICASSE_FINITIONS = [
  { value: 'transparent', label: 'Transparent' },
  { value: 'privacy', label: 'Privacy (anti-espion)' },
  { value: 'mat', label: 'Mat' },
  { value: 'miroir', label: 'Miroir' },
  { value: 'couleur', label: 'Couleur' },
];

const MOTIFS_PERTE = [
  { value: 'mauvaise_taille', label: 'Mauvaise taille / format' },
  { value: 'ne_convient_pas', label: 'Ne convient pas au modèle' },
  { value: 'abime_pose', label: 'Abîmé lors de la pose' },
  { value: 'retrait_client', label: 'Retrait / changement client' },
  { value: 'defaut_fabrication', label: 'Défaut de fabrication' },
  { value: 'autre', label: 'Autre' },
];

const conditions = [
  { value: 'neuf', label: 'Neuf' },
  { value: 'reconditionne', label: 'Reconditionné' },
  { value: 'occasion', label: 'Occasion' },
];

const emptyForm = { name: '', sku: '', category: 'telephone', brand: '', model: '', buy_price: 0, sell_price: 0, quantity: 0, min_stock: 2, location: '', imei: '', serial_number: '', condition: 'neuf', barcode: '', image_url: '' };

export default function Products() {
  const { formatCurrency, settings } = useAppSettings();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [perteMotif, setPerteMotif] = useState('mauvaise_taille');
  const [perteLoading, setPerteLoading] = useState(false);
  const [perteSuccess, setPerteSuccess] = useState(false);
  const qc = useQueryClient();

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, image_url: file_url }));
    setUploadingImage(false);
  };

  const { data: products = [], isLoading } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list('-created_date') });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) {
        const previousStock = editing.quantity || 0;
        const newStock = data.quantity || 0;
        const updated = await base44.entities.Product.update(editing.id, data);
        if (newStock !== previousStock) {
          await base44.entities.StockMovement.create({
            product_id: editing.id,
            product_name: data.name || editing.name,
            type: 'ajustement',
            quantity: Math.abs(newStock - previousStock),
            previous_stock: previousStock,
            new_stock: newStock,
            reason: 'Modification depuis la fiche produit',
            reference_type: 'inventaire',
          });
        }
        return updated;
      }
      return base44.entities.Product.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['stockMovements'] });
      closeDialog();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); setPerteSuccess(false); setPerteMotif('mauvaise_taille'); };
  const openEdit = (p) => {
    setEditing(p);
    setPerteSuccess(false);
    setForm({ name: p.name, sku: p.sku || '', category: p.category || 'telephone', brand: p.brand || '', model: p.model || '', buy_price: p.buy_price || 0, sell_price: p.sell_price || 0, quantity: p.quantity || 0, min_stock: p.min_stock || 2, location: p.location || '', imei: p.imei || '', serial_number: p.serial_number || '', condition: p.condition || 'neuf', barcode: p.barcode || '', image_url: p.image_url || '' });
    setDialogOpen(true);
  };

  const filtered = products.filter(p => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()) || p.brand?.toLowerCase().includes(search.toLowerCase()) || p.barcode?.toLowerCase().includes(search.toLowerCase()) || p.imei?.toLowerCase().includes(search.toLowerCase()) || p.serial_number?.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const columns = [
    { header: "Produit", render: r => (
      <div className="flex items-center gap-3">
        {r.image_url ? (
          <img src={r.image_url} alt={r.name} className="h-10 w-10 rounded-lg object-cover flex-shrink-0 border border-border/50" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
        <div>
          <p className="font-medium text-sm">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.brand} {r.model} {r.sku ? `• ${r.sku}` : ''}</p>
        </div>
      </div>
    )},
    { header: "Catégorie", render: r => <Badge variant="outline" className="text-xs">{categories.find(c => c.value === r.category)?.label || r.category}</Badge> },
    { header: "Prix achat", render: r => <span className="text-sm">{formatCurrency(r.buy_price || 0)}</span> },
    { header: "Prix vente", render: r => <span className="text-sm font-medium">{formatCurrency(r.sell_price || 0)}</span> },
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
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
      </div>
    )},
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
            {/* Image upload */}
            <div>
              <Label>Image du produit</Label>
              <div className="mt-1 flex items-center gap-3">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="Produit" className="h-20 w-20 rounded-xl object-cover border border-border" />
                    <button type="button" onClick={() => setForm(f => ({ ...f, image_url: '' }))} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center">
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

            {/* Nom + Catégorie */}
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nom *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
              <div><Label>Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm({...form, category: v, sku: '', brand: '', model: '', location: '', serial_number: ''})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* ===== SECTION ANTICASSE ===== */}
            {form.category === 'anticasse' ? (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-4">
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Spécifications Anticasse
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Type d'anticasse</Label>
                    <Select value={form.sku} onValueChange={v => setForm({...form, sku: v})}>
                      <SelectTrigger><SelectValue placeholder="Choisir le type..." /></SelectTrigger>
                      <SelectContent>{ANTICASSE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Finition</Label>
                    <Select value={form.location} onValueChange={v => setForm({...form, location: v})}>
                      <SelectTrigger><SelectValue placeholder="Choisir la finition..." /></SelectTrigger>
                      <SelectContent>{ANTICASSE_FINITIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Marque téléphone compatible</Label><Input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} placeholder="Samsung, Apple, Huawei…" /></div>
                  <div><Label>Modèle compatible</Label><Input value={form.model} onChange={e => setForm({...form, model: e.target.value})} placeholder="Galaxy S24, iPhone 15…" /></div>
                </div>
                {form.sku === 'pret_fabrique' && (
                  <div><Label>Marque de l'anticasse</Label><Input value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} placeholder="Gorilla Glass, Belkin, Spigen…" /></div>
                )}
                <div><Label>Code-barres <span className="text-xs text-muted-foreground">(optionnel — certains anticasses n'en ont pas)</span></Label>
                  <Input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} />
                </div>
              </div>
            ) : (
              /* Champs standard (non anticasse) */
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Marque</Label><Input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} /></div>
                  <div><Label>Modèle</Label><Input value={form.model} onChange={e => setForm({...form, model: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>IMEI</Label><Input value={form.imei} onChange={e => setForm({...form, imei: e.target.value})} /></div>
                  <div><Label>N° série</Label><Input value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} /></div>
                  <div><Label>Code-barres</Label><Input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} /></div>
                  <div><Label>Emplacement</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} /></div>
                </div>
              </>
            )}

            {/* Prix + Stock + État */}
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Prix achat ({settings.currency_symbol || 'DT'})</Label><Input type="number" value={form.buy_price} onChange={e => setForm({...form, buy_price: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Prix vente ({settings.currency_symbol || 'DT'}) *</Label><Input type="number" value={form.sell_price} onChange={e => setForm({...form, sell_price: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>État</Label>
                <Select value={form.condition} onValueChange={v => setForm({...form, condition: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{conditions.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Quantité en stock</Label><Input type="number" value={form.quantity} onChange={e => setForm({...form, quantity: parseInt(e.target.value) || 0})} /></div>
              <div><Label>Stock minimum</Label><Input type="number" value={form.min_stock} onChange={e => setForm({...form, min_stock: parseInt(e.target.value) || 0})} /></div>
            </div>

            {/* ===== SECTION PERTE (anticasse en mode édition) ===== */}
            {editing && form.category === 'anticasse' && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                  <Trash2 className="h-4 w-4" /> Enregistrer une perte / déchet
                </p>
                <p className="text-xs text-muted-foreground">Utilise ce bouton quand un anticasse ne convient pas et est mis au déchet. Le stock sera décrémenté de 1 et la perte sera historisée.</p>
                <div><Label>Motif de la perte</Label>
                  <Select value={perteMotif} onValueChange={setPerteMotif}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MOTIFS_PERTE.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {perteSuccess && <p className="text-xs text-emerald-600 font-medium">✅ Perte enregistrée — stock mis à jour.</p>}
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={perteLoading || (editing.quantity || 0) <= 0}
                  onClick={async () => {
                    setPerteLoading(true);
                    setPerteSuccess(false);
                    const prev = editing.quantity || 0;
                    const newQty = Math.max(0, prev - 1);
                    const motifLabel = MOTIFS_PERTE.find(m => m.value === perteMotif)?.label || perteMotif;
                    try {
                      await base44.entities.Product.update(editing.id, { quantity: newQty });
                      await base44.entities.StockMovement.create({
                        product_id: editing.id,
                        product_name: editing.name,
                        type: 'sortie',
                        quantity: 1,
                        previous_stock: prev,
                        new_stock: newQty,
                        reason: `Perte anticasse — ${motifLabel}`,
                        reference_type: 'perte_anticasse',
                      });
                      setEditing(e => ({ ...e, quantity: newQty }));
                      setForm(f => ({ ...f, quantity: newQty }));
                      qc.invalidateQueries({ queryKey: ['products'] });
                      qc.invalidateQueries({ queryKey: ['stockMovements'] });
                      setPerteSuccess(true);
                    } finally {
                      setPerteLoading(false);
                    }
                  }}
                >
                  {perteLoading ? 'Enregistrement…' : '🗑️ Confirmer la perte (−1 stock)'}
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending}>
                {saveMutation.isPending ? 'Sauvegarde…' : editing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={v => !v && setDeleteTarget(null)}
        title="Supprimer ce produit ?"
        description="Cette action est irréversible."
        onConfirm={() => { deleteMutation.mutate(deleteTarget); setDeleteTarget(null); }}
      />
    </div>
  );
}