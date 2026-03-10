import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search, ShoppingCart, Trash2, Plus, Minus, CheckCircle,
  Package, ArrowLeft, Tag, CreditCard, Banknote, Smartphone, Wrench, Wifi
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { useAppSettings } from "@/components/settings/SettingsContext";
import ClientSelector from "@/components/ui/ClientSelector";
import QuickRepairModal from "@/components/pos/QuickRepairModal";
import NewSaleModal from "@/components/internet/NewSaleModal";

const ACCOUNTS = ['Compte Principal', 'Compte 2', 'Application A', 'Application B'];

const PAYMENT_METHODS = [
  { value: 'especes', label: 'Espèces', icon: Banknote },
  { value: 'carte', label: 'Carte', icon: CreditCard },
  { value: 'virement', label: 'Virement', icon: Smartphone },
  { value: 'mixte', label: 'Mixte', icon: Tag },
];

const CATEGORY_LABELS = {
  telephone: '📱 Téléphones',
  ordinateur: '💻 PC / Ordis',
  tablette: '🖥️ Tablettes',
  chargeur: '🔌 Chargeurs',
  cable: '🔗 Câbles',
  accessoire: '🎧 Accessoires',
  piece_detachee: '🔧 Pièces',
  console: '🎮 Consoles',
  autre: '📦 Autre',
};

export default function POS() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [clientName, setClientName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('especes');
  const [discount, setDiscount] = useState(0);
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastSaleNum, setLastSaleNum] = useState('');
  const qc = useQueryClient();

  const { formatCurrency, settings, generateTicketNumber } = useAppSettings();
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });

  const saleMutation = useMutation({
    mutationFn: async () => {
      const saleNum = generateTicketNumber('sale');
      const saleItems = cart.map(item => ({
        product_id: item.id, product_name: item.name,
        quantity: item.qty, unit_price: item.sell_price, discount: 0, total: item.qty * item.sell_price
      }));
      const subtotal = saleItems.reduce((s, i) => s + i.total, 0);
      const total = Math.max(0, subtotal - discount);
      // Decrease stock
      for (const item of cart) {
        const prod = products.find(p => p.id === item.id);
        if (prod) {
          await base44.entities.Product.update(prod.id, { quantity: Math.max(0, (prod.quantity || 0) - item.qty) });
          await base44.entities.StockMovement.create({
            product_id: prod.id, product_name: prod.name, type: 'sortie',
            quantity: item.qty, previous_stock: prod.quantity, new_stock: Math.max(0, (prod.quantity || 0) - item.qty),
            reason: `POS ${saleNum}`, reference_type: 'vente'
          });
        }
      }
      await base44.entities.Sale.create({
        sale_number: saleNum, client_name: clientName || 'Client comptoir', type: 'vente',
        items: saleItems, subtotal, discount_total: discount, total,
        payment_method: paymentMethod, payments: [{ method: paymentMethod, amount: total }], status: 'completee'
      });
      return saleNum;
    },
    onSuccess: (saleNum) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      setLastSaleNum(saleNum);
      setSuccessOpen(true);
      setCart([]);
      setClientName('');
      setDiscount(0);
      setPaymentMethod('especes');
    },
  });

  const filtered = products.filter(p => {
    if (p.is_active === false || p.quantity <= 0) return false;
    const ms = p.name?.toLowerCase().includes(search.toLowerCase()) || p.brand?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase());
    const mc = activeCategory === 'all' || p.category === activeCategory;
    return ms && mc;
  });

  const categories = ['all', ...Object.keys(CATEGORY_LABELS).filter(c => products.some(p => p.category === c && p.quantity > 0))];

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        if (existing.qty >= product.quantity) return prev;
        return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i).filter(i => i.qty > 0));
  };
  const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

  const subtotal = cart.reduce((s, i) => s + i.qty * i.sell_price, 0);
  const total = Math.max(0, subtotal - discount);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-1 pb-4">
        <Link to={createPageUrl("Dashboard")}>
          <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" /> Caisse POS
        </h1>
        {cartCount > 0 && <Badge className="bg-primary text-primary-foreground">{cartCount} article{cartCount > 1 ? 's' : ''}</Badge>}
      </div>

      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        {/* LEFT: Products */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher produit, marque, SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          {/* Categories */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0",
                  activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {cat === 'all' ? 'Tous' : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map(product => {
                const inCart = cart.find(i => i.id === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={cn(
                      "relative p-3 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-95",
                      inCart ? "border-primary bg-primary/10" : "border-border/50 bg-card hover:border-primary/50"
                    )}
                  >
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-16 w-full rounded-lg object-cover mb-2" />
                    ) : (
                      <div className="h-16 w-full rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                        <Package className="h-7 w-7 text-primary/60" />
                      </div>
                    )}
                    <p className="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
                    {product.brand && <p className="text-xs text-muted-foreground mt-0.5">{product.brand}</p>}
                    <p className="text-sm font-bold text-primary mt-1">{(product.sell_price || 0).toFixed(2)} €</p>
                    <p className="text-xs text-muted-foreground">Stock: {product.quantity}</p>
                    {inCart && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary-foreground">{inCart.qty}</span>
                      </div>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun produit disponible</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Cart */}
        <div className="w-80 xl:w-96 flex flex-col gap-3 overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden border-border/50">
            <div className="p-3 border-b border-border/50">
              <ClientSelector
                clientName={clientName}
                clientPhone={''}
                onSelect={(name) => setClientName(name || 'Client comptoir')}
                defaultPassager={true}
              />
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Panier vide</p>
                  <p className="text-xs text-muted-foreground">Cliquez sur un produit</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-xs text-primary font-bold">{formatCurrency(item.sell_price || 0)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.id, -1)} className="h-6 w-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80">
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="text-sm font-bold w-5 text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} disabled={item.qty >= item.quantity} className="h-6 w-6 rounded-md bg-muted flex items-center justify-center hover:bg-muted/80 disabled:opacity-40">
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-xs font-bold w-14 text-right">{(item.qty * item.sell_price).toFixed(2)} €</p>
                    <button onClick={() => removeFromCart(item.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Totals & Payment */}
            <div className="p-3 border-t border-border/50 space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <Input type="number" placeholder="Remise (€)" value={discount || ''} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} className="h-7 text-xs" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Sous-total</span><span>{subtotal.toFixed(2)} €</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-xs text-destructive">
                    <span>Remise</span><span>-{discount.toFixed(2)} €</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold">
                  <span className="text-sm">Total</span>
                  <span className="text-lg text-primary">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Payment method */}
              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_METHODS.map(pm => (
                  <button
                    key={pm.value}
                    onClick={() => setPaymentMethod(pm.value)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all",
                      paymentMethod === pm.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    <pm.icon className="h-3.5 w-3.5" />
                    {pm.label}
                  </button>
                ))}
              </div>

              <Button
                className="w-full gap-2 font-bold"
                size="lg"
                onClick={() => saleMutation.mutate()}
                disabled={cart.length === 0 || saleMutation.isPending}
              >
                <CheckCircle className="h-4 w-4" />
                {saleMutation.isPending ? 'Traitement...' : `Encaisser ${formatCurrency(total)}`}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold">Vente validée !</h2>
            <p className="text-sm text-muted-foreground">N° <span className="font-mono font-bold text-foreground">{lastSaleNum}</span></p>
            <Button className="w-full mt-2" onClick={() => setSuccessOpen(false)}>Nouvelle vente</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}