import React, { useState, useEffect } from 'react';
import { useAppSettings } from "@/components/settings/SettingsContext";
import { base44 } from '@/api/base44Client';
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
import { Wrench, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ClientSelector from "@/components/ui/ClientSelector";
import PhoneInput from '@/components/ui/PhoneInput';
import PartsManager from "@/components/repairs/PartsManager";
import RepairPayments from "@/components/repairs/RepairPayments";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { format } from 'date-fns';

const deviceTypes = [
  { value: 'smartphone', label: 'Smartphone' },
  { value: 'tablette', label: 'Tablette' },
  { value: 'ordinateur_portable', label: 'PC Portable' },
  { value: 'ordinateur_bureau', label: 'PC Bureau' },
  { value: 'console', label: 'Console' },
  { value: 'autre', label: 'Autre' },
];

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
  device_imei: '', device_password: '', problem_description: '', diagnosis: '', status: 'reception',
  priority: 'normale', technician: '', estimated_cost: 0, final_cost: 0, deposit_amount: 0,
  warranty_days: 90, notes: '', parts_used: [], payments: []
};

export default function Repairs() {
  const { formatCurrency, generateTicketNumber, settings } = useAppSettings();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
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

  const { data: repairs = [], isLoading } = useQuery({ queryKey: ['repairs'], queryFn: () => base44.entities.Repair.list('-created_date') });

  const sendRepairSms = async (repairData, ticketNum) => {
    if (!settings.sms_api_key || !settings.sms_provider || !repairData.client_phone) return;
    const statusLabel = repairStatuses.find(s => s.value === repairData.status)?.label || repairData.status;
    const cost = repairData.final_cost || repairData.estimated_cost || 0;
    const message = `🔧 Ticket ${ticketNum}\nClient: ${repairData.client_name}\nAppareil: ${repairData.device_brand || ''} ${repairData.device_model || ''}\nStatut: ${statusLabel}\nProblème: ${repairData.problem_description}\n${cost > 0 ? `Coût: ${formatCurrency(cost)}\n` : ''}${settings.shop_name || 'TechRepair Pro'} - Merci !`;
    try {
      await base44.functions.invoke('sendSms', {
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
        ? await base44.entities.Repair.update(editing.id, payload)
        : await base44.entities.Repair.create(payload);
      await sendRepairSms(payload, ticketNum);
      return result;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['repairs'] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Repair.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repairs'] }),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      client_name: r.client_name, client_phone: r.client_phone, device_type: r.device_type || 'smartphone',
      device_brand: r.device_brand || '', device_model: r.device_model || '', device_imei: r.device_imei || '',
      device_password: r.device_password || '', problem_description: r.problem_description || '', diagnosis: r.diagnosis || '',
      status: r.status || 'reception', priority: r.priority || 'normale', technician: r.technician || '',
      estimated_cost: r.estimated_cost || 0, final_cost: r.final_cost || 0, deposit_amount: r.deposit_amount || 0,
      warranty_days: r.warranty_days || 90, notes: r.notes || '', ticket_number: r.ticket_number || '',
      parts_used: r.parts_used || [], payments: r.payments || []
    });
    setDialogOpen(true);
  };

  const filtered = repairs.filter(r => {
    const matchSearch = r.client_name?.toLowerCase().includes(search.toLowerCase()) || r.ticket_number?.toLowerCase().includes(search.toLowerCase()) || r.device_brand?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
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
        <p className="text-xs text-muted-foreground">{deviceTypes.find(d => d.value === r.device_type)?.label}</p>
      </div>
    )},
    { header: "Statut", render: r => <StatusBadge status={r.status} /> },
    { header: "Priorité", render: r => <StatusBadge status={r.priority} /> },
    { header: "Pièces", render: r => r.parts_used?.length > 0 ? <span className="text-xs bg-muted px-2 py-1 rounded-full">🔧 {r.parts_used.length}</span> : <span className="text-xs text-muted-foreground">—</span> },
    { header: "Coût", render: r => <span className="text-sm font-medium">{formatCurrency(r.final_cost || r.estimated_cost || 0)}</span> },
    { header: "Date", render: r => <span className="text-xs text-muted-foreground">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy') : '-'}</span> },
    { header: "Caisse", render: r => {
      const price = r.final_cost || r.estimated_cost || 0;
      const totalPaid = (r.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
      const remaining = Math.max(0, price - totalPaid);
      const label = `${r.client_name || ''} - ${r.device_brand || ''} ${r.device_model || ''}`.trim();
      return (
        <Link
          to={`${createPageUrl('POS')}?preload=repair:${r.id}:${encodeURIComponent(label)}:${remaining || price}:${encodeURIComponent(r.client_name || '')}:${encodeURIComponent(r.client_phone || '')}`}
          onClick={e => e.stopPropagation()}
        >
          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary" title="Payer en caisse">
            <ShoppingCart className="h-3.5 w-3.5" />
          </Button>
        </Link>
      );
    }},
    { header: "Actions", render: r => (
      <div onClick={e => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(r.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Atelier Réparation" subtitle={`${repairs.length} réparations`}>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nouvelle réparation</Button>
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
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
                <Select value={form.device_type} onValueChange={v => setForm({...form, device_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{deviceTypes.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Marque</Label><Input value={form.device_brand} onChange={e => setForm({...form, device_brand: e.target.value})} /></div>
              <div><Label>Modèle</Label><Input value={form.device_model} onChange={e => setForm({...form, device_model: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>IMEI</Label><Input value={form.device_imei} onChange={e => setForm({...form, device_imei: e.target.value})} /></div>
              <div><Label>Mot de passe appareil</Label><Input value={form.device_password} onChange={e => setForm({...form, device_password: e.target.value})} /></div>
            </div>
            <div><Label>Description du problème *</Label><Textarea value={form.problem_description} onChange={e => setForm({...form, problem_description: e.target.value})} /></div>
            <div><Label>Diagnostic</Label><Textarea value={form.diagnosis} onChange={e => setForm({...form, diagnosis: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Priorité</Label>
                <Select value={form.priority} onValueChange={v => setForm({...form, priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{priorities.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Technicien</Label><Input value={form.technician} onChange={e => setForm({...form, technician: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Coût estimé ({settings.currency_symbol || 'DT'})</Label><Input type="number" value={form.estimated_cost} onChange={e => setForm({...form, estimated_cost: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Coût final ({settings.currency_symbol || 'DT'})</Label><Input type="number" value={form.final_cost} onChange={e => setForm({...form, final_cost: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Acompte ({settings.currency_symbol || 'DT'})</Label><Input type="number" value={form.deposit_amount} onChange={e => setForm({...form, deposit_amount: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Garantie (jours)</Label><Input type="number" value={form.warranty_days} onChange={e => setForm({...form, warranty_days: parseInt(e.target.value) || 0})} placeholder={settings.default_warranty_repair || '90'} /></div>
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
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.client_name || !form.client_phone || !form.problem_description}>
                {editing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={v => !v && setDeleteTarget(null)}
        title="Supprimer cette réparation ?"
        description="Cette action est irréversible."
        onConfirm={() => { deleteMutation.mutate(deleteTarget); setDeleteTarget(null); }}
      />
    </div>
  );
}