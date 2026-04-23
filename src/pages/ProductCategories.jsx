import React, { useState } from 'react';
import { fixit } from '@/api/fixitClient';
import { fixitFetch } from '@/api/fixitFetch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageHeader from '@/components/ui/PageHeader';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Tag, Package, ChevronRight, Layers,
  GripVertical, AlertTriangle,
} from 'lucide-react';

// Palette de couleurs prédéfinies
const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#64748b', '#1e293b',
];

const emptyForm = { name: '', color: '#6366f1', description: '' };

function CategoryCard({ cat, productCount, onEdit, onDelete }) {
  return (
    <div
      className="group flex items-center gap-4 p-4 bg-card border border-border/60 rounded-xl hover:border-border hover:shadow-sm transition-all"
    >
      {/* Color swatch */}
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm"
        style={{ backgroundColor: cat.color || '#6366f1' }}
      >
        <Tag className="h-5 w-5" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{cat.name}</p>
        {cat.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{cat.description}</p>
        )}
      </div>

      {/* Product count badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 rounded-lg text-xs text-muted-foreground border border-border/50 flex-shrink-0">
        <Package className="h-3.5 w-3.5" />
        <span className="font-semibold">{productCount ?? 0}</span>
        <span>produit{productCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm" variant="ghost"
          className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
          onClick={() => onEdit(cat)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm" variant="ghost"
          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onDelete(cat)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function ProductCategories() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmState, setConfirmState] = useState({ open: false });
  const [search, setSearch] = useState('');

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['productCategories'],
    queryFn: () => fixit.entities.ProductCategory.list('name'),
  });

  // Fetch products (for count + to detect categories not in DB)
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => fixit.entities.Product.list('-created_date'),
  });

  // Build product count per category
  const countMap = {};
  products.forEach(p => {
    if (p.category) countMap[p.category] = (countMap[p.category] || 0) + 1;
  });

  // Merge: DB categories + categories found only in products (orphans)
  const dbNames = new Set(categories.map(c => c.name));
  const orphanNames = [...new Set(products.map(p => p.category).filter(Boolean))].filter(n => !dbNames.has(n));

  // Filtered list
  const filtered = categories.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredOrphans = orphanNames.filter(n =>
    !search || n.toLowerCase().includes(search.toLowerCase())
  );

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) {
        // If name changed, cascade update on products
        if (editing.name !== data.name) {
          await fixitFetch('/functions/renameCategory', {
            method: 'POST',
            body: JSON.stringify({ oldName: editing.name, newName: data.name }),
          });
        }
        return fixit.entities.ProductCategory.update(editing.id, data);
      }
      return fixit.entities.ProductCategory.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productCategories'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success(editing ? 'Catégorie mise à jour (produits mis à jour)' : 'Catégorie créée');
      closeDialog();
    },
    onError: (err) => toast.error(err.message || 'Erreur'),
  });

  const deleteMutation = useMutation({
    mutationFn: (cat) => fixit.entities.ProductCategory.delete(cat.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productCategories'] });
      toast.success('Catégorie supprimée');
    },
    onError: () => toast.error('Erreur lors de la suppression'),
  });

  // Import an orphan category into DB
  const importOrphanMutation = useMutation({
    mutationFn: (name) => fixit.entities.ProductCategory.create({ name, color: '#6366f1' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productCategories'] });
      toast.success('Catégorie importée');
    },
  });

  // ── Dialog helpers ──
  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({ name: cat.name, color: cat.color || '#6366f1', description: cat.description || '' });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const openDelete = (cat) => {
    const count = countMap[cat.name] || 0;
    setConfirmState({
      open: true,
      title: `Supprimer "${cat.name}" ?`,
      description: count > 0
        ? `Cette catégorie contient ${count} produit${count > 1 ? 's' : ''}. Les produits garderont leur catégorie mais elle ne sera plus gérée ici.`
        : 'Cette catégorie est vide. La suppression est sans impact sur les produits.',
      variant: 'danger',
      onConfirm: () => {
        setConfirmState(s => ({ ...s, open: false }));
        deleteMutation.mutate(cat);
      },
    });
  };

  const totalProducts = products.length;
  const totalCategories = categories.length + orphanNames.length;

  return (
    <div>
      <PageHeader
        title="Catégories produits"
        subtitle={`${totalCategories} catégorie${totalCategories !== 1 ? 's' : ''} · ${totalProducts} produit${totalProducts !== 1 ? 's' : ''}`}
      >
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />Nouvelle catégorie
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-card border border-border/60 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-primary">{categories.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Catégories gérées</p>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{totalProducts}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Produits total</p>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{orphanNames.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Non gérées</p>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-500">
            {categories.length > 0 ? Math.round(totalProducts / categories.length) : 0}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Produits / catégorie</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-5">
        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une catégorie…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Managed categories */}
          {filtered.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Layers className="h-3.5 w-3.5" />Catégories gérées
              </p>
              <div className="space-y-2">
                {filtered
                  .sort((a, b) => (countMap[b.name] || 0) - (countMap[a.name] || 0))
                  .map(cat => (
                    <CategoryCard
                      key={cat.id}
                      cat={cat}
                      productCount={countMap[cat.name] || 0}
                      onEdit={openEdit}
                      onDelete={openDelete}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Orphan categories (exist in products but not in DB) */}
          {filteredOrphans.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Catégories non gérées (trouvées dans les produits)
              </p>
              <div className="space-y-2">
                {filteredOrphans.map(name => (
                  <div
                    key={name}
                    className="flex items-center gap-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl"
                  >
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Tag className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {countMap[name] || 0} produit{(countMap[name] || 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/40 text-amber-600 hover:bg-amber-500/10 text-xs"
                      onClick={() => importOrphanMutation.mutate(name)}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />Gérer
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && filteredOrphans.length === 0 && (
            <div className="text-center py-16">
              <Tag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">
                {search ? 'Aucune catégorie trouvée' : 'Aucune catégorie créée'}
              </p>
              {!search && (
                <Button onClick={openNew} className="mt-4 gap-2" variant="outline">
                  <Plus className="h-4 w-4" />Créer la première catégorie
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div
                className="h-7 w-7 rounded-lg flex items-center justify-center text-white"
                style={{ backgroundColor: form.color }}
              >
                <Tag className="h-4 w-4" />
              </div>
              {editing ? `Modifier "${editing.name}"` : 'Nouvelle catégorie'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label>Nom de la catégorie *</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex : Téléphones, Câbles, Accessoires…"
                className="mt-1"
              />
              {editing && editing.name !== form.name && (
                <p className="text-xs text-amber-500 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Tous les produits sous «&nbsp;{editing.name}&nbsp;» seront mis à jour vers «&nbsp;{form.name || '…'}&nbsp;»
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <Label>Description <span className="text-muted-foreground font-normal">(optionnel)</span></Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description courte…"
                className="mt-1"
              />
            </div>

            {/* Color picker */}
            <div>
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className="h-8 w-8 rounded-lg border-2 transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: form.color === c ? '#fff' : 'transparent',
                      boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none',
                    }}
                    title={c}
                  />
                ))}
                {/* Custom color */}
                <label className="h-8 w-8 rounded-lg border-2 border-border/60 flex items-center justify-center cursor-pointer hover:border-primary/40 overflow-hidden transition-all" title="Couleur personnalisée">
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="opacity-0 absolute"
                  />
                  <div className="h-4 w-4 rounded-full border border-border/60" style={{ backgroundColor: form.color }} />
                </label>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 bg-muted/30 rounded-lg border border-border/50 flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center text-white shadow-sm flex-shrink-0"
                style={{ backgroundColor: form.color }}
              >
                <Tag className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-sm">{form.name || 'Nom de la catégorie'}</p>
                {form.description && <p className="text-xs text-muted-foreground">{form.description}</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={!form.name.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Sauvegarde…' : editing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={v => setConfirmState(s => ({ ...s, open: v }))}
        title={confirmState.title}
        description={confirmState.description}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
      />
    </div>
  );
}
