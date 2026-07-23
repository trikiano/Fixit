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
import { ShoppingCart, Plus, Search, Trash2, Package, Tag, Wrench, RotateCcw, BookOpen, CheckCircle2 } from 'lucide-react';
import ClientSelector from "@/components/ui/ClientSelector";
import { useAuth } from "@/lib/AuthContext";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Détecte le type d'un item à partir de ses données
function itemType(item) {
  if (!item) return 'product';
  if (item.product_id) return 'product';
  const name = item.product_name || '';
  if (name.startsWith('🔧')) return 'repair';
  if (name.startsWith('🏷') || name.startsWith('📦')) return 'service';
  return 'service'; // pas de product_id → prestation libre
}

const TYPE_META = {
  product: { icon: Package,  label: 'Produit',    cls: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/20' },
  service: { icon: Tag,      label: 'Service',    cls: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20' },
  repair:  { icon: Wrench,   label: 'Réparation', cls: 'text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-950/20' },
};

export default function Sales() {
  const { formatCurrency, generateTicketNumber } = useAppSettings();
  const { isResponsableOrAbove } = useAuth();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'vente' | 'retour'
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [items, setItems] = useState([]);
  const [clientName, setClientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('especes');
  const [notes, setNotes] = useState('');
  const [showArdoiseForm, setShowArdoiseForm] = useState(false);
  const [ardoisePersonName, setArdoisePersonName] = useState('');
  const [ardoiseComment, setArdoiseComment] = useState('');
  const [showPayForm, setShowPayForm] = useState(false);
  const [payMethodChoice, setPayMethodChoice] = useState('especes');
  const qc = useQueryClient();

  const { data: sales = [], isLoading } = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.Sale.list('-created_date') });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  // ── Mutation save ──
  const saveMutation = useMutation({
    mutationFn: async (saleData) => {
      if (editing) return base44.entities.Sale.update(editing.id, saleData);
      for (const item of saleData.items) {
        if (item.product_id) {
          const prod = products.find(p => p.id === item.product_id);
          if (prod) {
            const newQty = Math.max(0, (prod.quantity || 0) - item.quantity);
            await base44.entities.Product.update(prod.id, { quantity: newQty });
            await base44.entities.StockMovement.create({
              product_id: prod.id, product_name: prod.name, type: 'sortie',
              quantity: item.quantity, previous_stock: prod.quantity, new_stock: newQty,
              reason: `Vente ${saleData.sale_number}`, reference_type: 'vente'
            });
          }
        }
      }
      return base44.entities.Sale.create(saleData);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); qc.invalidateQueries({ queryKey: ['products'] }); closeDialog(); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setItems([]); setClientName(''); setPaymentMethod('especes'); setNotes(''); setShowArdoiseForm(false); setArdoisePersonName(''); setArdoiseComment(''); setShowPayForm(false); setPayMethodChoice('especes'); };

  // ── Gestion des lignes ──
  const addProductLine = () => setItems(prev => [...prev, { product_id: '', product_name: '', quantity: 1, unit_price: 0, discount: 0, total: 0 }]);
  const addServiceLine = () => setItems(prev => [...prev, { product_id: null, product_name: '', quantity: 1, unit_price: 0, discount: 0, total: 0 }]);

  const updateItem = (idx, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'product_id' && value) {
        const prod = products.find(p => p.id === value);
        if (prod) { next[idx].product_name = prod.name; next[idx].unit_price = prod.sell_price || 0; }
      }
      next[idx].total = (next[idx].quantity * next[idx].unit_price) - (next[idx].discount || 0);
      return next;
    });
  };

  const switchToService = (idx) => setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], product_id: null }; return n; });
  const switchToProduct = (idx) => setItems(prev => { const n = [...prev]; n[idx] = { ...n[idx], product_id: '', product_name: '' }; return n; });
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const total = items.reduce((s, i) => s + (i.total || 0), 0);

  const ardoiseNames = [...new Set(sales.filter(s => s.payment_method === 'ardoise' && s.client_name).map(s => s.client_name))].sort();

  // ── Mutation changement de statut (ardoise ↔ payée) ──
  const updateStatusMutation = useMutation({
    mutationFn: (data) => base44.entities.Sale.update(editing.id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sales'] }); closeDialog(); },
  });

  const handleSave = () => {
    const saleNum = generateTicketNumber('sale');
    saveMutation.mutate({
      sale_number: editing?.sale_number || saleNum, client_name: clientName, type: 'vente',
      items, subtotal: total, discount_total: items.reduce((s, i) => s + (i.discount || 0), 0),
      total, payment_method: paymentMethod,
      payments: [{ method: paymentMethod, amount: total }], status: 'completee', notes
    });
  };

  const openEdit = (s) => {
    setEditing(s); setItems(s.items || []); setClientName(s.client_name || '');
    setPaymentMethod(s.payment_method || 'especes'); setNotes(s.notes || '');
    setDialogOpen(true);
  };

  // ── Filtres ──
  const filtered = sales.filter(s => {
    const matchSearch = !search ||
      s.sale_number?.toLowerCase().includes(search.toLowerCase()) ||
      s.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      (s.items || []).some(i => i.product_name?.toLowerCase().includes(search.toLowerCase()));
    const matchType = filterType === 'all' || s.type === filterType;
    return matchSearch && matchType;
  });

  // ── Colonnes table ──
  const columns = [
    { header: "N° Vente", render: r => (
      <div className="flex items-center gap-2">
        {r.type === 'retour' && <RotateCcw className="h-3 w-3 text-rose-500 flex-shrink-0" />}
        <span className={cn("text-sm font-mono font-medium", r.type === 'retour' ? 'text-rose-600' : 'text-primary')}>{r.sale_number || '-'}</span>
      </div>
    )},
    { header: "Client", render: r => <span className="text-sm">{r.client_name || 'Anonyme'}</span> },
    { header: "Articles", render: r => {
      const its = r.items || [];
      if (its.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap gap-1 max-w-[260px]">
          {its.slice(0, 3).map((it, i) => {
            const t = itemType(it);
            const Meta = TYPE_META[t];
            return (
              <span key={i} className={cn("inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border", Meta.cls)}>
                <Meta.icon className="h-2.5 w-2.5" />
                <span className="truncate max-w-[120px]">{it.product_name || '—'}</span>
              </span>
            );
          })}
          {its.length > 3 && <span className="text-[10px] text-muted-foreground">+{its.length - 3}</span>}
        </div>
      );
    }},
    { header: "Total", render: r => <span className={cn("text-sm font-bold", r.type === 'retour' ? 'text-rose-600' : '')}>{r.type === 'retour' ? '−' : ''}{formatCurrency(r.total || 0)}</span> },
    { header: "Paiement", render: r => {
      if (r.payment_method === 'ardoise' || r.status === 'non_payee') {
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800">
            📒 Ardoise
          </span>
        );
      }
      const labels = { especes: '💵 Espèces', carte: '💳 Carte', virement: '🏦 Virement', mixte: '🔀 Mixte', bon_achat: '🎫 Bon d\'achat' };
      return <span className="text-xs">{labels[r.payment_method] || r.payment_method || '—'}</span>;
    }},
    { header: "Statut", render: r => <StatusBadge status={r.status} /> },
    { header: "Date", render: r => <span className="text-xs text-muted-foreground">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy HH:mm') : '-'}</span> },
  ];

  const isReadOnly = !!editing; // les ventes existantes sont affichées en lecture seule

  return (
    <div>
      <PageHeader title="Ventes" subtitle={`${sales.length} vente(s)`}>
        <Button onClick={() => { setDialogOpen(true); }}><Plus className="h-4 w-4 mr-2" />Nouvelle vente</Button>
      </PageHeader>

      {/* Barre de recherche + filtres */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="N° vente, client, article..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
          {[['all','Toutes'],['vente','Ventes'],['retour','Retours']].map(([v, l]) => (
            <button key={v} onClick={() => setFilterType(v)}
              className={cn("px-3 py-1 text-xs font-medium rounded transition-colors", filterType === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {v === 'retour' && <RotateCcw className="inline h-3 w-3 mr-1 text-rose-500" />}{l}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={ShoppingCart} title="Aucune vente" description="Effectuez votre première vente" actionLabel="Nouvelle vente" onAction={() => setDialogOpen(true)} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}

      {/* ── DIALOG ── */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing?.type === 'retour' && <RotateCcw className="h-4 w-4 text-rose-500" />}
              {editing ? `${editing.type === 'retour' ? 'Retour' : 'Vente'} — ${editing.sale_number}` : 'Nouvelle vente'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Client + paiement */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Client</Label>
                {isReadOnly ? (
                  <p className="text-sm font-medium mt-1 px-3 py-2 rounded-md bg-muted/30">{editing.client_name || 'Anonyme'}</p>
                ) : (
                  <ClientSelector clientName={clientName} clientPhone={''} onSelect={setClientName} defaultPassager />
                )}
              </div>
              <div>
                <Label>Mode de paiement</Label>
                {isReadOnly ? (
                  <p className="text-sm font-medium mt-1 px-3 py-2 rounded-md bg-muted/30 capitalize">{editing.payment_method?.replace('_', ' ') || '—'}</p>
                ) : (
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="especes">💵 Espèces</SelectItem>
                      <SelectItem value="carte">💳 Carte</SelectItem>
                      <SelectItem value="virement">🏦 Virement</SelectItem>
                      <SelectItem value="mixte">🔀 Mixte</SelectItem>
                      <SelectItem value="bon_achat">🎫 Bon d'achat</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Lignes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Articles</Label>
                {!isReadOnly && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addProductLine}>
                      <Package className="h-3 w-3 mr-1 text-blue-500" />Produit stock
                    </Button>
                    <Button variant="outline" size="sm" onClick={addServiceLine}>
                      <Tag className="h-3 w-3 mr-1 text-emerald-500" />Prestation libre
                    </Button>
                  </div>
                )}
              </div>

              {items.length === 0 && (
                <div className="flex flex-col items-center py-8 text-muted-foreground/40 border border-dashed border-border rounded-lg">
                  <ShoppingCart className="h-8 w-8 mb-2" />
                  <p className="text-sm">{isReadOnly ? 'Aucun article' : 'Ajoutez des produits ou prestations'}</p>
                </div>
              )}

              <div className="space-y-2">
                {items.map((item, idx) => {
                  const t = itemType(item);
                  const Meta = TYPE_META[t];
                  const isProduct = !!item.product_id || (item.product_id === '' && !isReadOnly);
                  const lineTotal = item.quantity * item.unit_price * (1 - (Math.min(100, item.discount || 0) / 100));

                  if (isReadOnly) {
                    // Lecture seule
                    return (
                      <div key={idx} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border", Meta.cls)}>
                        <div className="h-8 w-8 rounded-full bg-white/60 dark:bg-black/20 flex items-center justify-center flex-shrink-0">
                          <Meta.icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.product_name || '—'}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} × {formatCurrency(item.unit_price)}
                            {item.discount > 0 && <span className="text-orange-500 ml-1">−{item.discount}%</span>}
                          </p>
                        </div>
                        <span className="text-sm font-bold flex-shrink-0">{formatCurrency(lineTotal)}</span>
                      </div>
                    );
                  }

                  // Édition
                  return (
                    <div key={idx} className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                      {/* Badge type + toggle */}
                      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border", Meta.cls)}>
                          <Meta.icon className="h-2.5 w-2.5" />{Meta.label}
                        </span>
                        {t !== 'repair' && (
                          <button type="button"
                            onClick={() => isProduct ? switchToService(idx) : switchToProduct(idx)}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline">
                            Changer en {isProduct ? 'prestation libre' : 'produit stock'}
                          </button>
                        )}
                        <button type="button" onClick={() => removeItem(idx)} className="ml-auto text-muted-foreground/50 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-12 gap-2 items-end px-3 pb-3">
                        {/* Désignation */}
                        <div className="col-span-5">
                          <Label className="text-xs">Désignation</Label>
                          {isProduct ? (
                            <Select value={item.product_id || ''} onValueChange={v => updateItem(idx, 'product_id', v)}>
                              <SelectTrigger><SelectValue placeholder="Choisir un produit..." /></SelectTrigger>
                              <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.quantity} en stock)</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={item.product_name}
                              placeholder="Ex : Diagnostic, Main d'œuvre..."
                              onChange={e => updateItem(idx, 'product_name', e.target.value)}
                            />
                          )}
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Qté</Label>
                          <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Prix unit.</Label>
                          <Input type="number" step="0.001" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Remise %</Label>
                          <Input type="number" min={0} max={100} value={item.discount || 0} onChange={e => updateItem(idx, 'discount', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div className="col-span-1 text-right font-bold text-sm pt-5">{formatCurrency(lineTotal)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Récap total */}
            <div className="flex items-end justify-between pt-2 border-t border-border">
              {!isReadOnly && (
                <div className="w-48">
                  <Label className="text-xs">Notes</Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Note interne..." />
                </div>
              )}
              {isReadOnly && editing?.notes && (
                <p className="text-xs text-muted-foreground italic">{editing.notes}</p>
              )}
              <div className="text-right ml-auto">
                {items.some(i => i.discount > 0) && (
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Remises : −{formatCurrency(items.reduce((s, i) => s + (i.quantity * i.unit_price * (i.discount || 0) / 100), 0))}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Total</p>
                <p className={cn("text-2xl font-bold", editing?.type === 'retour' ? 'text-rose-600' : 'text-primary')}>
                  {editing?.type === 'retour' ? '−' : ''}{formatCurrency(isReadOnly ? (editing?.total || 0) : total)}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-1">
              {/* Formulaire inline → Mettre sur ardoise */}
              {isReadOnly && showArdoiseForm && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/10 p-3 space-y-2.5">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4" />Convertir en ardoise (non payé)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Nom de la personne *</Label>
                      <Input list="ardoise-names-edit" value={ardoisePersonName} onChange={e => setArdoisePersonName(e.target.value)} placeholder="Nom..." />
                      <datalist id="ardoise-names-edit">
                        {ardoiseNames.map(n => <option key={n} value={n} />)}
                      </datalist>
                    </div>
                    <div>
                      <Label className="text-xs">Commentaire</Label>
                      <Input value={ardoiseComment} onChange={e => setArdoiseComment(e.target.value)} placeholder="Optionnel..." />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowArdoiseForm(false)}>Annuler</Button>
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white"
                      disabled={!ardoisePersonName.trim() || updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({ payment_method: 'ardoise', status: 'non_payee', client_name: ardoisePersonName.trim(), notes: ardoiseComment || editing.notes })}>
                      {updateStatusMutation.isPending ? 'Enregistrement...' : 'Confirmer l\'ardoise'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Formulaire inline → Marquer comme payée */}
              {isReadOnly && showPayForm && (
                <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-950/10 p-3 space-y-2.5">
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />Marquer comme payée
                  </p>
                  <div>
                    <Label className="text-xs">Mode de paiement</Label>
                    <Select value={payMethodChoice} onValueChange={setPayMethodChoice}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="especes">💵 Espèces</SelectItem>
                        <SelectItem value="carte">💳 Carte</SelectItem>
                        <SelectItem value="virement">🏦 Virement</SelectItem>
                        <SelectItem value="mixte">🔀 Mixte</SelectItem>
                        <SelectItem value="bon_achat">🎫 Bon d'achat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setShowPayForm(false)}>Annuler</Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                      disabled={updateStatusMutation.isPending}
                      onClick={() => updateStatusMutation.mutate({ payment_method: payMethodChoice, status: 'completee', client_name: editing.client_name, notes: editing.notes })}>
                      {updateStatusMutation.isPending ? 'Enregistrement...' : 'Confirmer le paiement'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                {/* Boutons de changement de statut (ventes existantes uniquement) */}
                <div className="flex gap-2">
                  {isReadOnly && isResponsableOrAbove && editing?.status !== 'non_payee' && editing?.type !== 'retour' && !showArdoiseForm && (
                    <Button variant="outline" size="sm"
                      className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/20"
                      onClick={() => { setArdoisePersonName(editing?.client_name || ''); setArdoiseComment(editing?.notes || ''); setShowPayForm(false); setShowArdoiseForm(true); }}>
                      <BookOpen className="h-3.5 w-3.5 mr-1.5" />Sur ardoise
                    </Button>
                  )}
                  {isReadOnly && isResponsableOrAbove && editing?.status === 'non_payee' && !showPayForm && (
                    <Button variant="outline" size="sm"
                      className="border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/20"
                      onClick={() => { setShowArdoiseForm(false); setPayMethodChoice('especes'); setShowPayForm(true); }}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Marquer payée
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeDialog}>Fermer</Button>
                  {!isReadOnly && (
                    <Button onClick={handleSave} disabled={items.length === 0 || saveMutation.isPending}>
                      {saveMutation.isPending ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Valider la vente'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
