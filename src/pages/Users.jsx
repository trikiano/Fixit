import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/ui/PageHeader";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Users as UsersIcon, Plus, Pencil, Trash2, ShieldCheck, UserCheck, User } from 'lucide-react';
import { format } from 'date-fns';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const ROLE_META = {
  superadmin: { label: 'Super Admin', cls: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-700', icon: ShieldCheck },
  responsable: { label: 'Responsable', cls: 'bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-700', icon: UserCheck },
  vendeur:     { label: 'Vendeur',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-700', icon: User },
};

const emptyForm = { name: '', email: '', password: '', role: 'vendeur' };

export default function Users() {
  const { isSuperAdmin, user: currentUser } = useAuth();
  const qc = useQueryClient();

  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.auth.users.list(),
  });

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editing) {
        const payload = { name: data.name, role: data.role };
        if (data.password) payload.password = data.password;
        return base44.auth.users.update(editing.id, payload);
      }
      return base44.auth.users.create(data);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); closeDialog(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.auth.users.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeleteTarget(null); },
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (u) => { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setDialogOpen(true); };

  const handleSave = () => {
    if (!form.name || !form.email) return;
    if (!editing && !form.password) return;
    saveMutation.mutate(form);
  };

  return (
    <div>
      <PageHeader title="Utilisateurs" subtitle={`${users.length} compte(s)`}>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nouvel utilisateur</Button>
      </PageHeader>

      {isLoading ? (
        <div className="text-sm text-muted-foreground text-center py-12">Chargement...</div>
      ) : (
        <div className="space-y-2">
          {users.map(u => {
            const meta = ROLE_META[u.role] || ROLE_META.vendeur;
            const Icon = meta.icon;
            const isSelf = u.id === currentUser?.id;
            return (
              <div key={u.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card">
                <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  {u.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{u.name}</p>
                    {isSelf && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">Vous</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border", meta.cls)}>
                  <Icon className="h-3 w-3" />{meta.label}
                </span>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {u.created_date ? format(new Date(u.created_date), 'dd/MM/yyyy') : '—'}
                </p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70 hover:text-destructive" disabled={isSelf} onClick={() => setDeleteTarget(u)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog créer / modifier */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Modifier — ${editing.name}` : 'Nouvel utilisateur'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <Label>Nom complet</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Prénom Nom" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@boutique.com" disabled={!!editing} />
              {editing && <p className="text-xs text-muted-foreground mt-1">L'email ne peut pas être modifié.</p>}
            </div>
            <div>
              <Label>{editing ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe'}</Label>
              <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" />
            </div>
            <div>
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendeur">Vendeur — Caisse, clients, réparations</SelectItem>
                  <SelectItem value="responsable">Responsable — + Finance, stock, achats</SelectItem>
                  <SelectItem value="superadmin">Super Admin — Accès total</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={closeDialog}>Annuler</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending || !form.name || !form.email || (!editing && !form.password)}>
                {saveMutation.isPending ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer le compte'}
              </Button>
            </div>
            {saveMutation.isError && (
              <p className="text-xs text-destructive">{saveMutation.error?.message || 'Erreur'}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Supprimer cet utilisateur ?"
        description={`Le compte de ${deleteTarget?.name} (${deleteTarget?.email}) sera définitivement supprimé.`}
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
