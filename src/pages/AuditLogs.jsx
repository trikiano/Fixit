import React, { useState } from 'react';
import { fixit } from '@/api/fixitClient';
import { useQuery } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { ScrollText, Search } from 'lucide-react';
import { format } from 'date-fns';

const actionColors = {
  creation: "bg-emerald-500/10 text-emerald-400",
  modification: "bg-blue-500/10 text-blue-400",
  suppression: "bg-red-500/10 text-red-400",
  validation: "bg-green-500/10 text-green-400",
  annulation: "bg-orange-500/10 text-orange-400",
  export: "bg-purple-500/10 text-purple-400",
  connexion: "bg-cyan-500/10 text-cyan-400",
};

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const { data: logs = [], isLoading } = useQuery({ queryKey: ['auditLogs'], queryFn: () => fixit.entities.AuditLog.list('-created_date', 200) });

  const filtered = logs.filter(l => {
    const ms = l.entity_label?.toLowerCase().includes(search.toLowerCase()) || l.user_name?.toLowerCase().includes(search.toLowerCase()) || l.details?.toLowerCase().includes(search.toLowerCase());
    const ma = actionFilter === 'all' || l.action === actionFilter;
    return ms && ma;
  });

  const columns = [
    { header: "Action", render: r => <Badge variant="outline" className={`text-xs ${actionColors[r.action] || ''}`}>{r.action}</Badge> },
    { header: "Entité", render: r => (
      <div>
        <p className="text-sm font-medium">{r.entity_type}</p>
        <p className="text-xs text-muted-foreground">{r.entity_label}</p>
      </div>
    )},
    { header: "Détails", render: r => <span className="text-xs text-muted-foreground max-w-xs truncate block">{r.details || '-'}</span> },
    { header: "Utilisateur", render: r => <span className="text-sm">{r.user_name || r.user_email || '-'}</span> },
    { header: "Date", render: r => <span className="text-xs text-muted-foreground">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy HH:mm:ss') : '-'}</span> },
  ];

  return (
    <div>
      <PageHeader title="Journal d'Audit" subtitle={`${logs.length} entrées`} />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes actions</SelectItem>
            <SelectItem value="creation">Création</SelectItem>
            <SelectItem value="modification">Modification</SelectItem>
            <SelectItem value="suppression">Suppression</SelectItem>
            <SelectItem value="validation">Validation</SelectItem>
            <SelectItem value="annulation">Annulation</SelectItem>
            <SelectItem value="export">Export</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={ScrollText} title="Aucun log" description="Les actions seront enregistrées ici automatiquement" />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} />
      )}
    </div>
  );
}