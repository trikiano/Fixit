import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Package } from 'lucide-react';
import { useAppSettings } from "@/components/settings/SettingsContext";

export default function PartsManager({ parts = [], onChange, repairId }) {
  const qc = useQueryClient();
  const { formatCurrency } = useAppSettings();
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date', 500),
  });

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );

  const addPart = (product) => {
    const existing = parts.find(p => p.product_id === product.id);
    if (existing) {
      onChange(parts.map(p => p.product_id === product.id ? { ...p, quantity: p.quantity + 1, total: (p.quantity + 1) * p.unit_price } : p));
    } else {
      onChange([...parts, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.buy_price || 0,
        total: product.buy_price || 0,
      }]);
    }
    setSearch('');
    setShowSearch(false);
  };

  const removePart = (idx) => onChange(parts.filter((_, i) => i !== idx));
  const updateQty = (idx, qty) => {
    const updated = [...parts];
    updated[idx] = { ...updated[idx], quantity: qty, total: qty * updated[idx].unit_price };
    onChange(updated);
  };
  const updatePrice = (idx, price) => {
    const updated = [...parts];
    updated[idx] = { ...updated[idx], unit_price: price, total: updated[idx].quantity * price };
    onChange(updated);
  };

  const totalCost = parts.reduce((s, p) => s + (p.total || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Pièces utilisées</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowSearch(!showSearch)}>
          <Plus className="h-3.5 w-3.5 mr-1" />Ajouter une pièce
        </Button>
      </div>

      {showSearch && (
        <div className="relative">
          <Input
            placeholder="Rechercher un produit/pièce..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          {search && filtered.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addPart(p)}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.brand} — Stock: {p.quantity}</p>
                  </div>
                  <span className="font-medium text-primary">{formatCurrency(p.buy_price || 0)}</span>
                </button>
              ))}
            </div>
          )}
          {search && filtered.length === 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg p-3 text-center text-sm text-muted-foreground">
              Aucun produit trouvé
            </div>
          )}
        </div>
      )}

      {parts.length > 0 ? (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-muted/30 text-xs text-muted-foreground font-medium">
            <span className="col-span-5">Pièce</span>
            <span className="col-span-2 text-center">Qté</span>
            <span className="col-span-3 text-center">Prix unit.</span>
            <span className="col-span-1 text-right">Total</span>
            <span className="col-span-1"></span>
          </div>
          {parts.map((part, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-t border-border/30 text-sm">
              <div className="col-span-5">
                <p className="font-medium truncate">{part.product_name}</p>
              </div>
              <div className="col-span-2">
                <Input
                  type="number"
                  min="1"
                  value={part.quantity}
                  onChange={e => updateQty(idx, parseFloat(e.target.value) || 1)}
                  className="h-7 text-center px-1"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={part.unit_price}
                  onChange={e => updatePrice(idx, parseFloat(e.target.value) || 0)}
                  className="h-7 text-center px-1"
                />
              </div>
              <div className="col-span-1 text-right font-medium">
                {formatCurrency(part.total || 0)}
              </div>
              <div className="col-span-1 flex justify-end">
                <button type="button" onClick={() => removePart(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          <div className="px-3 py-2 bg-muted/20 border-t border-border/50 flex justify-between text-sm font-semibold">
            <span>Total pièces</span>
            <span className="text-primary">{formatCurrency(totalCost)}</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
          <Package className="h-5 w-5 mx-auto mb-1 opacity-40" />
          Aucune pièce assignée à cette réparation
        </div>
      )}
    </div>
  );
}