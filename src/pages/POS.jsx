import React, { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search, Package, ArrowLeft, Delete, CheckCircle, Home, Plus, X, User, Phone, Wrench, Clock, MessageSquare, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { useAppSettings } from "@/components/settings/SettingsContext";
import { Button } from "@/components/ui/button";

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

const MODES = ['Qté', 'Remise', 'Prix'];

function createEmptyTicket(id) {
  return { id, cart: [], clientName: '', clientPhone: '', selectedCartIdx: null, numpadBuffer: '', numpadMode: 'Qté' };
}

let ticketCounter = 1;

export default function POS() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  // Pré-charger un article depuis URL params (ex: ?preload=repair:id:label:price:client)
  const [tickets, setTickets] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const preload = params.get('preload');
    const t = createEmptyTicket(1);
    if (preload) {
      const parts = preload.split(':');
      const [type, id, label, price, clientName, clientPhone] = parts;
      if (label && price) {
        const itemName = type === 'repair' ? `🔧 ${decodeURIComponent(label)}` : `📦 ${decodeURIComponent(label)}`;
        t.cart = [{ id: `preload_${id}`, name: itemName, qty: 1, unit_price: parseFloat(price) || 0, discount: 0, isCustom: true, refId: id, refType: type }];
        t.clientName = clientName ? decodeURIComponent(clientName) : '';
        t.clientPhone = clientPhone ? decodeURIComponent(clientPhone) : '';
        t.selectedCartIdx = 0;
      }
    }
    return [t];
  });
  const [activeTicketId, setActiveTicketId] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('especes');
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastSaleNum, setLastSaleNum] = useState('');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [user, setUser] = useState(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyTab, setHistoryTab] = useState('repairs');
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState(null); // null | 'ok' | 'error'
  const qc = useQueryClient();

  const { formatCurrency, generateTicketNumber, settings } = useAppSettings();
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list('-created_date', 500) });
  const { data: repairs = [] } = useQuery({ queryKey: ['repairs'], queryFn: () => base44.entities.Repair.list('-created_date', 200) });
  const { data: serviceSales = [] } = useQuery({ queryKey: ['serviceSales'], queryFn: () => base44.entities.ServiceSale.list('-created_date', 200) });


  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  // Active ticket helpers
  const ticket = tickets.find(t => t.id === activeTicketId) || tickets[0];
  const { cart, clientName, clientPhone, selectedCartIdx, numpadBuffer, numpadMode } = ticket;

  const updateTicket = (updates) => {
    setTickets(prev => prev.map(t => t.id === activeTicketId ? { ...t, ...updates } : t));
  };

  // --- Tickets management ---
  const addTicket = () => {
    ticketCounter += 1;
    const newT = createEmptyTicket(ticketCounter);
    setTickets(prev => [...prev, newT]);
    setActiveTicketId(ticketCounter);
  };

  const closeTicket = (id, e) => {
    e.stopPropagation();
    setTickets(prev => {
      const remaining = prev.filter(t => t.id !== id);
      if (remaining.length === 0) {
        ticketCounter += 1;
        const fresh = createEmptyTicket(ticketCounter);
        setActiveTicketId(fresh.id);
        return [fresh];
      }
      if (activeTicketId === id) {
        setActiveTicketId(remaining[remaining.length - 1].id);
      }
      return remaining;
    });
  };

  // --- Sale mutation ---

  const saleMutation = useMutation({
    mutationFn: async () => {
      const saleNum = generateTicketNumber('sale');
      // Snapshot avant de vider le panier
      setLastCartSnapshot({ cart: [...cart], clientName, clientPhone, total, saleNum });
      const saleItems = cart.map(item => ({
        product_id: item.id, product_name: item.name,
        quantity: item.qty, unit_price: item.unit_price,
        discount: item.discount || 0,
        total: item.qty * item.unit_price * (1 - (item.discount || 0) / 100)
      }));
      const subtotal = saleItems.reduce((s, i) => s + i.total, 0);
      for (const item of cart) {
        if (item.isCustom) continue;
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
      setSmsResult(null);
      updateTicket({ cart: [], clientName: '', clientPhone: '', selectedCartIdx: null, numpadBuffer: '', numpadMode: 'Qté' });
      setPaymentMethod('especes');
    },
  });

  // --- SMS ticket ---
  const [lastCartSnapshot, setLastCartSnapshot] = useState({ cart: [], clientName: '', clientPhone: '', total: 0, saleNum: '' });

  const sendTicketSms = async () => {
    const phone = lastCartSnapshot.clientPhone;
    if (!phone || !settings.sms_api_key || !settings.sms_provider) return;
    setSmsSending(true);
    try {
      const articlesLines = lastCartSnapshot.cart.map(item => {
        const line = `• ${item.name} x${item.qty} = ${formatCurrency(item.qty * item.unit_price * (1 - (item.discount || 0) / 100))}`;
        return line;
      }).join('\n');

      const template = settings.sms_ticket_template ||
        `🧾 Ticket {numero}\nBoutique: {boutique}\nClient: {client}\n\nArticles:\n{articles}\n\nTOTAL: {total}\n\nMerci !`;

      const message = template
        .replace('{numero}', lastCartSnapshot.saleNum)
        .replace('{boutique}', settings.shop_name || 'TechRepair Pro')
        .replace('{client}', lastCartSnapshot.clientName || 'Client')
        .replace('{articles}', articlesLines)
        .replace('{total}', formatCurrency(lastCartSnapshot.total));

      const res = await base44.functions.invoke('sendSms', {
        to: phone,
        message,
        provider: settings.sms_provider,
        apiKey: settings.sms_api_key,
        apiSecret: settings.sms_api_secret || '',
        from: settings.sms_from || '',
      });
      setSmsResult(res.data?.success ? 'ok' : 'error');
    } catch {
      setSmsResult('error');
    }
    setSmsSending(false);
  };

  // --- Cart helpers ---
  const addToCart = (product) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== activeTicketId) return t;
      const idx = t.cart.findIndex(i => i.id === product.id);
      if (idx >= 0) {
        if (t.cart[idx].qty >= product.quantity) return t;
        const updated = [...t.cart];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        return { ...t, cart: updated, selectedCartIdx: idx, numpadBuffer: '' };
      }
      const newCart = [...t.cart, { ...product, qty: 1, unit_price: product.sell_price || 0, discount: 0 }];
      return { ...t, cart: newCart, selectedCartIdx: newCart.length - 1, numpadBuffer: '' };
    }));
  };

  // --- Numpad logic ---
  const handleNumpad = useCallback((key) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== activeTicketId) return t;
      if (t.selectedCartIdx === null || !t.cart[t.selectedCartIdx]) return t;

      let buf = t.numpadBuffer;
      if (key === '⌫') buf = buf.slice(0, -1);
      else if (key === '+/-') buf = buf.startsWith('-') ? buf.slice(1) : '-' + buf;
      else if (key === '.') { if (!buf.includes('.')) buf = buf + '.'; }
      else buf = buf + key;

      const val = parseFloat(buf);
      const numVal = isNaN(val) ? 0 : val;
      const updatedCart = [...t.cart];
      const item = { ...updatedCart[t.selectedCartIdx] };

      if (!isNaN(val) || buf === '' || buf === '-' || buf === '.') {
        if (t.numpadMode === 'Qté') item.qty = Math.max(1, Math.round(numVal));
        else if (t.numpadMode === 'Remise') item.discount = Math.min(100, Math.max(0, numVal));
        else if (t.numpadMode === 'Prix') item.unit_price = Math.max(0, numVal);
        updatedCart[t.selectedCartIdx] = item;
      }

      return { ...t, numpadBuffer: buf, cart: updatedCart };
    }));
  }, [activeTicketId]);



  const addHistoryItem = (item) => {
    const customId = `hist_${item.id}_${Date.now()}`;
    setTickets(prev => prev.map(t => {
      if (t.id !== activeTicketId) return t;
      const newCart = [...t.cart, { id: customId, name: item.name, qty: 1, unit_price: item.price, discount: 0, isCustom: true, refId: item.id, refType: item.type }];
      return { ...t, cart: newCart, selectedCartIdx: newCart.length - 1, numpadBuffer: '', clientName: t.clientName || item.clientName || '', clientPhone: t.clientPhone || item.clientPhone || '' };
    }));
    setShowHistoryDialog(false);
  };

  const removeSelected = () => {
    if (selectedCartIdx === null) return;
    const newCart = cart.filter((_, i) => i !== selectedCartIdx);
    updateTicket({ cart: newCart, selectedCartIdx: null, numpadBuffer: '' });
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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* TOP BAR */}
      <div className="h-12 bg-card border-b border-border flex items-center px-3 gap-0 flex-shrink-0">
        <Link to={createPageUrl("Dashboard")}>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-3">
            <ArrowLeft className="h-4 w-4" />
          </button>
        </Link>

        {/* Home + Search — à droite des tickets */}

        {/* Ticket tabs like Odoo */}
        <div className="flex items-center gap-0 flex-1 overflow-x-auto h-full">
          {tickets.map((t, idx) => (
            <div
              key={t.id}
              onClick={() => setActiveTicketId(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 h-full border-r border-border cursor-pointer text-sm font-medium select-none transition-colors flex-shrink-0",
                activeTicketId === t.id
                  ? "bg-background border-b-2 border-b-primary text-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              <span>Ticket {idx + 1}</span>
              {t.cart.length > 0 && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  activeTicketId === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {t.cart.reduce((s, i) => s + i.qty, 0)}
                </span>
              )}
              <button
                onClick={(e) => closeTicket(t.id, e)}
                className="hover:text-destructive transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={addTicket}
            className="flex items-center justify-center px-3 h-full text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex-shrink-0"
            title="Nouveau ticket"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Home + Search */}
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          <button onClick={() => setActiveCategory('all')} className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Toutes catégories">
            <Home className="h-4 w-4" />
          </button>
          <div className="relative w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Caissier connecté */}
        {user && (
          <div className="flex items-center gap-2 ml-2 px-3 py-1 rounded-md bg-muted/40 flex-shrink-0">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
              {user.full_name?.[0] || user.email?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs font-medium text-foreground hidden sm:block">{user.full_name || user.email}</span>
          </div>
        )}
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
                    onClick={() => updateTicket({ selectedCartIdx: idx, numpadBuffer: '' })}
                    className={cn(
                      "px-3 py-2.5 border-b border-border/50 cursor-pointer transition-colors",
                      isSelected ? "bg-primary/10 border-l-4 border-l-primary" : "hover:bg-muted/30"
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
          <div className="border-t border-border px-4 py-3 bg-background">
            <div className="flex justify-between items-baseline">
              <span className="text-base font-semibold text-muted-foreground">Total :</span>
              <span className="text-2xl font-bold text-foreground">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Customer + Réparation + Service — même ligne */}
          <div className="border-t border-border flex items-stretch">
            {/* Phone input client */}
            <div className="flex-1 flex items-center gap-2 px-3 py-2 border-r border-border">
              <div className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                clientName && clientName !== 'Client passager'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                {clientName && clientName !== 'Client passager'
                  ? clientName.charAt(0).toUpperCase()
                  : <User className="h-3.5 w-3.5" />}
              </div>
              <input
                type="tel"
                placeholder="N° client..."
                value={clientPhone}
                onChange={e => {
                  const val = e.target.value;
                  updateTicket({ clientPhone: val });
                  // auto-match client by phone
                  const found = clients.find(c => c.phone === val);
                  if (found) updateTicket({ clientName: found.full_name, clientPhone: found.phone });
                  else if (!val) updateTicket({ clientName: '', clientPhone: '' });
                }}
                className="flex-1 min-w-0 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
              {clientName && clientName !== 'Client passager' && (
                <button onClick={() => updateTicket({ clientName: '', clientPhone: '' })} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {/* Réparation */}
            <button
              onClick={() => { setHistoryTab('repairs'); setHistorySearch(''); setShowHistoryDialog(true); }}
              className="flex items-center justify-center px-3 py-2 text-orange-600 bg-orange-500/5 hover:bg-orange-500/15 transition-colors border-r border-border"
              title="Réparation"
            >
              <Wrench className="h-4 w-4" />
            </button>
            {/* Service */}
            <button
              onClick={() => { setHistoryTab('services'); setHistorySearch(''); setShowHistoryDialog(true); }}
              className="flex items-center justify-center px-3 py-2 text-blue-600 bg-blue-500/5 hover:bg-blue-500/15 transition-colors"
              title="Service"
            >
              <Clock className="h-4 w-4" />
            </button>
          </div>

          {/* ---- NUMPAD ZONE ---- */}
          {/* Buffer display */}
          <div className="px-4 py-2 bg-background border-t border-border flex justify-between items-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{numpadMode}</span>
            <span className="text-xl font-mono font-bold text-foreground">
              {numpadBuffer || (selectedItem ? (
                numpadMode === 'Qté' ? selectedItem.qty :
                numpadMode === 'Remise' ? `${selectedItem.discount}%` :
                selectedItem.unit_price.toFixed(2)
              ) : '—')}
            </span>
          </div>

          {/* Numpad grid */}
          <div className="grid grid-cols-4 border-t border-border flex-shrink-0">
            {[['1','2','3','Qté'],['4','5','6','% Disc'],['7','8','9','Prix'],['+/-','0','.','⌫']].map((row, ri) =>
              row.map((key, ci) => {
                const isMode = ['Qté','% Disc','Prix'].includes(key);
                const modeMap = {'Qté':'Qté','% Disc':'Remise','Prix':'Prix'};
                const isActive = isMode && numpadMode === modeMap[key];
                const isBackspace = key === '⌫';
                return (
                  <button
                    key={`${ri}-${ci}`}
                    onClick={() => {
                      if (isMode) updateTicket({ numpadMode: modeMap[key], numpadBuffer: '' });
                      else if (isBackspace) handleNumpad('⌫');
                      else handleNumpad(key);
                    }}
                    className={cn(
                      "h-14 flex items-center justify-center text-sm font-semibold border-r border-b border-border/60 transition-colors active:scale-95",
                      isActive ? "bg-primary text-primary-foreground" :
                      isMode ? "bg-muted/40 text-foreground hover:bg-primary/10 hover:text-primary" :
                      isBackspace ? "bg-muted/20 text-muted-foreground hover:bg-muted" :
                      "bg-background text-foreground hover:bg-muted/40"
                    )}
                  >
                    {isBackspace ? <Delete className="h-4 w-4" /> : key}
                  </button>
                );
              })
            )}


            {/* Payment button full width */}
            <button
              onClick={() => setShowPaymentDialog(true)}
              disabled={cart.length === 0}
              className={cn(
                "col-span-3 h-16 flex items-center justify-center gap-2 text-base font-bold border-r border-border/60 transition-colors",
                cart.length === 0
                  ? "text-muted-foreground bg-muted/20 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80"
              )}
            >
              <CheckCircle className="h-5 w-5" />
              <span>Paiement{cart.length > 0 ? ` — ${formatCurrency(total)}` : ''}</span>
            </button>
            <button
              onClick={removeSelected}
              disabled={selectedCartIdx === null}
              className="h-16 flex items-center justify-center bg-destructive/5 hover:bg-destructive/15 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ===== RIGHT PANEL: Products ===== */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">

          {/* Category tabs */}
          <div className="flex gap-1 px-3 py-2 border-b border-border bg-card flex-shrink-0 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setSearch(''); }}
                className={cn(
                  "px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-all flex-shrink-0",
                  activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {cat === 'all' ? '🏠 Tous' : CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>


          {/* Products grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filtered.map(product => {
                const inCart = cart.find(i => i.id === product.id);
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className={cn(
                      "relative flex flex-col text-left overflow-hidden bg-card border border-border transition-all active:scale-95",
                      inCart ? "ring-2 ring-inset ring-primary bg-primary/5" : "hover:bg-muted/30"
                    )}
                  >
                    {inCart && (
                      <div className="absolute top-1.5 right-1.5 z-10 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow">
                        <span className="text-[11px] font-bold text-primary-foreground">{inCart.qty}</span>
                      </div>
                    )}
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full aspect-[4/3] object-cover" />
                    ) : (
                      <div className="w-full aspect-[4/3] bg-muted/50 flex items-center justify-center">
                        <Package className="h-10 w-10 text-muted-foreground/30" />
                      </div>
                    )}
                    <div className="px-2 pt-1.5 pb-2">
                      <p className="text-xs font-semibold leading-tight line-clamp-2 text-foreground mb-1">{product.name}</p>
                      <p className="text-sm font-bold text-primary">{formatCurrency(product.sell_price || 0)}</p>
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

      {/* HISTORY DIALOG */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {historyTab === 'repairs' ? <><Wrench className="h-4 w-4 text-orange-500" /> Réparations existantes</> : <><Clock className="h-4 w-4 text-blue-500" /> Services existants</>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
              <button onClick={() => setHistoryTab('repairs')} className={cn("flex-1 py-1.5 text-xs font-medium rounded transition-colors", historyTab === 'repairs' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>🔧 Réparations</button>
              <button onClick={() => setHistoryTab('services')} className={cn("flex-1 py-1.5 text-xs font-medium rounded transition-colors", historyTab === 'services' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>📦 Services</button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Rechercher par client, désignation..." className="pl-9" autoFocus />
            </div>
            <div className="max-h-80 overflow-y-auto rounded-lg border border-border divide-y divide-border/50">
              {historyTab === 'repairs' && (() => {
                const filtered = repairs.filter(r =>
                  !historySearch ||
                  r.client_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                  r.device_brand?.toLowerCase().includes(historySearch.toLowerCase()) ||
                  r.device_model?.toLowerCase().includes(historySearch.toLowerCase()) ||
                  r.ticket_number?.toLowerCase().includes(historySearch.toLowerCase())
                ).slice(0, 30);
                if (filtered.length === 0) return <div className="py-8 text-center text-sm text-muted-foreground">Aucune réparation trouvée</div>;
                return filtered.map(r => {
                  const price = r.final_cost || r.estimated_cost || 0;
                  const totalPaid = (r.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
                  const remaining = Math.max(0, price - totalPaid);
                  return (
                    <button key={r.id} onClick={() => addHistoryItem({ id: r.id, name: `🔧 ${r.client_name} — ${r.device_brand || ''} ${r.device_model || ''}`.trim(), price: remaining || price, clientName: r.client_name, clientPhone: r.client_phone, type: 'repair' })}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left">
                      <div className="h-8 w-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                        <Wrench className="h-4 w-4 text-orange-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.client_name} — {r.device_brand} {r.device_model}</p>
                        <p className="text-xs text-muted-foreground">{r.ticket_number} · {r.status}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-foreground">{formatCurrency(remaining || price)}</p>
                        {remaining > 0 && totalPaid > 0 && <p className="text-[10px] text-orange-500">Reste à payer</p>}
                      </div>
                    </button>
                  );
                });
              })()}
              {historyTab === 'services' && (() => {
                const filtered = serviceSales.filter(s =>
                  !historySearch ||
                  s.client_name?.toLowerCase().includes(historySearch.toLowerCase()) ||
                  s.service_name?.toLowerCase().includes(historySearch.toLowerCase())
                ).slice(0, 30);
                if (filtered.length === 0) return <div className="py-8 text-center text-sm text-muted-foreground">Aucun service trouvé</div>;
                return filtered.map(s => (
                  <button key={s.id} onClick={() => addHistoryItem({ id: s.id, name: `📦 ${s.service_name}`, price: s.sell_price || 0, clientName: s.client_name, clientPhone: s.client_phone, type: 'service' })}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left">
                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Clock className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.service_name}</p>
                      <p className="text-xs text-muted-foreground">{s.client_name} · {s.client_phone}</p>
                    </div>
                    <p className="text-sm font-bold flex-shrink-0">{formatCurrency(s.sell_price || 0)}</p>
                  </button>
                ));
              })()}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CLIENT DIALOG */}
      <Dialog open={showClientDialog} onOpenChange={setShowClientDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sélectionner un client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Nom ou téléphone..."
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border/50">
              {/* Client passager */}
              <button
                onClick={() => { updateTicket({ clientName: 'Client passager', clientPhone: '' }); setShowClientDialog(false); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Client passager</p>
                  <p className="text-xs text-muted-foreground">Client anonyme</p>
                </div>
                {(!clientName || clientName === 'Client passager') && (
                  <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Actif</span>
                )}
              </button>
              {/* Clients filtrés */}
              {clients
                .filter(c =>
                  !clientSearch ||
                  c.full_name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  c.phone?.includes(clientSearch)
                )
                .slice(0, 20)
                .map(c => (
                  <button
                    key={c.id}
                    onClick={() => { updateTicket({ clientName: c.full_name, clientPhone: c.phone || '' }); setShowClientDialog(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left",
                      clientName === c.full_name && "bg-primary/5"
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
                      {c.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.full_name}</p>
                      {c.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{c.phone}</p>}
                    </div>
                    {clientName === c.full_name && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Actif</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PAYMENT DIALOG */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Paiement — {formatCurrency(total)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
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
                    paymentMethod === pm.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >{pm.label}</button>
              ))}
            </div>
            <Button className="w-full" size="lg" onClick={() => saleMutation.mutate()} disabled={saleMutation.isPending}>
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
            <p className="text-sm text-muted-foreground">N° <span className="font-mono font-bold text-foreground">{lastCartSnapshot.saleNum}</span></p>

            {/* Récap du ticket */}
            <div className="w-full bg-muted/30 rounded-lg p-3 text-left space-y-1 max-h-40 overflow-y-auto">
              {lastCartSnapshot.cart.map((item, i) => {
                const lineTotal = item.qty * item.unit_price * (1 - (item.discount || 0) / 100);
                return (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[180px]">{item.name} × {item.qty}</span>
                    <span className="font-medium ml-2">{formatCurrency(lineTotal)}</span>
                  </div>
                );
              })}
              <div className="border-t border-border/50 pt-1 flex justify-between text-sm font-bold">
                <span>Total</span>
                <span className="text-emerald-500">{formatCurrency(lastCartSnapshot.total)}</span>
              </div>
            </div>

            {/* SMS */}
            {settings.sms_api_key && settings.sms_provider && lastCartSnapshot.clientPhone && (
              <div className="w-full space-y-1.5">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={sendTicketSms}
                  disabled={smsSending || smsResult === 'ok'}
                >
                  <MessageSquare className="h-4 w-4" />
                  {smsSending ? 'Envoi en cours...' : smsResult === 'ok' ? '✅ SMS envoyé !' : `Envoyer ticket SMS à ${lastCartSnapshot.clientPhone}`}
                </Button>
                {smsResult === 'error' && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive justify-center">
                    <AlertCircle className="h-3 w-3" /> Échec de l'envoi. Vérifiez la config SMS.
                  </p>
                )}
              </div>
            )}
            {settings.sms_api_key && settings.sms_provider && !lastCartSnapshot.clientPhone && (
              <p className="text-xs text-muted-foreground">Aucun numéro client — SMS non disponible</p>
            )}
            {!settings.sms_api_key && (
              <p className="text-xs text-muted-foreground">Configurez un fournisseur SMS dans Paramètres → SMS</p>
            )}

            <Button className="w-full" onClick={() => setSuccessOpen(false)}>Nouvelle vente</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}