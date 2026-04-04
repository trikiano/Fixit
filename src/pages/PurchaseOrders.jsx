import React, { useState, useEffect } from 'react';
import { fixit, OfflineManager } from '@/api/fixitClient';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";

import EmptyState from "@/components/ui/EmptyState";
import EntityRefSelect from "@/components/ui/EntityRefSelect";
import { Receipt, Plus, Search, Trash2, Sparkles, PackageCheck, AlertTriangle, ChevronRight, Scan, XCircle, Package } from 'lucide-react';
import { cn } from "@/lib/utils";


import { format } from 'date-fns';
import { useAppSettings } from "@/components/settings/SettingsContext";

import InvoiceScanner from "@/components/ocr/InvoiceScanner";
import ReceptionWizard from "@/components/ocr/ReceptionWizard";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

import { toast } from "sonner";




export default function PurchaseOrders() {
  const [confirmState, setConfirmState] = useState({ open: false, title: '', description: '', onConfirm: () => {}, variant: 'danger' });

  
  const parseItems = (val) => {
    const [isOnline, setIsOnline] = useState(OfflineManager.isOnline);
    useEffect(() => {
      return OfflineManager.subscribe((online) => setIsOnline(online));
    }, []);


    if (Array.isArray(val)) return val;
    try { return JSON.parse(val || '[]'); } catch (e) { return []; }
  };

  const formatDate = (val) => {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return format(d, 'dd/MM/yyyy');
    } catch (e) { return val; }
  };


  const { formatCurrency, settings } = useAppSettings();
  const [search, setSearch] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [receptionOpen, setReceptionOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDone, setWizardDone] = useState(false);
  const [wizardItems, setWizardItems] = useState([]);

  const [editing, setEditing] = useState(null);

  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');

  const [items, setItems] = useState([]);
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('brouillon');
  const [receptionItems, setReceptionItems] = useState([]);
  const [directEntry, setDirectEntry] = useState(false);
  const [scanAmountPaid, setScanAmountPaid] = useState(0);
  const [scanAmountDue, setScanAmountDue] = useState(0);
  const [isSaving, setIsSaving] = useState(false);



  const qc = useQueryClient();


  const { data: orders = [], isLoading } = useQuery({ queryKey: ['purchaseOrders'], queryFn: () => fixit.entities.PurchaseOrder.list('-created_date') });
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => fixit.entities.Supplier.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => fixit.entities.Product.list() });

  // Produits en stock faible
  const lowStockProducts = products.filter(p => p.is_active !== false && (p.quantity || 0) <= (p.min_stock || 2));

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      // Check for duplicates (same supplier + same order number) excluding current editing order
      const duplicate = orders.find(o => 
        o.supplier_id === data.supplier_id && 
        o.order_number?.toLowerCase().trim() === data.order_number?.toLowerCase().trim() &&
        (!editing || o.id !== editing.id)
      );

      if (duplicate) {
        throw new Error("DOUBLON_FACTURE");
      }

      if (editing) return fixit.entities.PurchaseOrder.update(editing.id, data);
      return fixit.entities.PurchaseOrder.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      toast.success(editing ? "Commande mise à jour" : "Commande créée");
      closeDialog();
    },
    onError: (err) => {
      if (err.message === "DOUBLON_FACTURE") {
        toast.error("Facture déjà enregistrée !", {
          description: "Le numéro de facture existe déjà pour ce fournisseur.",
          duration: 6000,
        });
      } else {
        toast.error("Erreur lors de l'enregistrement");
      }
    },
    onSettled: () => {
      // Ensure UI is clean
      setIsSaving(false);
    }
  });



  const cancelMutation = useMutation({
    mutationFn: async (order) => {
      try {
        if (!order || !['recue', 'partielle'].includes(order.status)) {
          await fixit.entities.PurchaseOrder.update(order.id, { status: 'annulee' });
          toast.success("Commande annulée");
          return;
        }

        const freshProducts = await fixit.entities.Product.list();
        const currentItems = parseItems(order.items);
        const toReverse = [];

        // Phase 1: Security Checks
        for (const item of currentItems) {
          if (item.quantity_received > 0) {
            const prod = freshProducts.find(p => p.id === item.product_id);
            if (!prod || prod.quantity < item.quantity_received) {
              toast.error(`Stock insuffisant pour ${item.product_name}`);
              throw new Error("STOCK_INSUFFISANT");
            }
            toReverse.push({ prod, qty: item.quantity_received });
          }
        }

        // Phase 2: Stock Reversal
        for (const entry of toReverse) {
          const { prod, qty } = entry;
          const prevQty = Number(prod.quantity) || 0;
          const newQty = prevQty - qty;
          await fixit.entities.Product.update(prod.id, { quantity: newQty });
          await fixit.entities.StockMovement.create({
            product_id: prod.id, product_name: prod.name,
            type: 'sortie', quantity: qty, previous_stock: prevQty, new_stock: newQty,
            reason: `Annulation commande ${order.order_number}`, reference_type: 'achat', reference_id: order.id
          });
        }

        // Phase 3: Invoice update
        const invoices = await fixit.entities.SupplierInvoice.list();
        const linkedInvoice = invoices.find(inv => inv.purchase_order_id === order.id);
        if (linkedInvoice) {
          await fixit.entities.SupplierInvoice.update(linkedInvoice.id, { status: 'refusee' });
        }

        await fixit.entities.PurchaseOrder.update(order.id, { status: 'annulee' });
        toast.success("Réception annulée et stock mis à jour");
        await qc.invalidateQueries({ queryKey: ['purchaseOrders'], refetchType: 'all' });
      } catch (err) {
        if (err.message !== "STOCK_INSUFFISANT") {
          toast.error("Erreur lors de l'annulation");
          console.error(err);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => {
      console.error("Cancel Mutation Error:", err);
      toast.error("Échec de l'annulation", { description: "Vérifiez votre connexion." });
    }
  });




  const receptionMutation = useMutation({
    mutationFn: async ({ order, receivedItems }) => {
      if (!order) throw new Error("Commande invalide");
      
      const freshProducts = await fixit.entities.Product.list();
      const currentItems = parseItems(order.items);

      let allReceived = true;
      const updatedItems = currentItems.map(item => {
        const rec = receivedItems.find(r => r.product_id === item.product_id);
        const qtyToReceiveNow = rec?.qty_now || 0;
        const qtyReceivedTotal = (Number(item.quantity_received) || 0) + Number(qtyToReceiveNow);
        if (qtyReceivedTotal < item.quantity_ordered) allReceived = false;
        return { ...item, quantity_received: qtyReceivedTotal, unit_price: rec?.buy_price_now ?? item.unit_price };
      });

      for (const rec of receivedItems) {
        if (rec.qty_now > 0 && rec.product_id) {
          const prod = freshProducts.find(p => p.id === rec.product_id);
          if (prod) {
            const prevQty = Number(prod.quantity) || 0;
            const recQty = Number(rec.qty_now);
            const newQty = prevQty + recQty;
            const receivedPrice = Number(rec.buy_price_now) || 0;
            const oldPAMP = Number(prod.buy_price_avg) || Number(prod.buy_price) || 0;
            const newPAMP = ((prevQty * oldPAMP) + (recQty * receivedPrice)) / Math.max(newQty, 1);

            await fixit.entities.Product.update(prod.id, { 
              quantity: newQty,
              buy_price_avg: newPAMP,
              buy_price: receivedPrice
            });

            await fixit.entities.StockMovement.create({
              product_id: prod.id, product_name: prod.name, type: 'entree',
              quantity: recQty, previous_stock: prevQty, new_stock: newQty,
              reason: `Réception commande ${order.order_number || ''}`, reference_type: 'achat', reference_id: order.id,
              notes: `Prix achat: ${receivedPrice} | Nouveau PAMP: ${newPAMP.toFixed(2)}`
            });
          }
        }
      }

      const newStatus = allReceived ? 'recue' : 'partielle';
      const updatedOrder = await fixit.entities.PurchaseOrder.update(order.id, { 
        items: updatedItems, 
        status: newStatus,
        received_date: format(new Date(), 'yyyy-MM-dd')
      });

      const receivedTotal = receivedItems.reduce((s, r) => s + (Number(r.qty_now) * (Number(r.buy_price_now) || 0)), 0);
      if (receivedTotal > 0) {
        const invoiceNum = `FACT-${order.order_number || Date.now()}`;
        await fixit.entities.SupplierInvoice.create({
          invoice_number: invoiceNum,
          supplier_id: order.supplier_id,
          supplier_name: order.supplier_name,
          description: `Réception sur CMD ${order.order_number || ''}`,
          invoice_date: format(new Date(), 'yyyy-MM-dd'),
          total_amount: receivedTotal,
          amount_paid: scanAmountPaid || 0,
          remaining_debt: (receivedTotal - (scanAmountPaid || 0)),
          status: (scanAmountPaid >= receivedTotal) ? 'payee' : (scanAmountPaid > 0 ? 'partielle' : 'en_attente'),
          purchase_order_id: order.id,
        });

      }
      return updatedOrder;
    },



    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['supplierInvoices'] });
      setReceptionOpen(false);
      setEditing(null);
    },
    onError: (err) => {
      console.error("Reception Mutation Error:", err);
      toast.error("Échec de la réception", { description: "Vérifiez votre connexion réseau." });
    }
  });


  const closeDialog = () => {
    setDialogOpen(false); setEditing(null); setSupplierId(''); setSupplierName('');
    setItems([]); setExpectedDate(''); setNotes(''); setStatus('brouillon');
    setWizardDone(false);
  };


  const openEdit = (o) => {
    setEditing(o); 
    setSupplierId(o.supplier_id || ''); 
    setSupplierName(o.supplier_name || '');
    setItems(parseItems(o.items)); 
    setExpectedDate(o.expected_date || ''); 
    setNotes(o.notes || ''); 
    setStatus(o.status || 'brouillon');
    setDialogOpen(true);
  };

  const openReception = (o) => {
    setEditing(o);
    const existingItems = parseItems(o.items);
    setReceptionItems(existingItems.map(item => {
      const p = products.find(px => px.id === item.product_id);
      return {
        ...item,
        qty_remaining: (item.quantity_ordered || 0) - (item.quantity_received || 0),
        qty_now: (item.quantity_ordered || 0) - (item.quantity_received || 0),
        buy_price_now: item.unit_price || 0,
        image_url: p?.image_url || ''
      };
    }));

    setReceptionOpen(true);
  };



  const addItem = () => setItems([...items, { product_id: '', product_name: '', quantity_ordered: 1, quantity_received: 0, unit_price: 0 }]);

  const updateItem = (idx, field, value) => {
    const n = [...items]; n[idx][field] = value;
    if (field === 'product_id') { 
      const p = products.find(x => x.id === value); 
      if (p) { 
        n[idx].product_name = p.name; 
        n[idx].unit_price = p.buy_price_avg || p.buy_price || 0; 
      } 
    }
    setItems(n);
  };


  const addLowStockSuggestions = () => {
    const existing = items.map(i => i.product_id);
    const toAdd = lowStockProducts
      .filter(p => !existing.includes(p.id))
      .map(p => ({
        product_id: p.id, product_name: p.name,
        quantity_ordered: Math.max((p.min_stock || 2) * 2 - (p.quantity || 0), 1),
        quantity_received: 0, unit_price: p.buy_price || 0,
      }));
    setItems([...items, ...toAdd]);
  };

  const handleScanSave = async (data) => {
    try {
      // 1. Ensure Supplier
      let sid = suppliers.find(s => s.name.toUpperCase() === data.supplier_name.toUpperCase())?.id;
      if (!sid && data.supplier_name) {
        const newSup = await fixit.entities.Supplier.create({ name: data.supplier_name.toUpperCase() });
        sid = newSup.id;
        await qc.invalidateQueries({ queryKey: ['suppliers'] });
      }

      setSupplierId(sid || '');
      setSupplierName(data.supplier_name);
      setExpectedDate(data.date);
      setScanAmountPaid(data.amount_paid || 0);
      setNotes(`Scan Facture ${data.order_number || ''}`);
      
      // Aggréger les articles par nom pour éviter de répéter les étapes du Wizard pour le même produit
      const aggregated = [];
      data.items.forEach(it => {
        const existing = aggregated.find(a => a.product_name.toUpperCase().trim() === it.product_name.toUpperCase().trim());
        if (existing) {
          existing.quantity_ordered += Number(it.quantity_ordered);
          // On garde le prix unitaire moyen ou le dernier
          existing.unit_price = (existing.unit_price + Number(it.unit_price)) / 2;
        } else {
          aggregated.push({ ...it, quantity_ordered: Number(it.quantity_ordered) });
        }
      });

      // Auto-match products to prep wizard
      const autoMatchedItems = aggregated.map(it => {
        const p = products.find(px => px.name.toLowerCase().trim() === it.product_name.toLowerCase().trim());
        return {
          ...it,
          product_id: p?.id,
          category: p?.category || 'Téléphone',
          brand: p?.brand || '',
          model: p?.model || '',
          sell_price: p?.sell_price || (it.unit_price * 1.3),
          barcode: p?.barcode || '',
          image_url: p?.image_url || ''
        };
      });


      setWizardItems(autoMatchedItems);
      setWizardOpen(true);
      setScannerOpen(false);
    } catch (err) {
      console.error("OCR Import Error:", err);
      toast.error("Erreur de préparation des données");
    }
  };

  const handleWizardFinish = async (enrichedItems) => {
    // 1. Update/Create products in background
    const itemsToSave = [];
    for (const it of enrichedItems) {
      let pid = it.product_id;
      if (pid) {
        await fixit.entities.Product.update(pid, {
          category: it.category,
          brand: it.brand,
          model: it.model,
          sell_price: it.sell_price,
          barcode: it.barcode,
          image_url: it.image_url
        });
      } else {
        const newP = await fixit.entities.Product.create({
          name: it.product_name.toUpperCase(),
          category: it.category,
          brand: it.brand,
          model: it.model,
          sell_price: it.sell_price,
          buy_price: it.unit_price,
          quantity: 0,
          barcode: it.barcode,
          image_url: it.image_url
        });
        pid = newP.id;
      }
      itemsToSave.push({
        product_id: pid,
        product_name: it.product_name,
        quantity_ordered: it.quantity_ordered,
        quantity_received: 0,
        unit_price: it.unit_price
      });
    }

    // 2. Refresh queries and show PO dialog
    await qc.invalidateQueries({ queryKey: ['products'] });
    setItems(itemsToSave);
    setWizardDone(true);
    setDirectEntry(true);
    setDialogOpen(true);

    toast.success(`${itemsToSave.length} articles vérifiés avec succès`);
  };


  const total = items.reduce((s, i) => s + (i.quantity_ordered * i.unit_price), 0);


  const handleSave = async () => {
    const orderNum = editing?.order_number || `CMD-${Date.now().toString(36).toUpperCase()}`;


    const payload = { 
      order_number: orderNum, 
      supplier_id: supplierId, 
      supplier_name: supplierName, 
      status: directEntry ? 'recue' : status, 
      items, 
      total_amount: total, 
      expected_date: expectedDate, 
      notes,
      received_date: directEntry ? format(new Date(), 'yyyy-MM-dd') : null
    };
    
    try {
      if (directEntry) {
        // For direct entry, check if we should show wizard first
        if (!wizardDone && items.length > 0) {
           const wizardData = items.map(it => {

             const p = products.find(px => px.id === it.product_id);
             return {
               ...it,
               category: p?.category,
               brand: p?.brand,
               model: p?.model,
               sell_price: p?.sell_price || (it.unit_price * 1.3),
               barcode: p?.barcode || '',
               image_url: p?.image_url || ''
             };
           });
           setWizardItems(wizardData);
           setWizardOpen(true);
           return; // Stop here, wizard will call back
        }

        const order = await fixit.entities.PurchaseOrder.create(payload);
        if (order) {
          await receptionMutation.mutateAsync({ 
            order, 
            receivedItems: items.map(i => ({ 
              ...i, 
              qty_now: i.quantity_ordered, 
              buy_price_now: i.unit_price 
            })) 
          });
          closeDialog();
        }
      } else {
        await saveMutation.mutateAsync(payload);
      }
    } catch (err) {
      console.error("Save Error:", err);
      toast.error("Erreur lors de l'opération", {
        description: "Vérifiez votre connexion internet."
      });
    }

  };



  const handleReception = () => {
    if(!editing) return;
    receptionMutation.mutate({ order: editing, receivedItems: receptionItems });
  };


  const [tab, setTab] = useState('active');

  const filtered = orders.filter(o => {
    const matchesSearch = o.order_number?.toLowerCase().includes(search.toLowerCase()) || 
                         o.supplier_name?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    if (tab === 'active') return ['brouillon', 'envoyee', 'partielle'].includes(o.status);
    if (tab === 'recue') return o.status === 'recue';
    if (tab === 'annulee') return o.status === 'annulee';
    return true;
  });


  const columns = [
    { header: "N° Commande", render: r => <span className="text-sm font-mono font-medium text-primary">{r.order_number}</span> },
    { header: "Fournisseur", render: r => <span className="text-sm">{r.supplier_name}</span> },
    { header: "Statut", render: r => <StatusBadge status={r.status} /> },
    { header: "Articles", render: r => <span className="text-sm text-muted-foreground">{parseItems(r.items).length} article(s)</span> },

    { header: "Montant", render: r => <span className="text-sm font-medium">{formatCurrency(r.total_amount || 0)}</span> },

    { header: "Date prévue", render: r => <span className="text-xs text-muted-foreground">{formatDate(r.expected_date)}</span> },
    { header: "Date réception", render: r => <span className="text-xs font-medium text-emerald-500">{formatDate(r.received_date)}</span> },

    {
      header: "Actions", render: r => (
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          {['brouillon', 'envoyee', 'partielle'].includes(r.status) && (
            <Button size="sm" variant="outline" className="gap-1 text-green-400 border-green-500/40 hover:bg-green-500/10" onClick={() => openReception(r)}>
              <PackageCheck className="h-3.5 w-3.5" /> Réceptionner
            </Button>
          )}

          
          {r.status !== 'annulee' && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="text-destructive hover:bg-destructive/10" 
              onClick={() => {
                const isDraft = ['brouillon', 'envoyee'].includes(r.status);
                setConfirmState({
                  open: true,
                  title: isDraft ? "Supprimer la commande" : "Annuler la réception",
                  description: isDraft 
                    ? `Souhaitez-vous vraiment supprimer définitivement la commande ${r.order_number} ?`
                    : `Souhaitez-vous annuler la réception de la commande ${r.order_number} ? Les articles seront retirés du stock.`,
                  variant: 'danger',
                  onConfirm: async () => {
                    setConfirmState(prev => ({ ...prev, open: false }));
                    try {
                      if (isDraft) {
                        await fixit.entities.PurchaseOrder.delete(r.id);
                        toast.success("Commande supprimée");
                      } else {
                        await cancelMutation.mutateAsync(r);
                      }
                      // Refetch everything
                      await qc.invalidateQueries({ queryKey: ['purchaseOrders'] });
                    } catch (e) {
                      toast.error("Action impossible (éléments liés?)");
                      console.error(e);
                    }
                  }


                });
              }}
            >
              {['brouillon', 'envoyee'].includes(r.status) ? <Trash2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            </Button>
          )}


          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )
    },

  ];

  return (
    <div>
      <PageHeader title="Commandes d'achat" subtitle={`${orders.length} commandes`}>
        <div className="flex gap-2 items-center">
          {lowStockProducts.length > 0 && (
            <Button variant="outline" className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10 gap-1 h-10 px-4">
              <AlertTriangle className="h-4 w-4" /> {lowStockProducts.length} stock faible
            </Button>
          )}
          <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => setScannerOpen(true)}>
            <Scan className="h-4 w-4 mr-2" /> Scanner Facture
          </Button>
          <Button variant="outline" className="border-green-500/50 text-green-400 hover:bg-green-500/10" onClick={() => { setDirectEntry(true); setDialogOpen(true); }}>
            <PackageCheck className="h-4 w-4 mr-2" /> Réception directe
          </Button>

          <Button onClick={() => { setDirectEntry(false); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Nouvelle commande
          </Button>
        </div>
      </PageHeader>


      <div className="flex justify-between items-center mb-6">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher une commande..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="ml-4">
          <TabsList className="grid grid-cols-3 w-80">
            <TabsTrigger value="active" className="text-xs">En cours</TabsTrigger>
            <TabsTrigger value="recue" className="text-xs">Reçues</TabsTrigger>
            <TabsTrigger value="annulee" className="text-xs">Annulées</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState 
          icon={tab === 'annulee' ? XCircle : Receipt} 
          title={tab === 'active' ? "Aucune commande en cours" : tab === 'recue' ? "Aucune commande reçue" : "Aucune commande annulée"} 
          description="Vous pouvez créer une nouvelle commande ou modifier vos filtres."
          actionLabel={tab === 'active' ? "Créer" : null} 
          onAction={tab === 'active' ? () => setDialogOpen(true) : null} 
        />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}


      <ConfirmDialog 
        open={confirmState.open}
        onOpenChange={v => setConfirmState({...confirmState, open: v})}
        title={confirmState.title}
        description={confirmState.description}
        onConfirm={confirmState.onConfirm}
        variant={confirmState.variant}
      />


      {/* ── Création / Édition ── */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {directEntry ? <PackageCheck className="h-5 w-5 text-green-400" /> : <Receipt className="h-5 w-5 text-primary" />}
              {directEntry ? 'Saisir une Réception Directe' : (editing ? `Commande ${editing.order_number}` : 'Nouvelle commande')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {editing && editing.status === 'annulee' && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-lg flex items-center gap-2 text-sm font-bold">
                <XCircle className="h-4 w-4" /> CETTE COMMANDE EST ANNULÉE ET NE PEUT PLUS ÊTRE MODIFIÉE.
              </div>
            )}
            {editing && editing.status === 'recue' && (
              <div className="bg-emerald-500/10 text-emerald-500 p-3 rounded-lg flex items-center gap-2 text-sm font-medium">
                <PackageCheck className="h-4 w-4" /> Cette commande a été réceptionnée. Pour modifier le stock, vous devez l'annuler d'abord.
              </div>
            )}

            {editing && !['recue', 'annulee'].includes(editing.status) && (
              <div className="flex gap-2 mb-4">
                <Button 
                   className="w-full bg-green-500/10 text-green-500 border-green-500/30 hover:bg-green-500/20"
                   variant="outline"
                   onClick={() => {
                     const recItems = items.map(it => ({ ...it, qty_now: it.quantity_ordered, buy_price_now: it.unit_price }));
                     receptionMutation.mutate({ order: editing, receivedItems: recItems });
                   }}
                >
                   <PackageCheck className="h-4 w-4 mr-2" /> Transformer en Réception (Tout réceptionner)
                </Button>
              </div>
            )}
            {editing && (
              <div>
                <Label>Statut</Label>
                <Select value={status} onValueChange={setStatus} disabled={['recue', 'annulee'].includes(editing.status)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brouillon">Brouillon</SelectItem>
                    <SelectItem value="envoyee">Envoyée</SelectItem>
                    <SelectItem value="partielle" disabled>Partielle (via réception)</SelectItem>
                    <SelectItem value="recue" disabled>Reçue (via réception)</SelectItem>
                    <SelectItem value="annulee" disabled>Annulée (via bouton annuler)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fournisseur *</Label>
                <EntityRefSelect
                  entityType="supplier"
                  value={supplierId}
                  disabled={editing && ['recue', 'annulee'].includes(editing.status)}
                  placeholder="Choisir le fournisseur..."
                  onChange={(v, label) => {


                    setSupplierId(v);
                    setSupplierName(label || suppliers.find(s => s.id === v)?.name || '');
                  }}
                />
              </div>
              <div><Label>Date prévue</Label><Input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base font-semibold">Articles</Label>
                <div className="flex gap-2">
                  {lowStockProducts.length > 0 && !(editing && ['recue', 'annulee'].includes(editing.status)) && (
                    <Button variant="outline" size="sm" className="gap-1 text-amber-400 border-amber-500/40 hover:bg-amber-500/10" onClick={addLowStockSuggestions}>
                      <Sparkles className="h-3 w-3" /> Suggérer stock faible ({lowStockProducts.length})
                    </Button>
                  )}
                  {!(editing && ['recue', 'annulee'].includes(editing.status)) && (
                    <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Ajouter</Button>
                  )}
                </div>

              </div>

              {/* Suggestions visuelles */}
              {items.length === 0 && lowStockProducts.length > 0 && (
                <Card className="border-amber-500/30 bg-amber-500/5 mb-3">
                  <CardContent className="p-3">
                    <p className="text-xs text-amber-400 font-medium mb-2 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Produits en stock faible</p>
                    <div className="flex flex-wrap gap-2">
                      {lowStockProducts.slice(0, 8).map(p => (
                        <Badge key={p.id} variant="outline" className="border-amber-500/40 text-amber-300 cursor-pointer hover:bg-amber-500/20 text-xs"
                          onClick={() => setItems(prev => [...prev, { product_id: p.id, product_name: p.name, quantity_ordered: Math.max((p.min_stock || 2) * 2 - (p.quantity || 0), 1), quantity_received: 0, unit_price: p.buy_price || 0 }])}>
                          {p.name} ({p.quantity || 0} en stock)
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-muted/30 mb-2">
                  <div className="col-span-5">
                    <Label className="text-xs">Produit</Label>
                    <Select value={item.product_id} onValueChange={v => updateItem(idx, 'product_id', v)} disabled={editing && ['recue', 'annulee'].includes(editing.status)}>
                      <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} {(p.quantity || 0) <= (p.min_stock || 2) ? '⚠️' : ''}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label className="text-xs">Qté commandée</Label><Input type="number" min={1} value={item.quantity_ordered} onChange={e => updateItem(idx, 'quantity_ordered', parseInt(e.target.value) || 1)} disabled={editing && ['recue', 'annulee'].includes(editing.status)} /></div>
                  <div className="col-span-2"><Label className="text-xs">Prix unit.</Label><Input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} disabled={editing && ['recue', 'annulee'].includes(editing.status)} /></div>
                  <div className="col-span-2 text-right font-bold text-sm pt-5">{formatCurrency(item.quantity_ordered * item.unit_price)}</div>

                  <div className="col-span-1 pt-5">
                    {!(editing && ['recue', 'annulee'].includes(editing.status)) && (
                      <Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    )}
                  </div>

                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} className="w-64" disabled={editing && ['recue', 'annulee'].includes(editing.status)} /></div>
              <div className="text-right"><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold text-primary">{formatCurrency(total)}</p></div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Fermer</Button>
              {!(editing && ['recue', 'annulee'].includes(editing.status)) && (
                <Button 
                  onClick={handleSave} 
                  disabled={!supplierId || saveMutation.isPending || receptionMutation.isPending}
                >
                  {receptionMutation.isPending || saveMutation.isPending ? 'Traitement...' : (editing ? 'Mettre à jour' : 'Confirmer')}
                </Button>


              )}
            </div>


          </div>
        </DialogContent>
      </Dialog>

      {/* ── Réception / Livraison ── */}
      <Dialog open={receptionOpen} onOpenChange={v => !v && setReceptionOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-green-400" />
              Réceptionner la livraison — {editing?.order_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">Vérifiez et ajustez les quantités réellement reçues. Le stock sera mis à jour automatiquement.</p>

            <div className="space-y-2">
              {receptionItems.map((item, idx) => {
                const alreadyReceived = (parseItems(editing?.items).find(i => i.product_id === item.product_id)?.quantity_received) || 0;
                return (


                  <div key={idx} className="space-y-3 p-4 rounded-xl border border-border bg-muted/20 mb-3 shadow-sm">
                    <div className="flex gap-4">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.product_name} className="h-12 w-12 rounded-lg object-cover flex-shrink-0 border border-border/50" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="h-6 w-6 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-foreground truncate">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground italic">Cmd: {item.quantity_ordered} | Reçu: {alreadyReceived} | Reste: <span className="text-amber-400 font-bold">{item.qty_remaining}</span></p>
                          </div>
                          <Badge variant="outline" className={cn("ml-2 shadow-sm", item.qty_now < item.qty_remaining ? 'text-amber-400 border-amber-400/30' : 'text-green-400 border-green-400/30')}>
                            {item.qty_now} Reçu(s)
                          </Badge>
                        </div>
                      </div>
                    </div>

                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Qté reçue ce jour</Label>
                        <Input
                          type="number" min={0} max={item.qty_remaining}
                          value={item.qty_now}
                          onChange={e => {
                            const n = [...receptionItems];
                            n[idx].qty_now = Math.min(parseInt(e.target.value) || 0, item.qty_remaining);
                            setReceptionItems(n);
                          }}
                          className="h-9 focus-visible:ring-green-500/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">P. Achat Unit. ({settings.currency_symbol || 'DT'})</Label>
                        <Input
                          type="number" step="0.01"
                          value={item.buy_price_now}
                          onChange={e => {
                            const n = [...receptionItems];
                            n[idx].buy_price_now = parseFloat(e.target.value) || 0;
                            setReceptionItems(n);
                          }}
                          className="h-9 focus-visible:ring-primary/50"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}



            </div>

            <div className="flex justify-between items-center pt-2">
              <div>
                {receptionItems.every(i => i.qty_now === i.qty_remaining)
                  ? <Badge className="bg-green-500/20 text-green-400">Livraison complète</Badge>
                  : <Badge className="bg-amber-500/20 text-amber-400">Livraison partielle</Badge>
                }
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setReceptionOpen(false)}>Annuler</Button>
                <Button onClick={handleReception} disabled={receptionMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
                  <PackageCheck className="h-4 w-4 mr-2" />
                  {receptionMutation.isPending ? 'Traitement...' : 'Confirmer la réception'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <InvoiceScanner 
        open={scannerOpen} 
        onOpenChange={setScannerOpen} 
        onSave={handleScanSave} 
        orders={orders}
      />

      <ReceptionWizard 
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        items={wizardItems}
        onFinish={handleWizardFinish}
      />
    </div>
  );
}