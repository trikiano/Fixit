import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Search, Package, ArrowLeft, Wrench, Wifi, User,
  Delete, CheckCircle, Home, ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { useAppSettings } from "@/components/settings/SettingsContext";
import ClientSelector from "@/components/ui/ClientSelector";
import QuickRepairModal from "@/components/pos/QuickRepairModal";
import NewSaleModal from "@/components/internet/NewSaleModal";
import { Button } from "@/components/ui/button";

const ACCOUNTS = ['Compte Principal', 'Compte 2', 'Application A', 'Application B'];

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

// Numpad modes
const MODES = ['Qté', 'Remise', 'Prix'];

export default function POS() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState([]);
  const [selectedCartIdx, setSelectedCartIdx] = useState(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('especes');
  const [numpadMode, setNumpadMode] = useState('Qté');
  const [numpadBuffer, setNumpadBuffer] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastSaleNum, setLastSaleNum] = useState('');
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showForfaitModal, setShowForfaitModal] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const qc = useQueryClient();

  const { formatCurrency, settings, generateTicketNumber } = useAppSettings();
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: packages = [] } = useQuery({ queryKey: ['internet-packages'], queryFn: () => base44.entities.InternetPackage.list() });

  const repairMutation = useMutation({
    mutationFn: async (data) => {
      const ticketNum = generateTicketNumber('repair');
      return base44.entities.Repair.create({ ...data, ticket_number: ticketNum });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repairs'] }),
  });

  const internetSaleMutation = useMutation({
    mutationFn: (data) => base44.entities.InternetSale.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['internet-sales'] }),
  });

  const saleMutation = useMutation({
    mutationFn: async () => {
      const saleNum = generateTicketNumber('sale');
      const saleItems = cart.map(item => ({
        product_id: item.id, product_name: item.name,
        quantity: item.qty, unit_price: item.unit_price,
        discount: item.discount || 0,
        total: item.qty * item.unit_price * (1 - (item.discount || 0) / 100)
      }));
      const subtotal = saleItems.reduce((s, i) => s + i.total, 0);
      for (const item of cart) {
        const prod = products.find(p => p.id === item.id);
        if (prod) {
          await base44.entities.Product.update(prod.id, { quantity: Math.max(0, (prod.quantity || 0) - item.qty) });
          await base44.entities.StockMovement.create({
            product_id: prod.id, product_name: prod.name, type: 'sortie',
            quantity: item.qty, previous_stock: prod.quantity,
            new_stock: Math.max(0, (prod.quantity || 0) - item.qty),
            reason: `POS ${saleNum}`, reference_type: 'vente'
          });
        }
      }
      await base44.entities.Sale.create({
        sale_number: saleNum, client_name: clientName || 'Client comptoir', type: 'vente',
        items: saleItems, subtotal, discount_total: 0, total: subtotal,
        payment_method: paymentMethod,
        payments: [{ method: paymentMethod, amount: subtotal }],
        status: 'completee'
      });
      return saleNum;
    },
    onSuccess: (saleNum) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      setLastSaleNum(saleNum);
      setSuccessOpen(true);
      setShowPaymentDialog(false);
      setCart([]);
      setClientName('');
      setClientPhone('');
      setSelectedCartIdx(null);
      setNumpadBuffer('');
      setPaymentMethod('especes');
    },
  });

  // --- Cart helpers ---
  const addToCart = (product) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === product.id);
      if (idx >= 0) {
        if (prev[idx].qty >= product.quantity) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        setSelectedCartIdx(idx);
        return updated;
      }
      const newIdx = prev.length;
      setSelectedCartIdx(newIdx);
      setNumpadBuffer('');
      return [...prev, { ...product, qty: 1, unit_price: product.sell_price || 0, discount: 0 }];
    });
  };

  // --- Numpad logic ---
  const handleNumpad = useCallback((key) => {
    if (selectedCartIdx === null || !cart[selectedCartIdx]) return;

    let buf = numpadBuffer;

    if (key === '⌫') {
      buf = buf.slice(0, -1);
    } else if (key === '+/-') {
      buf = buf.startsWith('-') ? buf.slice(1) : '-' + buf;
    } else if (key === '.') {
      if (!buf.includes('.')) buf = buf + '.';
    } else {
      buf = buf + key;
    }

    setNumpadBuffer(buf);

    const val = parseFloat(buf);
    if (isNaN(val) && buf !== '' && buf !== '-' && buf !== '.') return;

    setCart(prev => {
      const updated = [...prev];
      const item = { ...updated[selectedCartIdx] };
      const numVal = isNaN(val) ? 0 : val;

      if (numpadMode === 'Qté') {
        const qty = Math.max(1, Math.round(numVal));
        item.qty = qty;
      } else if (numpadMode === 'Remise') {
        item.discount = Math.min(100, Math.max(0, numVal));
      } else if (numpadMode === 'Prix') {
        item.unit_price = Math.max(0, numVal);
      }
      updated[selectedCartIdx] = item;
      return updated;
    });
  }, [selectedCartIdx, numpadBuffer, numpadMode, cart]);

  const removeSelected = () => {
    if (selectedCartIdx === null) return;
    setCart(prev => prev.filter((_, i) => i !== selectedCartIdx));
    setSelectedCartIdx(null);
    setNumpadBuffer('');
  };

  const filtered = products.filter(p => {
    if (p.is_active === false || p.quantity <= 0) return false;
    const ms = p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase());
    const mc = activeCategory === 'all' || p.category === activeCategory;
    return ms && mc;
  });

  const categories = ['all', ...Object.keys(CATEGORY_LABELS).filter(c => products.some(p => p.category === c && p.quantity > 0))];

  const total = cart.reduce((s, i) => s + i.qty * i.unit_price * (1 - (i.discount || 0) / 100), 0);
  const selectedItem = selectedCartIdx !== null ? cart[selectedCartIdx] : null;

  const NUMPAD_KEYS = ['1','2','3','4','5','6','7','8','9','+/-','0','.','⌫'];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* TOP BAR */}
      <div className="h-12 bg-card border-b border-border flex items-center px-3 gap-3 flex-shrink-0">
        <Link to={createPageUrl("Dashboard")}>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
        </Link>
        <div className="h-5 w-px bg-border mx-1" />
        <span className="text-sm font-bold text-foreground">Caisse POS</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowRepairModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <Wrench className="h-3.5 w-3.5 text-orange-400" /> Maintenance
          </button>
          <button
            onClick={() => setShowForfaitModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <Wifi className="h-3.5 w-3.5 text-blue-400" /> Forfait
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* ===== LEFT PANEL: Cart + Numpad ===== */}
        <div className="w-72 xl:w-80 flex flex-col border-r border-border bg-card overflow-hidden flex-shrink-0">

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/40 text-xs">
                Aucun article
              </div>
            ) : (
              cart.map((item, idx) => {
                const lineTotal = item.qty * item.unit_price * (1 - (item.discount || 0) / 100);
                const isSelected = selectedCartIdx === idx;
                return (
                  <div
                    key={item.id + idx}
                    onClick={() => { setSelectedCartIdx(idx); setNumpadBuffer(''); }}
                    className={cn(
                      "px-3 py-2.5 border-b border-border/50 cursor-pointer transition-colors",
                      isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <p className={cn("text-sm font-medium leading-tight", isSelected ? "text-primary" : "text-foreground")}>
                        {item.name}
                      </p>
                      <p className="text-sm font-bold ml-2 flex-shrink-0">{formatCurrency(lineTotal)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.qty} × {formatCurrency(item.unit_price)}
                      {item.discount > 0 && <span className="text-destructive ml-1">({item.discount}% remise)</span>}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Total */}
          <div className="border-t border-border px-3 py-2 bg-muted/20">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-foreground">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Customer row */}
          <div className="border-t border-border px-2 py-1.5">
            <ClientSelector
              clientName={clientName}
              clientPhone={clientPhone}
              onSelect={(name, phone) => { setClientName(name || ''); setClientPhone(phone || ''); }}
              defaultPassager={true}
            />
          </div>

          {/* Numpad mode buttons */}
          <div className="border-t border-border grid grid-cols-3">
            {MODES.map(mode => (
              <button
                key={mode}
                onClick={() => { setNumpadMode(mode); setNumpadBuffer(''); }}
                className={cn(
                  "py-2 text-sm font-semibold transition-colors border-r last:border-r-0 border-border",
                  numpadMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Numpad buffer display */}
          <div className="border-t border-border px-3 py-1.5 bg-muted/10 text-right">
            <span className="text-lg font-mono font-bold text-foreground">
              {numpadBuffer || (selectedItem ? (
                numpadMode === 'Qté' ? selectedItem.qty :
                numpadMode === 'Remise' ? `${selectedItem.discount}%` :
                selectedItem.unit_price
              ) : '0')}
            </span>
          </div>

          {/* Numpad grid */}
          <div className="grid grid-cols-4 border-t border-border">
            {/* Digits 1-9 + special */}
            {['1','2','3','4','5','6','7','8','9','+/-','0','.'].map(k => (
              <button
                key={k}
                onClick={() => handleNumpad(k)}
                className="h-12 flex items-center justify-center text-base font-semibold border-r border-b border-border/50 hover:bg-muted/50 active:bg-muted transition-colors text-foreground"
              >
                {k}
              </button>
            ))}
            {/* Backspace — spans last col, rows 1-3 aligned */}
            <button
              onClick={() => handleNumpad('⌫')}
              className="h-12 flex items-center justify-center border-b border-border/50 hover:bg-muted/50 active:bg-muted transition-colors text-muted-foreground"
            >
              <Delete className="h-4 w-4" />
            </button>

            {/* Bottom row: Payment button full width */}
            <button
              onClick={() => setShowPaymentDialog(true)}
              disabled={cart.length === 0}
              className={cn(
                "col-span-3 h-12 flex items-center justify-center gap-2 text-sm font-bold border-r border-border/50 transition-colors",
                cart.length === 0
                  ? "text-muted-foreground bg-muted/20 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              Paiement
            </button>
            <button
              onClick={removeSelected}
              disabled={selectedCartIdx === null}
              className="h-12 flex items-center justify-center hover:bg-destructive/10 active:bg-destructive/20 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-border/50"
            >
              <Delete className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ===== RIGHT PANEL: Products ===== */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">

          {/* Category breadcrumb + search */}
          <div className="h-10 border-b border-border flex items-center px-3 gap-2 bg-card flex-shrink-0">
            <button
              onClick={() => setActiveCategory('all')}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Home className="h-4 w-4" />
            </button>
            {activeCategory !== 'all' && (
              <>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{CATEGORY_LABELS[activeCategory]}</span>
              </>
            )}
            <div className="ml-auto relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full h-7 pl-8 pr-3 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-1 px-3 py-2 border-b border-border bg-card flex-shrink-0 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setSearch(''); }}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-all flex-shrink-0",
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {cat === 'all' ? '🏠 Tous' : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
              {filtered.map(product => {
                const inCart = cart.find(i => i.id === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={cn(
                      "relative flex flex-col rounded-lg border text-left transition-all hover:shadow-md active:scale-95 overflow-hidden bg-card",
                      inCart ? "border-primary ring-1 ring-primary/30" : "border-border/50 hover:border-primary/40"
                    )}
                  >
                    {/* Price badge top-left */}
                    <div className="absolute top-1.5 left-1.5 z-10 bg-primary/90 text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {formatCurrency(product.sell_price || 0)}
                    </div>

                    {/* Qty badge top-right if in cart */}
                    {inCart && (
                      <div className="absolute top-1.5 right-1.5 z-10 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-[10px] font-bold text-primary-foreground">{inCart.qty}</span>
                      </div>
                    )}

                    {/* Image */}
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full aspect-square object-cover"
                      />
                    ) : (
                      <div className="w-full aspect-square bg-muted/40 flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}

                    {/* Name */}
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-medium leading-tight line-clamp-2 text-foreground">{product.name}</p>
                      {product.brand && <p className="text-[10px] text-muted-foreground">{product.brand}</p>}
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground/40">
                  <Package className="h-12 w-12 mb-3" />
                  <p className="text-sm">Aucun produit disponible</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== PAYMENT DIALOG ===== */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Paiement — {formatCurrency(total)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-sm">
              {cart.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.name} × {item.qty}</span>
                  <span>{formatCurrency(item.qty * item.unit_price * (1 - (item.discount || 0) / 100))}</span>
                </div>
              ))}
              <div className="border-t border-border/50 pt-1.5 flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment method selection */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'especes', label: '💵 Espèces' },
                { value: 'carte', label: '💳 Carte' },
                { value: 'virement', label: '🏦 Virement' },
                { value: 'mixte', label: '🔀 Mixte' },
              ].map(pm => (
                <button
                  key={pm.value}
                  onClick={() => setPaymentMethod(pm.value)}
                  className={cn(
                    "py-2.5 rounded-lg border text-sm font-medium transition-all",
                    paymentMethod === pm.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {pm.label}
                </button>
              ))}
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={() => saleMutation.mutate()}
              disabled={saleMutation.isPending}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {saleMutation.isPending ? 'Traitement...' : `Valider — ${formatCurrency(total)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold">Vente validée !</h2>
            <p className="text-sm text-muted-foreground">N° <span className="font-mono font-bold text-foreground">{lastSaleNum}</span></p>
            <Button className="w-full mt-2" onClick={() => setSuccessOpen(false)}>Nouvelle vente</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <QuickRepairModal open={showRepairModal} onClose={() => setShowRepairModal(false)} onSave={repairMutation.mutateAsync} />
      <NewSaleModal open={showForfaitModal} onClose={() => setShowForfaitModal(false)} packages={packages} accounts={ACCOUNTS} onSave={internetSaleMutation.mutateAsync} />
    </div>
  );
}