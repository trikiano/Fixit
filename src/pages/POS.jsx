import React, { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search, Package, ArrowLeft, Delete, CheckCircle, Home, Plus, X, User, Phone, Wrench, Clock, MessageSquare, AlertCircle, UserPlus,
  Smartphone, Monitor, Tablet, Zap, Cable, Headphones, Settings, Gamepad2, Box, Volume2, ShieldCheck, Tag, ChevronLeft, Check, RotateCcw, Receipt, Gift, BookOpen
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useAppSettings } from "@/components/settings/SettingsContext";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import PhoneInput from '@/components/ui/PhoneInput';

const STATUS_REPAIR = {
  reception:         { label: 'Réception',      cls: 'bg-gray-500/10 text-gray-500 border-gray-200' },
  diagnostic:        { label: 'Diagnostic',     cls: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  en_attente_pieces: { label: 'Attente pièces', cls: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  en_cours:          { label: 'En cours',       cls: 'bg-blue-500/10 text-blue-600 border-blue-200' },
  pret:              { label: '✓ Prêt',         cls: 'bg-green-500/10 text-green-600 border-green-200' },
};

const DEVICE_TYPES = [
  { value: 'telephone', label: 'Téléphone', icon: '📱' },
  { value: 'ordinateur', label: 'PC', icon: '💻' },
  { value: 'tablette', label: 'Tablette', icon: '📟' },
  { value: 'console', label: 'Console', icon: '🎮' },
  { value: 'autre', label: 'Autre', icon: '🔧' },
];

const CATEGORY_LABELS = {
  telephone: 'Téléphones',
  ordinateur: 'PC / Ordis',
  tablette: 'Tablettes',
  chargeur: 'Chargeurs',
  cable: 'Câbles',
  accessoire: 'Accessoires',
  piece_detachee: 'Pièces',
  console: 'Consoles',
  haut_parleur: 'Haut-parleurs',
  anticasse: 'Anticasse',
  autre: 'Autre',
};

const CATEGORY_ICONS = {
  telephone: Smartphone,
  ordinateur: Monitor,
  tablette: Tablet,
  chargeur: Zap,
  cable: Cable,
  accessoire: Headphones,
  piece_detachee: Settings,
  console: Gamepad2,
  haut_parleur: Volume2,
  anticasse: ShieldCheck,
  autre: Box,
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
  const [perteDialog, setPerteDialog] = useState({ open: false, cartIdx: null, motif: 'mauvaise_taille', loading: false });
  const [showServicePickerDialog, setShowServicePickerDialog] = useState(false);
  const [serviceCatFilter, setServiceCatFilter] = useState('tous');
  const [servicePicking, setServicePicking] = useState(null);
  const [serviceAmount, setServiceAmount] = useState('');
  const [newSvcCatMode, setNewSvcCatMode] = useState(false);
  const [newSvcCatName, setNewSvcCatName] = useState('');
  const [newServiceMode, setNewServiceMode] = useState(false);
  const [newServiceForm, setNewServiceForm] = useState({ name: '', category_id: '', sell_price: '', cost_price: '' });
  // Repair picker
  const [showRepairPickerDialog, setShowRepairPickerDialog] = useState(false);
  const [repairSearch, setRepairSearch] = useState('');
  const [repairStatusFilter, setRepairStatusFilter] = useState('ouvertes');
  const [repairPicking, setRepairPicking] = useState(null);
  const [repairAmount, setRepairAmount] = useState('');
  const [newRepairMode, setNewRepairMode] = useState(false);
  const [newRepairForm, setNewRepairForm] = useState({ client_name: '', client_phone: '', device_type: 'telephone', description: '', amount: '' });
  // Return flow
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnSearchQuery, setReturnSearchQuery] = useState('');
  const [returnStep, setReturnStep] = useState('search'); // 'search' | 'confirm' | 'done'
  const [returnPicking, setReturnPicking] = useState(null); // { sale, item }
  const [returnQty, setReturnQty] = useState(1);
  const [returnMethod, setReturnMethod] = useState('especes');
  const [lastReturnNum, setLastReturnNum] = useState('');

  const MOTIFS_PERTE = [
    { value: 'mauvaise_taille', label: 'Mauvaise taille / format' },
    { value: 'ne_convient_pas', label: 'Ne convient pas au modèle' },
    { value: 'abime_pose', label: 'Abîmé lors de la pose' },
    { value: 'retrait_client', label: 'Retrait / changement client' },
    { value: 'defaut_fabrication', label: 'Défaut de fabrication' },
    { value: 'autre', label: 'Autre' },
  ];
  const [clientInputValue, setClientInputValue] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showAddClientDialog, setShowAddClientDialog] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ full_name: '', phone: '' });
  const clientInputRef = useRef(null);
  const searchInputRef = useRef(null);
  const scanBufferRef = useRef('');
  const scanTimerRef = useRef(null);
  const qc = useQueryClient();

  const { formatCurrency, generateTicketNumber, settings } = useAppSettings();
  const { isResponsableOrAbove } = useAuth();
  const maxDiscount = isResponsableOrAbove ? 100 : 10;
  const { isOnline, queue: offlineQueue, enqueue, syncQueue, syncing, lastSyncResult } = useOfflineQueue();
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list('-created_date', 500) });
  const { data: repairs = [] } = useQuery({ queryKey: ['repairs'], queryFn: () => base44.entities.Repair.list('-created_date', 200) });
  const { data: serviceSales = [] } = useQuery({ queryKey: ['serviceSales'], queryFn: () => base44.entities.ServiceSale.list('-created_date', 200) });
  const { data: serviceItems = [] } = useQuery({ queryKey: ['service-items'], queryFn: () => base44.entities.ServiceItem.list('-created_date', 200) });
  const { data: serviceCategories = [] } = useQuery({ queryKey: ['service-categories'], queryFn: () => base44.entities.ServiceCategory.list('-created_date', 100) });
  const { data: recentSales = [] } = useQuery({ queryKey: ['recent-sales'], queryFn: () => base44.entities.Sale.list('-created_date', 500) });


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

  // --- Add new client mutation ---
  const addClientMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      updateTicket({ clientName: created.full_name, clientPhone: created.phone || '' });
      setClientInputValue(created.full_name);
      setShowAddClientDialog(false);
      setNewClientForm({ full_name: '', phone: '' });
    }
  });

  // --- Sale mutation ---
  const saleMutation = useMutation({
    mutationFn: async () => {
      const paidItems = cart.filter(i => !i.ardoise);
      const ardoiseItems = cart.filter(i => i.ardoise);
      const saleNum = generateTicketNumber('sale');
      setLastCartSnapshot({ cart: [...cart], clientName, clientPhone, total, saleNum });

      const toSaleItems = (items) => items.map(item => ({
        product_id: item.id, product_name: item.name,
        quantity: item.qty, unit_price: item.unit_price,
        discount: item.discount || 0,
        total: item.qty * item.unit_price * (1 - (item.discount || 0) / 100)
      }));

      // Stock updates for ALL items — goods leave the shop regardless of payment status
      const stockUpdates = [];
      for (const item of cart) {
        if (item.isCustom || item.isService || item.isRepair) continue;
        const prod = products.find(p => p.id === item.id);
        if (prod) {
          const newQty = Math.max(0, (prod.quantity || 0) - item.qty);
          stockUpdates.push({
            id: prod.id,
            newQty,
            movement: {
              product_id: prod.id, product_name: prod.name, type: 'sortie',
              quantity: item.qty, previous_stock: prod.quantity,
              new_stock: newQty, reason: `POS ${saleNum}`, reference_type: 'vente'
            }
          });
        }
      }

      if (!isOnline) {
        if (paidItems.length > 0) {
          const saleItems = toSaleItems(paidItems);
          const subtotal = saleItems.reduce((s, i) => s + i.total, 0);
          enqueue({
            sale_number: saleNum, client_name: clientName || 'Client comptoir', type: 'vente',
            items: saleItems, subtotal, discount_total: 0, total: subtotal,
            payment_method: paymentMethod, payments: [{ method: paymentMethod, amount: subtotal }],
            status: 'completee', _stock_updates: stockUpdates
          });
        }
        return saleNum;
      }

      // Online: apply stock updates
      for (const upd of stockUpdates) {
        await base44.entities.Product.update(upd.id, { quantity: upd.newQty });
        await base44.entities.StockMovement.create(upd.movement);
      }

      // Vente payée
      if (paidItems.length > 0) {
        const saleItems = toSaleItems(paidItems);
        const subtotal = saleItems.reduce((s, i) => s + i.total, 0);
        await base44.entities.Sale.create({
          sale_number: saleNum, client_name: clientName || 'Client comptoir', type: 'vente',
          items: saleItems, subtotal, discount_total: 0, total: subtotal,
          payment_method: paymentMethod, payments: [{ method: paymentMethod, amount: subtotal }],
          status: 'completee'
        });
      }

      // Ardoise(s) — regroupées par personne
      if (ardoiseItems.length > 0) {
        const byPerson = {};
        for (const item of ardoiseItems) {
          const key = item.ardoise.personName?.trim() || 'Non identifié';
          if (!byPerson[key]) byPerson[key] = { items: [], comment: item.ardoise.comment || '' };
          byPerson[key].items.push(item);
        }
        for (const [personName, { items: aItems, comment }] of Object.entries(byPerson)) {
          const ardoiseNum = paidItems.length > 0 ? generateTicketNumber('sale') : saleNum;
          const aSaleItems = toSaleItems(aItems);
          const aTotal = aSaleItems.reduce((s, i) => s + i.total, 0);
          await base44.entities.Sale.create({
            sale_number: ardoiseNum, client_name: personName, type: 'vente',
            items: aSaleItems, subtotal: aTotal, discount_total: 0, total: aTotal,
            payment_method: 'ardoise', payments: [{ method: 'ardoise', amount: aTotal }],
            status: 'non_payee', notes: comment
          });
        }
      }

      return saleNum;
    },
    onSuccess: (saleNum) => {
      if (isOnline) {
        qc.invalidateQueries({ queryKey: ['products'] });
        qc.invalidateQueries({ queryKey: ['sales'] });
      }
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
  const addToCart = useCallback((product) => {
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
  }, [activeTicketId]);

  // --- Scanner global : capture les flux QR/barcode n'importe où dans le POS ---
  useEffect(() => {
    const onKeyDown = (e) => {
      // Si un dialog/modal est ouvert → ne pas intercepter
      if (document.querySelector('[role="dialog"]')) return;
      // Si le focus est sur un input/textarea/select → ne pas intercepter
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      // Ignorer les combinaisons avec Ctrl/Alt/Meta
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'Enter') {
        const code = scanBufferRef.current.trim();
        scanBufferRef.current = '';
        if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
        if (code.length < 2) return;

        const q = code.toLowerCase();
        // Priorité : match exact barcode / imei / serial
        const exact = products.find(p =>
          p.is_active !== false && p.quantity > 0 && (
            p.barcode?.toLowerCase() === q ||
            p.imei?.toLowerCase() === q ||
            p.serial_number?.toLowerCase() === q
          )
        );
        // Fallback : SKU ou nom
        const match = exact ?? products.find(p =>
          p.is_active !== false && p.quantity > 0 && (
            p.sku?.toLowerCase() === q ||
            p.name?.toLowerCase().includes(q)
          )
        );

        if (match) {
          addToCart(match);
        } else {
          // Aucun match → afficher dans la barre de recherche pour que l'utilisateur voie ce qui a été scanné
          setSearch(code);
          searchInputRef.current?.focus();
        }
        e.preventDefault();
        return;
      }

      // Caractère imprimable → bufferiser
      if (e.key.length !== 1) return;
      scanBufferRef.current += e.key;

      // Vider le buffer après 200ms sans activité (évite les fragments orphelins)
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      scanTimerRef.current = setTimeout(() => { scanBufferRef.current = ''; }, 200);

      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [products, addToCart]);

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
        else if (t.numpadMode === 'Remise') item.discount = Math.min(maxDiscount, Math.max(0, numVal));
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

  const removeFromCart = (idx) => {
    const newCart = cart.filter((_, i) => i !== idx);
    updateTicket({ cart: newCart, selectedCartIdx: null, numpadBuffer: '' });
  };

  const enregistrerPerteAnticasse = async () => {
    const item = cart[perteDialog.cartIdx];
    if (!item) return;
    const prod = products.find(p => p.id === item.id);
    if (!prod) return;
    setPerteDialog(d => ({ ...d, loading: true }));
    const prev = prod.quantity || 0;
    const newQty = Math.max(0, prev - 1);
    const motifLabel = MOTIFS_PERTE.find(m => m.value === perteDialog.motif)?.label || perteDialog.motif;
    try {
      await base44.entities.Product.update(prod.id, { quantity: newQty });
      await base44.entities.StockMovement.create({
        product_id: prod.id, product_name: prod.name,
        type: 'sortie', quantity: 1,
        previous_stock: prev, new_stock: newQty,
        reason: `Perte anticasse — ${motifLabel}`,
        reference_type: 'perte_anticasse',
      });
      qc.invalidateQueries({ queryKey: ['products'] });
    } finally {
      setPerteDialog({ open: false, cartIdx: null, motif: 'mauvaise_taille', loading: false });
    }
  };

  const createQuickRepairMutation = useMutation({
    mutationFn: async (data) => {
      const ticketNum = generateTicketNumber('repair');
      return base44.entities.Repair.create({
        ticket_number: ticketNum,
        client_name: data.client_name,
        client_phone: data.client_phone || '',
        device_type: data.device_type,
        problem_description: data.description,
        status: 'en_cours',
        estimated_cost: parseFloat(data.amount) || 0,
        final_cost: parseFloat(data.amount) || 0,
        deposit_amount: 0,
        payments: [],
      });
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['repairs'] });
      setRepairPicking(created);
      setRepairAmount(String(created.final_cost || ''));
      setNewRepairMode(false);
      setNewRepairForm({ client_name: '', client_phone: '', device_type: 'telephone', description: '', amount: '' });
    },
  });

  const createServiceCatMutation = useMutation({
    mutationFn: (name) => base44.entities.ServiceCategory.create({ name, color: 'blue' }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['service-categories'] });
      setServiceCatFilter(created.id);
      setNewSvcCatName(''); setNewSvcCatMode(false);
    },
  });

  const createReturnMutation = useMutation({
    mutationFn: async ({ sale, item, qty, method }) => {
      const returnNum = generateTicketNumber('sale');
      const lineTotal = qty * item.unit_price * (1 - (item.discount || 0) / 100);
      await base44.entities.Sale.create({
        sale_number: returnNum,
        client_name: sale.client_name || 'Client comptoir',
        type: 'retour',
        items: [{ product_id: item.product_id, product_name: item.product_name, quantity: qty, unit_price: item.unit_price, discount: item.discount || 0, total: lineTotal }],
        subtotal: lineTotal,
        discount_total: 0,
        total: lineTotal,
        payment_method: method,
        payments: [{ method, amount: lineTotal }],
        status: 'completee',
      });
      // Restaurer le stock si c'est un produit physique
      if (item.product_id) {
        const prod = products.find(p => p.id === item.product_id);
        if (prod) {
          const newQty = (prod.quantity || 0) + qty;
          await base44.entities.Product.update(prod.id, { quantity: newQty });
          await base44.entities.StockMovement.create({
            product_id: prod.id, product_name: prod.name,
            type: 'entree', quantity: qty,
            previous_stock: prod.quantity || 0, new_stock: newQty,
            reason: `Retour client — ${returnNum} (réf. ${sale.sale_number || ''})`,
            reference_type: 'retour',
          });
        }
      }
      return returnNum;
    },
    onSuccess: (returnNum) => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['recent-sales'] });
      setLastReturnNum(returnNum);
      setReturnStep('done');
    },
  });

  const createServiceItemMutation = useMutation({
    mutationFn: (data) => base44.entities.ServiceItem.create(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['service-items'] });
      setServicePicking(created);
      setServiceAmount(created.sell_price ? String(created.sell_price) : '');
      setNewServiceMode(false);
      setNewServiceForm({ name: '', category_id: '', sell_price: '', cost_price: '' });
    },
  });

  // Barcode scanner : sur Enter dans le champ recherche, ajouter le produit si match unique ou exact
  const handleSearchKeyDown = (e) => {
    if (e.key !== 'Enter' || !search.trim()) return;
    const q = search.trim().toLowerCase();
    // Priorité : match exact sur barcode, IMEI ou serial_number
    const exact = products.find(
      p => p.is_active !== false && p.quantity > 0 && (
        p.barcode?.toLowerCase() === q ||
        p.imei?.toLowerCase() === q ||
        p.serial_number?.toLowerCase() === q
      )
    );
    const toAdd = exact ?? (filtered.length === 1 ? filtered[0] : null);
    if (toAdd) {
      addToCart(toAdd);
      setSearch('');
      setActiveCategory('all');
    }
  };

  const filtered = products.filter(p => {
    if (p.is_active === false || p.quantity <= 0) return false;
    const ms = p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.brand?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(search.toLowerCase()) ||
      p.imei?.toLowerCase().includes(search.toLowerCase()) ||
      p.serial_number?.toLowerCase().includes(search.toLowerCase());
    const mc = activeCategory === 'all' || p.category === activeCategory;
    return ms && mc;
  });

  const categories = ['all', ...Object.keys(CATEGORY_LABELS).filter(c => products.some(p => p.category === c && p.quantity > 0))];
  const total = cart.reduce((s, i) => s + i.qty * i.unit_price * (1 - (i.discount || 0) / 100), 0);
  const ardoiseTotal = cart.filter(i => i.ardoise).reduce((s, i) => s + i.qty * i.unit_price * (1 - (i.discount || 0) / 100), 0);
  const paidTotal = total - ardoiseTotal;
  const ardoiseNames = [...new Set([
    ...clients.map(c => c.full_name).filter(Boolean),
    ...recentSales.filter(s => s.payment_method === 'ardoise' && s.client_name).map(s => s.client_name),
  ])].sort();
  const selectedItem = selectedCartIdx !== null ? cart[selectedCartIdx] : null;

  return (
    <div className="fixed inset-0 flex flex-col bg-background z-40">
      {/* OFFLINE / SYNC banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-xs font-semibold text-center py-1 flex items-center justify-center gap-2 flex-shrink-0">
          <span>⚠️ Mode hors ligne — les ventes seront synchronisées à la reconnexion</span>
          {offlineQueue.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full">{offlineQueue.length} en attente</span>}
        </div>
      )}
      {isOnline && offlineQueue.length > 0 && !syncing && (
        <div className="bg-blue-600 text-white text-xs font-semibold text-center py-1 flex items-center justify-center gap-2 flex-shrink-0">
          <span>🔄 Reconnecté — {offlineQueue.length} vente(s) en attente de sync</span>
          <button onClick={syncQueue} className="bg-white/20 hover:bg-white/30 px-3 py-0.5 rounded-full transition-colors">Synchroniser</button>
        </div>
      )}
      {syncing && (
        <div className="bg-blue-500 text-white text-xs font-semibold text-center py-1 flex-shrink-0">⏳ Synchronisation en cours...</div>
      )}
      {lastSyncResult && (
        <div className={cn("text-white text-xs font-semibold text-center py-1 flex-shrink-0", lastSyncResult.failed > 0 ? 'bg-orange-500' : 'bg-emerald-600')}>
          ✅ {lastSyncResult.synced} vente(s) synchronisée(s){lastSyncResult.failed > 0 ? ` · ⚠️ ${lastSyncResult.failed} échec(s)` : ''}
        </div>
      )}
      {/* TOP BAR */}
      <div className="h-12 bg-card border-b border-border flex items-center px-3 gap-0 flex-shrink-0">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('shell:go-home'))}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-3"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

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
          <button onClick={() => window.dispatchEvent(new CustomEvent('shell:go-home'))} className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Accueil">
            <Home className="h-4 w-4" />
          </button>
          <div className="relative w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={searchInputRef}
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Rechercher / scanner..."
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
                      "px-3 py-2.5 border-b border-border/50 cursor-pointer transition-colors group",
                      isSelected ? "bg-primary/10 border-l-4 border-l-primary" :
                      item.ardoise ? "bg-amber-50/60 dark:bg-amber-950/10 border-l-4 border-l-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20" :
                      "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex justify-between items-start">
                      <p className={cn("text-sm font-medium leading-tight flex-1 min-w-0 truncate", isSelected ? "text-primary" : "text-foreground")}>
                        {item.name}
                      </p>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <p className="text-sm font-bold">{formatCurrency(lineTotal)}</p>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFromCart(idx); }}
                          className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
                          title="Supprimer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-muted-foreground">
                        {item.qty} × {formatCurrency(item.unit_price)}
                        {item.discount > 0 && <span className="text-orange-500 font-semibold ml-1">−{item.discount}%</span>}
                        {item.ardoise && <span className="text-amber-600 font-semibold ml-1.5">👤 {item.ardoise.personName || 'Ardoise'}</span>}
                      </p>
                      {item.category === 'anticasse' && !item.isCustom && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPerteDialog({ open: true, cartIdx: idx, motif: 'mauvaise_taille', loading: false }); }}
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors flex-shrink-0 ml-2"
                          title="Anticasse raté — enregistrer perte"
                        >
                          ❌ Raté
                        </button>
                      )}
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-primary/20" onClick={e => e.stopPropagation()}>
                        <span className="text-[11px] text-muted-foreground font-medium flex-shrink-0">Remise</span>
                        <div className="flex items-center gap-1 flex-1">
                          {[5, 10, 15, 20].filter(pct => pct <= maxDiscount).map(pct => (
                            <button
                              key={pct}
                              onClick={e => {
                                e.stopPropagation();
                                const newCart = [...cart];
                                newCart[idx] = { ...newCart[idx], discount: item.discount === pct ? 0 : pct };
                                updateTicket({ cart: newCart, numpadBuffer: String(item.discount === pct ? 0 : pct) });
                              }}
                              className={cn(
                                "h-7 px-2 rounded text-[11px] font-bold transition-colors flex-1",
                                item.discount === pct
                                  ? "bg-orange-500 text-white"
                                  : "bg-muted/60 text-muted-foreground hover:bg-orange-500/20 hover:text-orange-600"
                              )}
                            >
                              {pct}%
                            </button>
                          ))}
                          <input
                            type="number"
                            min="0"
                            value={item.discount > 0 ? parseFloat((item.discount / 100 * item.unit_price * item.qty).toFixed(3)) : ''}
                            onChange={e => {
                              const dtVal = Math.max(0, parseFloat(e.target.value) || 0);
                              const lineTotal = item.unit_price * item.qty;
                              const pct = lineTotal > 0 ? Math.min(100, (dtVal / lineTotal) * 100) : 0;
                              const newCart = [...cart];
                              newCart[idx] = { ...newCart[idx], discount: parseFloat(pct.toFixed(4)) };
                              updateTicket({ cart: newCart, numpadBuffer: String(dtVal) });
                            }}
                            placeholder="0.000"
                            className="w-20 h-7 text-center text-xs font-bold border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-orange-400 text-foreground"
                            onClick={e => e.stopPropagation()}
                          />
                          <span className="text-[11px] text-muted-foreground font-medium">DT</span>
                        </div>
                      </div>
                    )}
                    {isSelected && (
                      <div className="mt-1.5 pt-1.5 border-t border-primary/20" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            const newCart = [...cart];
                            newCart[idx] = { ...newCart[idx], ardoise: newCart[idx].ardoise ? null : { personName: '', comment: '' } };
                            updateTicket({ cart: newCart });
                          }}
                          className={cn(
                            "flex items-center justify-center gap-1.5 h-7 px-3 rounded text-[11px] font-bold transition-colors w-full",
                            item.ardoise
                              ? "bg-amber-500 text-white hover:bg-amber-600"
                              : "bg-muted/60 text-muted-foreground hover:bg-amber-500/20 hover:text-amber-600"
                          )}
                        >
                          <BookOpen className="h-3 w-3" />
                          {item.ardoise ? '✓ Sur ardoise (non payé)' : 'Mettre sur ardoise'}
                        </button>
                        {item.ardoise && (
                          <div className="mt-1.5 space-y-1.5">
                            <div>
                              <input
                                value={item.ardoise.personName}
                                onChange={e => {
                                  const newCart = [...cart];
                                  newCart[idx] = { ...newCart[idx], ardoise: { ...newCart[idx].ardoise, personName: e.target.value } };
                                  updateTicket({ cart: newCart });
                                }}
                                onClick={e => e.stopPropagation()}
                                placeholder="Nom de la personne..."
                                list={`ardoise-names-${idx}`}
                                autoComplete="off"
                                className="w-full h-7 text-xs px-2 border border-amber-300 rounded bg-background focus:outline-none focus:ring-1 focus:ring-amber-400 text-foreground"
                              />
                              <datalist id={`ardoise-names-${idx}`}>
                                {ardoiseNames.map(n => <option key={n} value={n} />)}
                              </datalist>
                            </div>
                            <input
                              value={item.ardoise.comment}
                              onChange={e => {
                                const newCart = [...cart];
                                newCart[idx] = { ...newCart[idx], ardoise: { ...newCart[idx].ardoise, comment: e.target.value } };
                                updateTicket({ cart: newCart });
                              }}
                              onClick={e => e.stopPropagation()}
                              placeholder="Commentaire (optionnel)..."
                              className="w-full h-7 text-xs px-2 border border-amber-200 rounded bg-background focus:outline-none focus:ring-1 focus:ring-amber-300 text-foreground"
                            />
                          </div>
                        )}
                      </div>
                    )}
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

          {/* Client + actions */}
          <div className="border-t border-border relative">
            {/* Ligne client */}
            <div className="flex items-center gap-1.5 px-2 py-2 border-b border-border">
              <div className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                clientName && clientName !== 'Client passager'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted-foreground/20 text-muted-foreground"
              )}>
                {clientName && clientName !== 'Client passager'
                  ? clientName.charAt(0).toUpperCase()
                  : <User className="h-3 w-3" />}
              </div>
              <input
                ref={clientInputRef}
                type="text"
                placeholder="Client..."
                value={clientInputValue}
                onChange={e => {
                  setClientInputValue(e.target.value);
                  setShowClientDropdown(true);
                  if (!e.target.value) updateTicket({ clientName: '', clientPhone: '' });
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 150)}
                className="flex-1 min-w-0 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
              {clientName && clientName !== 'Client passager' && (
                <button onClick={() => { updateTicket({ clientName: '', clientPhone: '' }); setClientInputValue(''); }} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Ligne actions : Répar. | Service | Retour */}
            <div className="flex items-stretch">
              <button
                onClick={() => { setRepairSearch(''); setRepairStatusFilter('ouvertes'); setRepairPicking(null); setRepairAmount(''); setNewRepairMode(false); setShowRepairPickerDialog(true); }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 text-orange-600 bg-orange-500/5 hover:bg-orange-500/15 transition-colors border-r border-border text-xs font-semibold whitespace-nowrap"
              >
                <Wrench className="h-3.5 w-3.5" /> Répar.
              </button>
              <button
                onClick={() => { setServiceCatFilter('tous'); setServicePicking(null); setServiceAmount(''); setShowServicePickerDialog(true); }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 text-blue-600 bg-blue-500/5 hover:bg-blue-500/15 transition-colors border-r border-border text-xs font-semibold whitespace-nowrap"
              >
                <Tag className="h-3.5 w-3.5" /> Service
              </button>
              <button
                onClick={() => { setReturnSearchQuery(''); setReturnStep('search'); setReturnPicking(null); setReturnQty(1); setReturnMethod('especes'); setLastReturnNum(''); setShowReturnDialog(true); }}
                className="flex-1 flex items-center justify-center gap-1 px-2 py-2 text-rose-600 bg-rose-500/5 hover:bg-rose-500/15 transition-colors text-xs font-semibold whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Retour
              </button>
            </div>

            {/* Client dropdown */}
            {showClientDropdown && (
              <div className="absolute left-0 right-0 top-full z-50 bg-card border border-border shadow-lg max-h-56 overflow-y-auto">
                {clients
                  .filter(c =>
                    !clientInputValue ||
                    c.full_name?.toLowerCase().includes(clientInputValue.toLowerCase()) ||
                    c.phone?.includes(clientInputValue)
                  )
                  .slice(0, 10)
                  .map(c => (
                    <button
                      key={c.id}
                      onMouseDown={() => {
                        updateTicket({ clientName: c.full_name, clientPhone: c.phone || '' });
                        setClientInputValue(c.full_name);
                        setShowClientDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/60 transition-colors text-left"
                    >
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                        {c.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.full_name}</p>
                        {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                      </div>
                    </button>
                  ))}
                {clients.filter(c =>
                  !clientInputValue ||
                  c.full_name?.toLowerCase().includes(clientInputValue.toLowerCase()) ||
                  c.phone?.includes(clientInputValue)
                ).length === 0 && clientInputValue && (
                  <p className="text-xs text-muted-foreground px-3 py-2">Aucun client trouvé</p>
                )}
                <button
                  onMouseDown={() => {
                    setNewClientForm({ full_name: clientInputValue, phone: '' });
                    setShowAddClientDialog(true);
                    setShowClientDropdown(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-primary hover:bg-primary/5 border-t border-border text-xs font-semibold transition-colors"
                >
                  <UserPlus className="h-4 w-4" /> Ajouter un nouveau client
                </button>
              </div>
            )}
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
          <div className="flex gap-0 border-b border-border bg-card flex-shrink-0 overflow-x-auto">
            {categories.map(cat => {
              const Icon = cat === 'all' ? Home : CATEGORY_ICONS[cat];
              return (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSearch(''); }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 text-[10px] font-medium whitespace-nowrap transition-all flex-shrink-0 border-r border-border/50 min-w-[60px]",
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" strokeWidth={1.5} />}
                  {cat === 'all' ? 'Tous' : CATEGORY_LABELS[cat]}
                </button>
              );
            })}
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

      {/* SERVICE PICKER DIALOG */}
      <Dialog open={showServicePickerDialog} onOpenChange={v => { if (!v) { setShowServicePickerDialog(false); setServicePicking(null); setServiceAmount(''); setNewSvcCatMode(false); setNewSvcCatName(''); setNewServiceMode(false); setNewServiceForm({ name: '', category_id: '', sell_price: '', cost_price: '' }); } }}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">

          {/* Header */}
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              {(servicePicking || newServiceMode) && (
                <button
                  onClick={() => {
                    if (servicePicking) { setServicePicking(null); setServiceAmount(''); }
                    else { setNewServiceMode(false); setNewServiceForm({ name: '', category_id: '', sell_price: '', cost_price: '' }); }
                  }}
                  className="h-9 w-9 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors mr-1 flex-shrink-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <Tag className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span>{servicePicking ? servicePicking.name : newServiceMode ? 'Nouveau service' : 'Choisir un service'}</span>
            </DialogTitle>
          </DialogHeader>

          {/* ── ÉTAPE 1 : sélection ── */}
          {!servicePicking && !newServiceMode && (
            <div className="flex flex-col" style={{ maxHeight: 'calc(85vh - 76px)' }}>

              {/* Barre catégories */}
              <div className="px-4 py-3 border-b border-border flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => setServiceCatFilter('tous')}
                  className={`h-10 px-4 rounded-full text-sm font-medium border transition-all ${serviceCatFilter === 'tous' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border'}`}
                >
                  Toutes
                </button>
                {serviceCategories.map(c => (
                  <button key={c.id} onClick={() => setServiceCatFilter(c.id)}
                    className={`h-10 px-4 rounded-full text-sm font-medium border transition-all ${serviceCatFilter === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border'}`}
                  >
                    {c.name}
                  </button>
                ))}

                {newSvcCatMode ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={newSvcCatName}
                      onChange={e => setNewSvcCatName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newSvcCatName.trim()) createServiceCatMutation.mutate(newSvcCatName.trim());
                        if (e.key === 'Escape') { setNewSvcCatMode(false); setNewSvcCatName(''); }
                      }}
                      placeholder="Nom de la catégorie..."
                      className="h-10 px-3 rounded-full border border-primary text-sm outline-none bg-background w-44"
                    />
                    <button
                      disabled={!newSvcCatName.trim() || createServiceCatMutation.isPending}
                      onClick={() => createServiceCatMutation.mutate(newSvcCatName.trim())}
                      className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 flex-shrink-0"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setNewSvcCatMode(false); setNewSvcCatName(''); }}
                      className="h-10 w-10 rounded-full border border-border flex items-center justify-center hover:bg-muted flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setNewSvcCatMode(true)}
                    className="h-10 px-4 rounded-full text-sm font-medium border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary/60 hover:text-primary transition-all flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" /> Catégorie
                  </button>
                )}
              </div>

              {/* Grille services */}
              <div className="overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-3">
                  {serviceItems
                    .filter(s => serviceCatFilter === 'tous' || s.category_id === serviceCatFilter)
                    .map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setServicePicking(s); setServiceAmount(s.sell_price ? String(s.sell_price) : ''); }}
                        className="flex flex-col items-start gap-2 p-4 min-h-[90px] rounded-xl border border-border bg-card active:scale-[0.97] active:bg-primary/5 transition-all text-left"
                      >
                        <span className="text-base font-semibold text-foreground leading-tight">{s.name}</span>
                        {s.category_name && (
                          <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{s.category_name}</span>
                        )}
                        <span className={`text-base font-bold mt-auto ${s.sell_price ? 'text-primary' : 'text-muted-foreground text-sm italic'}`}>
                          {s.sell_price ? formatCurrency(s.sell_price) : 'Prix libre'}
                        </span>
                      </button>
                    ))}

                  {/* Carte + Nouveau service */}
                  <button
                    onClick={() => {
                      setNewServiceForm({ name: '', category_id: serviceCatFilter !== 'tous' ? serviceCatFilter : '', sell_price: '', cost_price: '' });
                      setNewServiceMode(true);
                    }}
                    className="flex flex-col items-center justify-center gap-2 p-4 min-h-[90px] rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-primary transition-all"
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-sm font-medium">Nouveau service</span>
                  </button>
                </div>

                {serviceItems.filter(s => serviceCatFilter === 'tous' || s.category_id === serviceCatFilter).length === 0 && (
                  <p className="text-center text-muted-foreground text-sm pt-4 pb-2">
                    Aucun service dans cette catégorie
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── FORMULAIRE nouveau service ── */}
          {!servicePicking && newServiceMode && (
            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 76px)' }}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nom du service *</label>
                <Input
                  autoFocus
                  placeholder="ex : Recharge Djezzy 500 MB..."
                  value={newServiceForm.name}
                  onChange={e => setNewServiceForm(f => ({ ...f, name: e.target.value }))}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Catégorie</label>
                <select
                  value={newServiceForm.category_id}
                  onChange={e => setNewServiceForm(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full h-12 rounded-lg border border-border bg-background px-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Sans catégorie</option>
                  {serviceCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Prix de vente ({settings.currency_symbol || 'DT'})</label>
                  <Input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={newServiceForm.sell_price}
                    onChange={e => setNewServiceForm(f => ({ ...f, sell_price: e.target.value }))}
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Coût carte (optionnel)</label>
                  <Input
                    type="number" min="0" step="0.01" placeholder="0.00"
                    value={newServiceForm.cost_price}
                    onChange={e => setNewServiceForm(f => ({ ...f, cost_price: e.target.value }))}
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1 h-12"
                  onClick={() => { setNewServiceMode(false); setNewServiceForm({ name: '', category_id: '', sell_price: '', cost_price: '' }); }}
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1 h-12 gap-2"
                  disabled={!newServiceForm.name.trim() || createServiceItemMutation.isPending}
                  onClick={() => {
                    const cat = serviceCategories.find(c => c.id === newServiceForm.category_id);
                    createServiceItemMutation.mutate({
                      name: newServiceForm.name.trim(),
                      category_id: newServiceForm.category_id || undefined,
                      category_name: cat?.name || '',
                      sell_price: parseFloat(newServiceForm.sell_price) || 0,
                      cost_price: parseFloat(newServiceForm.cost_price) || 0,
                    });
                  }}
                >
                  {createServiceItemMutation.isPending ? 'Création...' : <><Plus className="h-4 w-4" /> Créer et sélectionner</>}
                </Button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 2 : montant ── */}
          {servicePicking && (
            <div className="px-5 py-6 space-y-6">
              {servicePicking.description && (
                <p className="text-sm text-muted-foreground">{servicePicking.description}</p>
              )}
              <div className="space-y-2">
                <label className="text-base font-medium">Montant à encaisser</label>
                <div className="relative">
                  <Input
                    type="number" min="0" step="0.01" autoFocus
                    value={serviceAmount}
                    onChange={e => setServiceAmount(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && serviceAmount !== '' && parseFloat(serviceAmount) >= 0) {
                        const customId = `svc_${servicePicking.id}_${Date.now()}`;
                        const amt = parseFloat(serviceAmount) || 0;
                        setTickets(prev => prev.map(t => {
                          if (t.id !== activeTicketId) return t;
                          const newCart = [...t.cart, { id: customId, name: `🔧 ${servicePicking.name}`, qty: 1, unit_price: amt, discount: 0, isCustom: true, isService: true }];
                          return { ...t, cart: newCart, selectedCartIdx: newCart.length - 1, numpadBuffer: '' };
                        }));
                        setShowServicePickerDialog(false); setServicePicking(null); setServiceAmount('');
                      }
                    }}
                    className="text-3xl font-bold h-16 text-center pr-16"
                    placeholder="0.00"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">
                    {settings.currency_symbol || 'DT'}
                  </span>
                </div>
                {servicePicking.cost_price > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Coût : {formatCurrency(servicePicking.cost_price)} — Marge :{' '}
                    <span className="font-semibold text-green-600">{formatCurrency((parseFloat(serviceAmount) || 0) - servicePicking.cost_price)}</span>
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 h-12" onClick={() => { setServicePicking(null); setServiceAmount(''); }}>
                  Retour
                </Button>
                <Button
                  className="flex-1 h-12 gap-2 text-base"
                  disabled={serviceAmount === '' || parseFloat(serviceAmount) < 0}
                  onClick={() => {
                    const customId = `svc_${servicePicking.id}_${Date.now()}`;
                    const amt = parseFloat(serviceAmount) || 0;
                    setTickets(prev => prev.map(t => {
                      if (t.id !== activeTicketId) return t;
                      const newCart = [...t.cart, { id: customId, name: `🔧 ${servicePicking.name}`, qty: 1, unit_price: amt, discount: 0, isCustom: true, isService: true }];
                      return { ...t, cart: newCart, selectedCartIdx: newCart.length - 1, numpadBuffer: '' };
                    }));
                    setShowServicePickerDialog(false); setServicePicking(null); setServiceAmount('');
                  }}
                >
                  <Plus className="h-5 w-5" /> Ajouter au ticket
                </Button>
              </div>
            </div>
          )}

        </DialogContent>
      </Dialog>

      {/* PERTE ANTICASSE DIALOG */}
      <Dialog open={perteDialog.open} onOpenChange={v => !v && setPerteDialog(d => ({ ...d, open: false }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              ❌ Anticasse raté — enregistrer une perte
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Le stock sera décrémenté de 1 sans facturer. L'anticasse reste dans le ticket pour la 2e pose au même prix.</p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Motif de la perte</label>
              <select
                value={perteDialog.motif}
                onChange={e => setPerteDialog(d => ({ ...d, motif: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {MOTIFS_PERTE.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPerteDialog(d => ({ ...d, open: false }))}>Annuler</Button>
              <Button variant="destructive" onClick={enregistrerPerteAnticasse} disabled={perteDialog.loading}>
                {perteDialog.loading ? 'Enregistrement…' : 'Confirmer la perte'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* REPAIR PICKER DIALOG */}
      <Dialog open={showRepairPickerDialog} onOpenChange={v => { if (!v) { setShowRepairPickerDialog(false); setRepairPicking(null); setRepairAmount(''); setNewRepairMode(false); setNewRepairForm({ client_name: '', client_phone: '', device_type: 'telephone', description: '', amount: '' }); } }}>
        <DialogContent className="max-w-xl p-0 overflow-hidden">

          {/* Header */}
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              {(repairPicking || newRepairMode) && (
                <button
                  onClick={() => {
                    if (repairPicking) { setRepairPicking(null); setRepairAmount(''); }
                    else { setNewRepairMode(false); setNewRepairForm({ client_name: '', client_phone: '', device_type: 'telephone', description: '', amount: '' }); }
                  }}
                  className="h-9 w-9 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors mr-1 flex-shrink-0"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <Wrench className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <span>
                {repairPicking
                  ? `${repairPicking.client_name} — ${repairPicking.device_brand || ''} ${repairPicking.device_model || ''}`.trim()
                  : newRepairMode ? 'Nouvelle réparation rapide' : 'Réparations'}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* ── LISTE réparations ouvertes ── */}
          {!repairPicking && !newRepairMode && (() => {
            const openRepairs = repairs
              .filter(r => r.status !== 'terminee' && r.status !== 'annulee')
              .filter(r => {
                if (repairStatusFilter === 'pret') return r.status === 'pret';
                if (repairStatusFilter === 'en_cours') return r.status !== 'pret' && r.status !== 'reception';
                if (repairStatusFilter === 'reception') return r.status === 'reception';
                return true;
              })
              .filter(r => {
                if (!repairSearch) return true;
                const q = repairSearch.toLowerCase();
                return r.client_name?.toLowerCase().includes(q) ||
                  r.client_phone?.includes(q) ||
                  r.device_brand?.toLowerCase().includes(q) ||
                  r.device_model?.toLowerCase().includes(q) ||
                  r.ticket_number?.toLowerCase().includes(q);
              })
              .sort((a, b) => {
                const order = { pret: 0, en_cours: 1, en_attente_pieces: 2, diagnostic: 3, reception: 4 };
                return (order[a.status] ?? 5) - (order[b.status] ?? 5);
              });

            return (
              <div className="flex flex-col" style={{ maxHeight: 'calc(85vh - 76px)' }}>
                {/* Barre recherche + filtres */}
                <div className="px-4 pt-3 pb-2 space-y-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      autoFocus
                      value={repairSearch}
                      onChange={e => setRepairSearch(e.target.value)}
                      placeholder="Client, appareil, N° ticket..."
                      className="w-full h-11 pl-10 pr-4 rounded-lg border border-border bg-background text-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap pb-1">
                    {[
                      { id: 'ouvertes', label: 'Toutes ouvertes' },
                      { id: 'pret', label: '✓ Prêtes' },
                      { id: 'en_cours', label: 'En cours' },
                      { id: 'reception', label: 'Réception' },
                    ].map(f => (
                      <button key={f.id} onClick={() => setRepairStatusFilter(f.id)}
                        className={`h-9 px-4 rounded-full text-sm font-medium border transition-all ${repairStatusFilter === f.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cards */}
                <div className="overflow-y-auto p-3 space-y-2">
                  {openRepairs.map(r => {
                    const totalPaid = (r.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
                    const price = r.final_cost || r.estimated_cost || 0;
                    const remaining = Math.max(0, price - totalPaid);
                    const st = STATUS_REPAIR[r.status] || { label: r.status, cls: 'bg-muted text-muted-foreground' };
                    return (
                      <button
                        key={r.id}
                        onClick={() => { setRepairPicking(r); setRepairAmount(String(remaining || price)); }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card active:scale-[0.98] active:bg-orange-500/5 transition-all text-left"
                      >
                        <div className="h-11 w-11 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0 text-base font-bold text-orange-600">
                          {r.client_name?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground truncate">{r.client_name}</p>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {[r.device_brand, r.device_model].filter(Boolean).join(' ') || DEVICE_TYPES.find(d => d.value === r.device_type)?.label || ''}
                            {r.ticket_number && <span className="ml-2 opacity-60">#{r.ticket_number}</span>}
                          </p>
                          {r.problem_description && <p className="text-xs text-muted-foreground truncate opacity-70">{r.problem_description}</p>}
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-base font-bold text-foreground">{formatCurrency(remaining || price)}</p>
                          {totalPaid > 0 && <p className="text-[10px] text-green-600">Versé : {formatCurrency(totalPaid)}</p>}
                        </div>
                      </button>
                    );
                  })}

                  {/* Carte nouvelle réparation rapide */}
                  <button
                    onClick={() => setNewRepairMode(true)}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-orange-400 hover:text-orange-500 transition-all"
                  >
                    <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Plus className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Nouvelle réparation rapide</p>
                      <p className="text-xs opacity-70">Créer et encaisser sans pré-enregistrement</p>
                    </div>
                  </button>

                  {openRepairs.length === 0 && repairSearch && (
                    <p className="text-center text-sm text-muted-foreground py-6">Aucune réparation trouvée pour "{repairSearch}"</p>
                  )}
                  {openRepairs.length === 0 && !repairSearch && repairStatusFilter === 'ouvertes' && (
                    <p className="text-center text-sm text-muted-foreground py-4">Aucune réparation ouverte</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── FORMULAIRE nouvelle réparation rapide ── */}
          {!repairPicking && newRepairMode && (
            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 76px)' }}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium">Nom du client *</label>
                  <Input autoFocus placeholder="Prénom Nom" value={newRepairForm.client_name}
                    onChange={e => setNewRepairForm(f => ({ ...f, client_name: e.target.value }))}
                    className="h-12 text-base" />
                </div>
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                  <label className="text-sm font-medium">Téléphone</label>
                  <Input placeholder="0X XX XX XX" value={newRepairForm.client_phone}
                    onChange={e => setNewRepairForm(f => ({ ...f, client_phone: e.target.value }))}
                    className="h-12 text-base" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type d'appareil</label>
                <div className="grid grid-cols-5 gap-2">
                  {DEVICE_TYPES.map(d => (
                    <button key={d.value} onClick={() => setNewRepairForm(f => ({ ...f, device_type: d.value }))}
                      className={`flex flex-col items-center justify-center gap-1 h-16 rounded-xl border-2 text-xs font-medium transition-all ${newRepairForm.device_type === d.value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-muted-foreground/50'}`}
                    >
                      <span className="text-2xl">{d.icon}</span>
                      <span>{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Problème / Description</label>
                <Input placeholder="ex : Écran cassé, batterie morte..." value={newRepairForm.description}
                  onChange={e => setNewRepairForm(f => ({ ...f, description: e.target.value }))}
                  className="h-12 text-base" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Montant de la réparation ({settings.currency_symbol || 'DT'})</label>
                <div className="relative">
                  <Input type="number" min="0" step="0.01" placeholder="0.00" value={newRepairForm.amount}
                    onChange={e => setNewRepairForm(f => ({ ...f, amount: e.target.value }))}
                    className="h-14 text-2xl font-bold text-center pr-14" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">{settings.currency_symbol || 'DT'}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1 h-12"
                  onClick={() => { setNewRepairMode(false); setNewRepairForm({ client_name: '', client_phone: '', device_type: 'telephone', description: '', amount: '' }); }}
                >
                  Annuler
                </Button>
                <Button
                  className="flex-1 h-12 gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                  disabled={!newRepairForm.client_name.trim() || createQuickRepairMutation.isPending}
                  onClick={() => createQuickRepairMutation.mutate(newRepairForm)}
                >
                  {createQuickRepairMutation.isPending ? 'Création...' : <><Plus className="h-4 w-4" /> Créer et encaisser</>}
                </Button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE montant ── */}
          {repairPicking && (() => {
            const totalPaid = (repairPicking.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
            const price = repairPicking.final_cost || repairPicking.estimated_cost || 0;
            const remaining = Math.max(0, price - totalPaid);
            const st = STATUS_REPAIR[repairPicking.status] || { label: repairPicking.status, cls: 'bg-muted text-muted-foreground' };
            return (
              <div className="px-5 py-6 space-y-5">
                {/* Résumé réparation */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                  <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-orange-600">
                    {repairPicking.client_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{repairPicking.client_name}</p>
                    <p className="text-xs text-muted-foreground">{[repairPicking.device_brand, repairPicking.device_model].filter(Boolean).join(' ')}</p>
                    {repairPicking.problem_description && <p className="text-xs text-muted-foreground truncate opacity-70">{repairPicking.problem_description}</p>}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${st.cls}`}>{st.label}</span>
                </div>

                {totalPaid > 0 && (
                  <div className="flex justify-between text-sm px-1">
                    <span className="text-muted-foreground">Total réparation</span>
                    <span className="font-semibold">{formatCurrency(price)}</span>
                  </div>
                )}
                {totalPaid > 0 && (
                  <div className="flex justify-between text-sm px-1">
                    <span className="text-green-600">Déjà versé</span>
                    <span className="font-semibold text-green-600">− {formatCurrency(totalPaid)}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-base font-medium">Montant à encaisser</label>
                  <div className="relative">
                    <Input type="number" min="0" step="0.01" autoFocus
                      value={repairAmount}
                      onChange={e => setRepairAmount(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && repairAmount !== '' && parseFloat(repairAmount) >= 0) {
                          const customId = `rep_${repairPicking.id}_${Date.now()}`;
                          const amt = parseFloat(repairAmount) || 0;
                          const label = `🔧 ${repairPicking.client_name} — ${[repairPicking.device_brand, repairPicking.device_model].filter(Boolean).join(' ') || DEVICE_TYPES.find(d => d.value === repairPicking.device_type)?.label || 'Réparation'}`;
                          setTickets(prev => prev.map(t => {
                            if (t.id !== activeTicketId) return t;
                            const newCart = [...t.cart, { id: customId, name: label, qty: 1, unit_price: amt, discount: 0, isCustom: true, isRepair: true, refId: repairPicking.id, refType: 'repair' }];
                            return { ...t, cart: newCart, selectedCartIdx: newCart.length - 1, numpadBuffer: '', clientName: t.clientName || repairPicking.client_name, clientPhone: t.clientPhone || repairPicking.client_phone };
                          }));
                          setShowRepairPickerDialog(false); setRepairPicking(null); setRepairAmount('');
                        }
                      }}
                      className="text-3xl font-bold h-16 text-center pr-16"
                      placeholder={remaining > 0 ? String(remaining) : '0.00'}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">{settings.currency_symbol || 'DT'}</span>
                  </div>
                  {remaining > 0 && <p className="text-sm text-muted-foreground text-center">Reste à payer : <span className="font-semibold text-orange-600">{formatCurrency(remaining)}</span></p>}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12" onClick={() => { setRepairPicking(null); setRepairAmount(''); }}>
                    Retour
                  </Button>
                  <Button
                    className="flex-1 h-12 gap-2 text-base bg-orange-600 hover:bg-orange-700 text-white"
                    disabled={repairAmount === '' || parseFloat(repairAmount) < 0}
                    onClick={() => {
                      const customId = `rep_${repairPicking.id}_${Date.now()}`;
                      const amt = parseFloat(repairAmount) || 0;
                      const label = `🔧 ${repairPicking.client_name} — ${[repairPicking.device_brand, repairPicking.device_model].filter(Boolean).join(' ') || DEVICE_TYPES.find(d => d.value === repairPicking.device_type)?.label || 'Réparation'}`;
                      setTickets(prev => prev.map(t => {
                        if (t.id !== activeTicketId) return t;
                        const newCart = [...t.cart, { id: customId, name: label, qty: 1, unit_price: amt, discount: 0, isCustom: true, isRepair: true, refId: repairPicking.id, refType: 'repair' }];
                        return { ...t, cart: newCart, selectedCartIdx: newCart.length - 1, numpadBuffer: '', clientName: t.clientName || repairPicking.client_name, clientPhone: t.clientPhone || repairPicking.client_phone };
                      }));
                      setShowRepairPickerDialog(false); setRepairPicking(null); setRepairAmount('');
                    }}
                  >
                    <Plus className="h-5 w-5" /> Ajouter au ticket
                  </Button>
                </div>
              </div>
            );
          })()}

        </DialogContent>
      </Dialog>

      {/* RETURN DIALOG */}
      <Dialog open={showReturnDialog} onOpenChange={v => { if (!v) { setShowReturnDialog(false); setReturnStep('search'); setReturnSearchQuery(''); setReturnPicking(null); setReturnQty(1); setLastReturnNum(''); } }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              {returnStep === 'confirm' && (
                <button onClick={() => { setReturnStep('search'); setReturnPicking(null); setReturnQty(1); }}
                  className="h-9 w-9 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors mr-1 flex-shrink-0">
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <RotateCcw className="h-4 w-4 text-rose-500 flex-shrink-0" />
              <span className="text-rose-600">
                {returnStep === 'search' ? 'Retour produit — 90 derniers jours' : returnStep === 'confirm' ? 'Confirmer le retour' : 'Retour enregistré'}
              </span>
            </DialogTitle>
          </DialogHeader>

          {/* ── ÉTAPE RECHERCHE ── */}
          {returnStep === 'search' && (() => {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const q = returnSearchQuery.toLowerCase().trim();
            const matches = q.length < 1 ? [] : recentSales
              .filter(s => (s.type === 'vente' || !s.type) && new Date(s.created_date || s.created_at || 0) >= ninetyDaysAgo)
              .flatMap(sale => (sale.items || []).map(item => ({ sale, item })))
              .filter(({ sale, item }) => {
                const prod = products.find(p => p.id === item.product_id);
                return (
                  item.product_name?.toLowerCase().includes(q) ||
                  sale.sale_number?.toLowerCase().includes(q) ||
                  sale.client_name?.toLowerCase().includes(q) ||
                  prod?.barcode?.toLowerCase() === q ||
                  prod?.sku?.toLowerCase() === q ||
                  prod?.imei?.toLowerCase() === q
                );
              })
              .slice(0, 20);

            return (
              <div className="p-4 space-y-3" style={{ maxHeight: 'calc(85vh - 76px)', overflowY: 'auto' }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    autoFocus
                    value={returnSearchQuery}
                    onChange={e => setReturnSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && matches.length === 1) {
                        setReturnPicking(matches[0]);
                        setReturnQty(1);
                        setReturnStep('confirm');
                      }
                    }}
                    placeholder="Scanner code-barres ou saisir nom / N° vente / client..."
                    className="w-full h-11 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {q.length === 0 && (
                  <div className="flex flex-col items-center py-8 text-muted-foreground/50 gap-2">
                    <RotateCcw className="h-10 w-10" />
                    <p className="text-sm">Scannez ou recherchez un article vendu</p>
                  </div>
                )}

                {q.length > 0 && matches.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-6">Aucune vente trouvée pour « {returnSearchQuery} » dans les 90 derniers jours</p>
                )}

                {matches.length > 0 && (
                  <div className="space-y-2">
                    {matches.map(({ sale, item }, i) => {
                      const lineTotal = item.quantity * item.unit_price * (1 - (item.discount || 0) / 100);
                      const saleDate = new Date(sale.created_date || sale.created_at || 0).toLocaleDateString('fr-FR');
                      return (
                        <button
                          key={i}
                          onClick={() => { setReturnPicking({ sale, item }); setReturnQty(1); setReturnStep('confirm'); }}
                          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-border hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-all text-left group"
                        >
                          <div className="h-10 w-10 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                            <Package className="h-5 w-5 text-rose-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate group-hover:text-rose-700">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {sale.client_name || 'Client comptoir'} · {saleDate}
                              {sale.sale_number ? ` · ${sale.sale_number}` : ''}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold">{formatCurrency(lineTotal)}</p>
                            <p className="text-xs text-muted-foreground">Qté : {item.quantity}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── ÉTAPE CONFIRMATION ── */}
          {returnStep === 'confirm' && returnPicking && (() => {
            const { sale, item } = returnPicking;
            const unitPrice = item.unit_price * (1 - (item.discount || 0) / 100);
            const refundTotal = returnQty * unitPrice;
            const saleDate = new Date(sale.created_date || sale.created_at || 0).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
            return (
              <div className="p-5 space-y-5" style={{ maxHeight: 'calc(85vh - 76px)', overflowY: 'auto' }}>
                {/* Récap article */}
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-1.5">
                  <p className="font-semibold text-base">{item.product_name}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>Vendu le {saleDate}</span>
                    {sale.client_name && <span>Client : {sale.client_name}</span>}
                    {sale.sale_number && <span>N° {sale.sale_number}</span>}
                  </div>
                  <div className="flex items-baseline gap-2 pt-1">
                    <span className="text-sm text-muted-foreground">Prix unitaire :</span>
                    <span className="font-bold text-foreground">{formatCurrency(unitPrice)}</span>
                    {item.discount > 0 && <span className="text-xs text-orange-500">(remise {item.discount}%)</span>}
                  </div>
                </div>

                {/* Quantité */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantité à retourner</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setReturnQty(q => Math.max(1, q - 1))}
                      className="h-12 w-12 rounded-xl border-2 border-border text-xl font-bold flex items-center justify-center hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors">−</button>
                    <span className="flex-1 text-center text-3xl font-bold">{returnQty}</span>
                    <button onClick={() => setReturnQty(q => Math.min(item.quantity, q + 1))}
                      className="h-12 w-12 rounded-xl border-2 border-border text-xl font-bold flex items-center justify-center hover:border-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors">+</button>
                  </div>
                  <p className="text-xs text-center text-muted-foreground">Max : {item.quantity} unité(s)</p>
                </div>

                {/* Méthode */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mode de remboursement</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'especes', label: '💵 Espèces', desc: 'Cash immédiat' },
                      { value: 'carte', label: '💳 Carte', desc: 'Crédit CB' },
                      { value: 'bon_achat', label: '🎫 Bon d\'achat', desc: 'Avoir boutique' },
                    ].map(m => (
                      <button key={m.value} onClick={() => setReturnMethod(m.value)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-0.5 h-16 rounded-xl border-2 text-xs font-semibold transition-all",
                          returnMethod === m.value
                            ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/30"
                            : "border-border text-muted-foreground hover:border-rose-300"
                        )}>
                        <span className="text-lg">{m.label.split(' ')[0]}</span>
                        <span>{m.label.split(' ').slice(1).join(' ')}</span>
                        <span className="text-[10px] font-normal opacity-70">{m.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Montant + bouton */}
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Montant à rembourser</p>
                    <p className="text-2xl font-bold text-rose-600">{formatCurrency(refundTotal)}</p>
                  </div>
                  <Receipt className="h-8 w-8 text-rose-300" />
                </div>

                <Button
                  className="w-full h-13 text-base gap-2 bg-rose-600 hover:bg-rose-700 text-white"
                  disabled={createReturnMutation.isPending}
                  onClick={() => createReturnMutation.mutate({ sale, item, qty: returnQty, method: returnMethod })}
                >
                  <RotateCcw className="h-4 w-4" />
                  {createReturnMutation.isPending ? 'Traitement...' : `Valider le retour — ${formatCurrency(refundTotal)}`}
                </Button>
              </div>
            );
          })()}

          {/* ── ÉTAPE SUCCÈS ── */}
          {returnStep === 'done' && (
            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Retour enregistré !</h3>
                {lastReturnNum && <p className="text-sm text-muted-foreground mt-1">N° <span className="font-mono font-bold text-foreground">{lastReturnNum}</span></p>}
              </div>
              {returnPicking && (() => {
                const { item } = returnPicking;
                const unitPrice = item.unit_price * (1 - (item.discount || 0) / 100);
                const refundTotal = returnQty * unitPrice;
                const methodLabel = { especes: '💵 Espèces', carte: '💳 Carte', bon_achat: '🎫 Bon d\'achat' }[returnMethod] || returnMethod;
                return (
                  <div className="w-full bg-muted/30 rounded-xl p-4 text-left space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Article</span><span className="font-medium truncate max-w-[180px]">{item.product_name}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Quantité</span><span className="font-medium">{returnQty}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Mode</span><span className="font-medium">{methodLabel}</span></div>
                    <div className="flex justify-between font-bold border-t border-border/50 pt-2"><span>Remboursé</span><span className="text-emerald-500">{formatCurrency(refundTotal)}</span></div>
                  </div>
                );
              })()}
              <Button className="w-full mt-2" onClick={() => { setShowReturnDialog(false); setReturnStep('search'); setReturnSearchQuery(''); setReturnPicking(null); }}>
                Fermer
              </Button>
            </div>
          )}

        </DialogContent>
      </Dialog>

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
            <DialogTitle>
              {ardoiseTotal > 0 && paidTotal === 0
                ? `Ardoise — ${formatCurrency(ardoiseTotal)}`
                : ardoiseTotal > 0
                  ? `Paiement ${formatCurrency(paidTotal)} + ardoise ${formatCurrency(ardoiseTotal)}`
                  : `Paiement — ${formatCurrency(total)}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Articles payés maintenant */}
            {paidTotal > 0 && (
              <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                {cart.filter(i => !i.ardoise).map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{item.name} × {item.qty}</span>
                    <span>{formatCurrency(item.qty * item.unit_price * (1 - (item.discount || 0) / 100))}</span>
                  </div>
                ))}
                <div className="border-t border-border/50 pt-1.5 flex justify-between font-bold text-sm">
                  <span>Payé maintenant</span>
                  <span className="text-primary">{formatCurrency(paidTotal)}</span>
                </div>
              </div>
            )}

            {/* Articles sur ardoise */}
            {ardoiseTotal > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                  <BookOpen className="h-3 w-3" /> Sur ardoise (non payé)
                </p>
                {[...new Set(cart.filter(i => i.ardoise).map(i => i.ardoise.personName?.trim() || 'Non identifié'))].map(name => {
                  const items = cart.filter(i => i.ardoise && (i.ardoise.personName?.trim() || 'Non identifié') === name);
                  const personTotal = items.reduce((s, i) => s + i.qty * i.unit_price * (1 - (i.discount || 0) / 100), 0);
                  return (
                    <div key={name} className="flex justify-between text-xs">
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        👤 {name} <span className="font-normal opacity-70">({items.length} art.)</span>
                      </span>
                      <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(personTotal)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mode de paiement — uniquement pour les articles payés */}
            {paidTotal > 0 && (
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
            )}

            <Button className="w-full" size="lg" onClick={() => saleMutation.mutate()} disabled={saleMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" />
              {saleMutation.isPending
                ? 'Traitement...'
                : ardoiseTotal > 0 && paidTotal === 0
                  ? `Enregistrer ardoise — ${formatCurrency(ardoiseTotal)}`
                  : ardoiseTotal > 0
                    ? `Valider ${formatCurrency(paidTotal)} + ardoise`
                    : `Valider — ${formatCurrency(total)}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD CLIENT DIALOG */}
      <Dialog open={showAddClientDialog} onOpenChange={setShowAddClientDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Nouveau client</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nom complet *</label>
              <Input
                value={newClientForm.full_name}
                onChange={e => setNewClientForm(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Nom du client"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Téléphone</label>
              <PhoneInput
                value={newClientForm.phone}
                onChange={v => setNewClientForm(p => ({ ...p, phone: v }))}
              />
            </div>
            <Button
              className="w-full"
              disabled={!newClientForm.full_name || addClientMutation.isPending}
              onClick={() => addClientMutation.mutate({ full_name: newClientForm.full_name, phone: newClientForm.phone })}
            >
              {addClientMutation.isPending ? 'Ajout...' : 'Ajouter et sélectionner'}
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