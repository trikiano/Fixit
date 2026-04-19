import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fixit } from '@/api/fixitClient';
import { toast } from 'sonner';
import { PackagePlus, Save, CheckCircle, ArrowRight, Search, AlertTriangle } from 'lucide-react';

export default function InitialInventory() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [quantities, setQuantities] = useState({});
  const [prices, setPrices] = useState({});
  const [saved, setSaved] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => fixit.entities.Product.list('-created_date'),
  });

  const filtered = products.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const changed = Object.entries(quantities).filter(([, v]) => v > 0);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(quantities).filter(([, qty]) => qty > 0);
      for (const [productId, qty] of entries) {
        const product = products.find(p => p.id === productId);
        const prev = product?.quantity || 0;
        const newQty = prev + parseInt(qty);
        const buyPrice = prices[productId] ? parseFloat(prices[productId]) : (product?.buy_price || 0);

        // Update product quantity
        await fixit.entities.Product.update(productId, {
          quantity: newQty,
          buy_price: buyPrice || product?.buy_price,
          buy_price_avg: buyPrice || product?.buy_price_avg,
        });

        // Create stock movement
        await fixit.entities.StockMovement.create({
          product_id: productId,
          type: 'entree',
          quantity: parseInt(qty),
          previous_stock: prev,
          new_stock: newQty,
          reason: 'Stock initial — inventaire de départ',
          reference_type: 'inventaire',
          unit_cost: buyPrice,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['stockmovements'] });
      toast.success(`Stock mis à jour pour ${changed.length} produit(s)`);
      setQuantities({});
      setPrices({});
      setSaved(true);
    },
    onError: (err) => toast.error('Erreur : ' + err.message),
  });

  if (saved && changed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Stock initialisé !</h2>
        <p className="text-muted-foreground mb-6">Votre inventaire de départ a été enregistré avec succès.</p>
        <button onClick={() => setSaved(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          <ArrowRight className="h-4 w-4" /> Continuer
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <PackagePlus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Inventaire initial</h1>
            <p className="text-sm text-muted-foreground">Entrez les quantités de vos produits existants</p>
          </div>
        </div>
        {changed.length > 0 && (
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saveMutation.isPending ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Enregistrer ({changed.length} produit{changed.length > 1 ? 's' : ''})
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-700">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>Entrez uniquement les quantités à <strong>ajouter</strong> au stock actuel. Un mouvement de stock "Inventaire initial" sera créé automatiquement pour chaque produit.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un produit..."
          className="w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
        />
      </div>

      {/* Products table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase">Produit</th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground uppercase w-24">Stock actuel</th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground uppercase w-32">Qté à ajouter</th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground uppercase w-32">Prix d'achat</th>
                <th className="text-center p-3 text-xs font-medium text-muted-foreground uppercase w-24">Nouveau stock</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Chargement...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Aucun produit trouvé</td></tr>
              ) : (
                filtered.map(product => {
                  const qty = quantities[product.id] || '';
                  const price = prices[product.id] || '';
                  const addQty = parseInt(qty) || 0;
                  const newStock = (product.quantity || 0) + addQty;
                  const hasChange = addQty > 0;

                  return (
                    <tr key={product.id} className={`border-b border-border last:border-0 transition-colors ${hasChange ? 'bg-primary/5' : 'hover:bg-muted/20'}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} className="h-8 w-8 rounded object-cover shrink-0" alt="" />
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0 text-xs text-muted-foreground">📦</div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-foreground">{product.name}</p>
                            {product.sku && <p className="text-xs text-muted-foreground">{product.sku}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-sm font-bold ${(product.quantity || 0) === 0 ? 'text-destructive' : 'text-foreground'}`}>
                          {product.quantity || 0}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={qty}
                          onChange={e => setQuantities(prev => ({ ...prev, [product.id]: e.target.value }))}
                          placeholder="0"
                          className={`w-24 h-9 text-center rounded-lg border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all ${
                            hasChange ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background text-foreground'
                          }`}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={price}
                          onChange={e => setPrices(prev => ({ ...prev, [product.id]: e.target.value }))}
                          placeholder={product.buy_price || '0'}
                          className="w-28 h-9 text-center rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-sm font-bold ${hasChange ? 'text-green-600' : 'text-muted-foreground'}`}>
                          {hasChange ? newStock : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer summary */}
      {changed.length > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10 border border-primary/20">
          <div className="text-sm text-primary">
            <span className="font-bold">{changed.length}</span> produit{changed.length > 1 ? 's' : ''} à mettre à jour —{' '}
            <span className="font-bold">{changed.reduce((acc, [, v]) => acc + (parseInt(v) || 0), 0)}</span> unités au total
          </div>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            Enregistrer le stock
          </button>
        </div>
      )}
    </div>
  );
}
