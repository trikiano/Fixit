import React, { useState, useEffect } from 'react';
import { useAppSettings } from "@/components/settings/SettingsContext";
import { fixit } from '@/api/fixitClient';
import { cn } from '@/lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { Wrench, Plus, Search, ShoppingCart, Clock } from 'lucide-react';
import ClientSelector from "@/components/ui/ClientSelector";
import PhoneInput from '@/components/ui/PhoneInput';
import PartsManager from "@/components/repairs/PartsManager";
import RepairPayments from "@/components/repairs/RepairPayments";
import EntityRefSelect from "@/components/ui/EntityRefSelect";
import { format } from 'date-fns';
import { useShell } from '@/lib/ShellContext';


const repairStatuses = [
  { value: 'reception', label: 'Réception' },
  { value: 'diagnostic', label: 'Diagnostic' },
  { value: 'devis_envoye', label: 'Devis envoyé' },
  { value: 'en_attente_pieces', label: 'Attente pièces' },
  { value: 'en_reparation', label: 'En réparation' },
  { value: 'test', label: 'Test' },
  { value: 'pret', label: 'Prêt' },
  { value: 'livre', label: 'Livré' },
  { value: 'annule', label: 'Annulé' },
];

const priorities = [
  { value: 'basse', label: 'Basse' },
  { value: 'normale', label: 'Normale' },
  { value: 'haute', label: 'Haute' },
  { value: 'urgente', label: 'Urgente' },
];

const emptyForm = {
  client_name: '', client_phone: '', device_type: 'smartphone', device_brand: '', device_model: '',
  device_imei: '', device_password: '', issue_description: '', diagnosis: '', status: 'reception',
  priority: 'normale', assigned_to: '', estimated_cost: 0, final_cost: 0, deposit: 0,
  warranty_days: 90, technician_notes: '', parts_used: [], payments: [], estimated_date: ''
};



// Helper to safely treat JSON fields as arrays
const safeArray = (val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val || '[]'); } catch (e) { return []; }
  }
  return [];
};


