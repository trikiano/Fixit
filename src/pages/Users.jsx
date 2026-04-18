import React, { useState } from 'react';
import { fixit } from '@/api/fixitClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { UsersRound, Plus, UserPlus, Shield, Mail, Lock, User, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

const ALL_MODULES = [
  { id: 'POS', label: 'Caisse POS' },
  { id: 'Dashboard', label: 'Dashboard' },
  { id: 'Clients', label: 'Clients' },
  { id: 'Sales', label: 'Ventes' },
  { id: 'Services', label: 'Services' },
  { id: 'CashRegister', label: 'Caisse' },
  { id: 'Promotions', label: 'Promotions' },
  { id: 'Repairs', label: 'Réparations' },
  { id: 'Warranties', label: 'Garanties' },
  { id: 'Products', label: 'Produits' },
  { id: 'StockMovements', label: 'Stock' },
  { id: 'Suppliers', label: 'Fournisseurs' },
  { id: 'PurchaseOrders', label: 'Commandes' },
  { id: 'SupplierInvoices', label: 'Factures de stock' },
  { id: 'Expenses', label: 'Dépenses' },
  { id: 'AuditLogs', label: 'Audit' },
  { id: 'Notifications', label: 'Notifications' },
];

const ROLES = [
  { value: 'admin', label: 'Administrateur', desc: 'Accès total' },
  { value: 'manager', label: 'Gestionnaire', desc: 'Accès étendu' },
  { value: 'employee', label: 'Employé', desc: 'Accès limité' },
];

export default function Users() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ email: '', full_name: '', password_hash: '', role: 'employee', permissions: [] });
  const qc = useQueryClient();

  const { data: users = [], isLoading } = useQuery({ 
    queryKey: ['users'], 
    queryFn: () => fixit.entities.User.list('-created_date') 
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      // Ensure permissions is a string for the backend if it's an array
      const payload = { ...data, permissions: JSON.stringify(data.permissions) };
      if (editing) {
        // Don't send empty password if editing
        if (!payload.password_hash) delete payload.password_hash;
        return fixit.entities.User.update(editing.id, payload);
      }
      return fixit.entities.User.create(payload);
    },
    onSuccess: () => { 
      qc.invalidateQueries({ queryKey: ['users'] }); 
      closeDialog(); 
    },
  });

  const closeDialog = () => { 
    setDialogOpen(false); 
    setEditing(null); 
    setForm({ email: '', full_name: '', password_hash: '', role: 'employee', permissions: [] }); 
  };

  const openEdit = (u) => {
    setEditing(u);
    let perms = [];
    try {
      perms = typeof u.permissions === 'string' ? JSON.parse(u.permissions || '[]') : (u.permissions || []);
    } catch(e) { perms = []; }

    setForm({ 
      email: u.email, 
      full_name: u.full_name || '', 
      password_hash: '', 
      role: u.role || 'employee', 
      permissions: perms 
    });
    setDialogOpen(true);
  };

  const togglePermission = (modId) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(modId)
        ? f.permissions.filter(p => p !== modId)
        : [...f.permissions, modId]
    }));
  };

  const columns = [
    { header: "Utilisateur", render: r => (
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
          {r.full_name?.[0] || r.email?.[0].toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-sm">{r.full_name || 'Sans nom'}</p>
          <p className="text-xs text-muted-foreground">{r.email}</p>
        </div>
      </div>
    )},
    { header: "Rôle", render: r => (
      <Badge variant={r.role === 'admin' ? "default" : "secondary"} className="capitalize">
        {ROLES.find(re => re.value === r.role)?.label || r.role}
      </Badge>
    )},
    { header: "Modules", render: r => {
      if (r.role === 'admin') return <span className="text-xs text-muted-foreground italic">Accès total</span>;
      let perms = [];
      try { perms = typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : (r.permissions || []); } catch(e) {}
      return <div className="flex flex-wrap gap-1 max-w-[300px]">
        {perms.length === 0 ? <span className="text-xs text-muted-foreground">Aucun accès</span> : perms.map(p => (
          <Badge key={p} variant="outline" className="text-[10px] px-1 py-0 h-4">{ALL_MODULES.find(m => m.id === p)?.label || p}</Badge>
        ))}
      </div>
    }},
    { header: "Statut", render: r => (
      <div className="flex items-center gap-1.5">
        {r.is_active ? (
          <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /><span className="text-xs text-emerald-600 font-medium">Actif</span></>
        ) : (
          <><XCircle className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs text-muted-foreground font-medium">Inactif</span></>
        )}
      </div>
    )},
    { header: "Actions", render: r => (
      <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>Modifier</Button>
    )},
  ];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Utilisateurs" 
        subtitle="Gérez les comptes et les permissions de vos collaborateurs"
      >
        <Button onClick={() => setDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Ajouter utilisateur
        </Button>
      </PageHeader>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {users.length === 0 && !isLoading ? (
          <EmptyState 
            icon={UsersRound} 
            title="Aucun utilisateur additionnel" 
            description="Créez des comptes pour vos employés pour limiter leurs accès."
            actionLabel="Créer un compte"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <DataTable 
            columns={columns} 
            data={users} 
            isLoading={isLoading}
            onRowClick={openEdit}
          />
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {editing ? 'Modifier les accès' : 'Nouvel utilisateur'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            {/* Left Col: Info */}
            <div className="space-y-4 border-r border-border pr-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><User className="h-4 w-4" /> Nom complet</Label>
                <Input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="Ex: Jean Dupont" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email / Identifiant</Label>
                <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="jean@exemple.com" disabled={!!editing} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Lock className="h-4 w-4" /> Mot de passe</Label>
                <Input type="password" value={form.password_hash} onChange={e => setForm({...form, password_hash: e.target.value})} placeholder={editing ? "Laisser vide pour ne pas changer" : "Mot de passe initial"} />
              </div>
              <div className="space-y-2 pt-2">
                <Label>Rôle du compte</Label>
                <Select value={form.role} onValueChange={v => setForm({...form, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>
                        <div className="text-left">
                          <p className="font-medium">{r.label}</p>
                          <p className="text-[10px] text-muted-foreground">{r.desc}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Right Col: Permissions */}
            <div className="space-y-4">
              <Label className="text-base font-bold text-foreground">Autoriser les modules</Label>
              <p className="text-[11px] text-muted-foreground mb-4">Cochez les modules auxquels cet utilisateur peut accéder.</p>
              
              {form.role === 'admin' ? (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex flex-col items-center justify-center text-center space-y-2">
                  <Shield className="h-10 w-10 text-primary" />
                  <p className="text-sm font-bold text-primary">Accès Administrateur</p>
                  <p className="text-xs text-muted-foreground">Les administrateurs ont accès à tous les modules par défaut.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                  {ALL_MODULES.map(mod => (
                    <div 
                      key={mod.id} 
                      onClick={() => togglePermission(mod.id)}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg border border-border cursor-pointer transition-colors",
                        form.permissions.includes(mod.id) ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                      )}
                    >
                      <Checkbox checked={form.permissions.includes(mod.id)} onCheckedChange={() => togglePermission(mod.id)} />
                      <span className="text-xs font-medium">{mod.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button variant="outline" onClick={closeDialog}>Annuler</Button>
            <Button 
              onClick={() => saveMutation.mutate(form)} 
              disabled={!form.email || (!editing && !form.password_hash) || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer l\'utilisateur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