export default function Repairs() {
  const { formatCurrency, generateTicketNumber, settings } = useAppSettings();
  const { openTab } = useShell();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [todayOnly, setTodayOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const clientName = urlParams.get('client_name') || '';
    const clientPhone = urlParams.get('client_phone') || '';
    return { ...emptyForm, client_name: clientName, client_phone: clientPhone };
  });
  const [autoOpen] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return !!(urlParams.get('client_name'));
  });
  const qc = useQueryClient();

  React.useEffect(() => {
    if (autoOpen) setDialogOpen(true);
  }, [autoOpen]);

  const { data: repairs = [], isLoading } = useQuery({ queryKey: ['repairs'], queryFn: () => fixit.entities.Repair.list('-created_date') });

  const sendRepairSms = async (repairData, ticketNum) => {
    if (!settings.sms_api_key || !settings.sms_provider || !repairData.client_phone) return;
    const statusLabel = repairStatuses.find(s => s.value === repairData.status)?.label || repairData.status;
    const cost = repairData.final_cost || repairData.estimated_cost || 0;
    const message = `🔧 Ticket ${ticketNum}\nClient: ${repairData.client_name}\nAppareil: ${repairData.device_brand || ''} ${repairData.device_model || ''}\nStatut: ${statusLabel}\nProblème: ${repairData.issue_description}\n${cost > 0 ? `Coût: ${formatCurrency(cost)}\n` : ''}${settings.shop_name || 'TechRepair Pro'} - Merci !`;

    try {
      await fixit.functions.invoke('sendSms', {
        to: repairData.client_phone,
        message,
        provider: settings.sms_provider,
        apiKey: settings.sms_api_key,
        apiSecret: settings.sms_api_secret || '',
        from: settings.sms_from || '',
      });
    } catch {}
  };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const ticketNum = data.ticket_number || generateTicketNumber('repair');
      const payload = { ...data, ticket_number: ticketNum };
      const result = editing
        ? await fixit.entities.Repair.update(editing.id, payload)
        : await fixit.entities.Repair.create(payload);
      await sendRepairSms(payload, ticketNum);
      return result;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['repairs'] }); closeDialog(); },
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      client_name: r.client_name, client_phone: r.client_phone, device_type: r.device_type || 'smartphone',
      device_brand: r.device_brand || '', device_model: r.device_model || '', device_imei: r.device_imei || '',
      device_password: r.device_password || '', issue_description: r.issue_description || '', diagnosis: r.diagnosis || '',
      status: r.status || 'reception', priority: r.priority || 'normale', assigned_to: r.assigned_to || '',
      estimated_cost: r.estimated_cost || 0, final_cost: r.final_cost || 0, deposit: r.deposit || 0,
      warranty_days: r.warranty_days || 90, technician_notes: r.technician_notes || '', ticket_number: r.ticket_number || '',
      parts_used: safeArray(r.parts_used), payments: safeArray(r.payments), 
      estimated_date: r.estimated_date ? format(new Date(r.estimated_date), 'yyyy-MM-dd') : ''
    });



    setDialogOpen(true);
  };

  const filtered = repairs.filter(r => {
    const matchSearch = r.client_name?.toLowerCase().includes(search.toLowerCase()) || r.ticket_number?.toLowerCase().includes(search.toLowerCase()) || r.device_brand?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    
    let matchToday = true;
    if (todayOnly) {
      const today = new Date().toLocaleDateString();
      const rDate = r.created_date ? new Date(r.created_date).toLocaleDateString() : '';
      const eDate = r.estimated_date ? new Date(r.estimated_date).toLocaleDateString() : '';
      matchToday = (rDate === today || eDate === today);
    }

    
    return matchSearch && matchStatus && matchToday;
  });


  const columns = [
    { header: "Ticket", render: r => <span className="text-sm font-mono font-medium text-primary">{r.ticket_number || '-'}</span> },
    { header: "Client", render: r => (
      <div>
        <p className="text-sm font-medium">{r.client_name}</p>
        <p className="text-xs text-muted-foreground">{r.client_phone}</p>
      </div>
    )},
    { header: "Appareil", render: r => (
      <div>
        <p className="text-sm">{r.device_brand} {r.device_model}</p>
        <p className="text-xs text-muted-foreground uppercase">{r.device_type}</p>
      </div>
    )},
    { header: "Statut", render: r => <StatusBadge status={r.status} /> },
    { header: "Global", render: r => <span className="text-sm font-medium">{formatCurrency(r.final_cost || r.estimated_cost || 0)}</span> },
    { header: "Payé", render: r => {
      const totalPaid = (r.deposit || 0) + safeArray(r.payments).reduce((s, p) => s + (p.amount || 0), 0);
      return <span className="text-sm text-emerald-600 font-medium">{formatCurrency(totalPaid)}</span>
    }},
    { header: "Reste", render: r => {
      const price = r.final_cost || r.estimated_cost || 0;
      const totalPaid = (r.deposit || 0) + safeArray(r.payments).reduce((s, p) => s + (p.amount || 0), 0);
      const remaining = Math.max(0, price - totalPaid);
      return <span className={cn("text-sm font-bold", remaining > 0 ? "text-destructive" : "text-emerald-500")}>
        {remaining > 0 ? formatCurrency(remaining) : "Payé"}
      </span>
    }},

    { header: "Date", render: r => (
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy') : '-'}</span>
        {r.estimated_date && !r.completed_date && <span className="text-[10px] text-amber-500 font-bold">Prévu : {format(new Date(r.estimated_date), 'dd/MM')}</span>}
        {r.completed_date && <span className="text-[10px] text-emerald-500 font-medium">Terminé : {format(new Date(r.completed_date), 'dd/MM')}</span>}
      </div>
    )},

    { header: "Caisse", render: r => (
      <Button
        variant="ghost" size="icon" className="h-7 w-7 text-primary"
        onClick={e => { e.stopPropagation(); openTab('POS'); }}
      >
        <ShoppingCart className="h-3.5 w-3.5" />
      </Button>
    )},
  ];


  const stats = repairs.reduce((acc, r) => {
    const price = r.final_cost || r.estimated_cost || 0;
    const payments = safeArray(r.payments);
    const totalPaid = (r.deposit || 0) + payments.reduce((s, p) => s + (p.amount || 0), 0);
    const remaining = Math.max(0, price - totalPaid);
    
    acc.totalGlobal += price;
    acc.totalRemaining += remaining;
    
    // Check payments for today
    const today = new Date().toLocaleDateString();
    
    // Add deposit if it was paid today (created_date is today)
    const creatDate = r.created_date ? new Date(r.created_date).toLocaleDateString() : '';
    if (creatDate === today && r.deposit > 0) acc.paidToday += (r.deposit || 0);

    payments.forEach(p => {
      const pDate = p.date ? new Date(p.date).toLocaleDateString() : '';
      if (pDate === today) acc.paidToday += (p.amount || 0);
    });

    return acc;
  }, { totalGlobal: 0, totalRemaining: 0, paidToday: 0 });


  return (
    <div className="space-y-6">
      <PageHeader title="Atelier Réparation" subtitle={`${repairs.length} réparations`}>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouvelle réparation</Button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Reçu aujourd'hui</span>
          <span className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.paidToday)}</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-sm border-l-destructive/30">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Dettes clients (reste à encaisser)</span>
          <span className="text-2xl font-bold text-destructive">{formatCurrency(stats.totalRemaining)}</span>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Chiffre d'affaires global</span>
          <span className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalGlobal)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button 
          variant={todayOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setTodayOnly(!todayOnly)}
          className={cn("gap-2", todayOnly && "bg-amber-500 hover:bg-amber-600 border-amber-600")}
        >
          <Clock className="h-4 w-4" />
          À faire aujourd'hui
        </Button>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {repairStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>


      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Wrench} title="Aucune réparation" description="Créez votre première réparation" actionLabel="Créer" onAction={() => setDialogOpen(true)} />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} onRowClick={openEdit} />
      )}

      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? `Réparation ${editing.ticket_number}` : 'Nouvelle réparation'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {editing && (
              <div>
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{repairStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Client *</Label>
              <ClientSelector
                clientName={form.client_name}
                clientPhone={form.client_phone}
                onSelect={(name, phone) => setForm(f => ({ ...f, client_name: name, client_phone: phone }))}
                defaultPassager={false}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Type appareil</Label>
                <EntityRefSelect 
                  entityType="device_type" 
                  value={form.device_type} 
                  onChange={v => setForm({...form, device_type: v, device_brand: '', device_model: ''})} 
                  placeholder="Type d'appareil..." 
                />
              </div>
              <div><Label>Marque</Label>
                <EntityRefSelect entityType="brand" parentFilters={{ device_type: form.device_type }} value={form.device_brand} onChange={v => setForm({...form, device_brand: v, device_model: ''})} placeholder="Marque..." />
              </div>
              <div><Label>Modèle</Label>
                <EntityRefSelect entityType="model" parentFilters={{ device_type: form.device_type, device_brand: form.device_brand }} value={form.device_model} onChange={v => setForm({...form, device_model: v})} placeholder="Modèle..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>IMEI</Label><Input value={form.device_imei} onChange={e => setForm({...form, device_imei: e.target.value})} /></div>
              <div><Label>Mot de passe appareil</Label><Input value={form.device_password} onChange={e => setForm({...form, device_password: e.target.value})} /></div>
            </div>
            <div><Label>Description du problème *</Label><Textarea value={form.issue_description} onChange={e => setForm({...form, issue_description: e.target.value})} /></div>

            <div><Label>Diagnostic</Label><Textarea value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Priorité</Label>
                <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Technicien</Label><Input value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} /></div>

            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Coût estimé ({settings.currency_symbol || 'DT'})</Label><Input type="number" value={form.estimated_cost} onChange={e => setForm({...form, estimated_cost: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Coût final ({settings.currency_symbol || 'DT'})</Label><Input type="number" value={form.final_cost} onChange={e => setForm({...form, final_cost: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Acompte ({settings.currency_symbol || 'DT'})</Label><Input type="number" value={form.deposit} onChange={e => setForm({...form, deposit: parseFloat(e.target.value) || 0})} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><Label>Garantie (jours)</Label><Input type="number" value={form.warranty_days} onChange={e => setForm({...form, warranty_days: parseInt(e.target.value) || 0})} placeholder={settings.default_warranty_repair || '90'} /></div>
              <div><Label>Date d'estimation (Prévu pour)</Label><Input type="date" value={form.estimated_date} onChange={e => setForm({...form, estimated_date: e.target.value})} /></div>
            </div>

            <PartsManager
              parts={form.parts_used || []}
              onChange={parts => setForm(f => ({ ...f, parts_used: parts }))}
            />
            <RepairPayments
              payments={form.payments || []}
              finalCost={form.final_cost || form.estimated_cost || 0}
              onChange={payments => setForm(f => ({ ...f, payments }))}
              repairId={editing?.id || ''}
              repairLabel={editing ? `${editing.client_name} - ${editing.device_brand || ''} ${editing.device_model || ''}`.trim() : ''}
              clientName={form.client_name}
              clientPhone={form.client_phone}
            />
            <div><Label>Notes</Label><Textarea value={form.technician_notes} onChange={e => setForm({...form, technician_notes: e.target.value})} /></div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.client_name || !form.client_phone || !form.issue_description}>
                {editing ? 'Mettre à jour' : 'Créer'}
              </Button>

            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}