import React, { useState } from 'react';
import { fixit } from '@/api/fixitClient';
import { useQuery } from '@tanstack/react-query';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/ui/PageHeader";
import DataTable from "@/components/ui/DataTable";
import EmptyState from "@/components/ui/EmptyState";
import { Bell, Search, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { format } from 'date-fns';

const typeIcons = { email: Mail, sms: Smartphone, whatsapp: MessageCircle, interne: Bell };
const statusColors = {
  envoye: "bg-emerald-500/10 text-emerald-400",
  echoue: "bg-red-500/10 text-red-400",
  en_attente: "bg-amber-500/10 text-amber-400",
};

export default function Notifications() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: notifs = [], isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => fixit.entities.Notification.list('-created_date', 200) });


  const filtered = notifs.filter(n => {
    const ms = n.recipient_name?.toLowerCase().includes(search.toLowerCase()) || n.subject?.toLowerCase().includes(search.toLowerCase()) || n.recipient?.includes(search);
    const mt = typeFilter === 'all' || n.type === typeFilter;
    return ms && mt;
  });

  const columns = [
    { header: "Type", render: r => {
      const Icon = typeIcons[r.type] || Bell;
      return <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-xs capitalize">{r.type}</span></div>;
    }},
    { header: "Destinataire", render: r => (
      <div>
        <p className="text-sm font-medium">{r.recipient_name || '-'}</p>
        <p className="text-xs text-muted-foreground">{r.recipient}</p>
      </div>
    )},
    { header: "Sujet", render: r => <span className="text-sm">{r.subject || '-'}</span> },
    { header: "Message", render: r => <span className="text-xs text-muted-foreground truncate max-w-xs block">{r.message?.substring(0, 80) || '-'}</span> },
    { header: "Statut", render: r => <Badge variant="outline" className={`text-xs ${statusColors[r.status] || ''}`}>{r.status === 'envoye' ? 'Envoyé' : r.status === 'echoue' ? 'Échoué' : 'En attente'}</Badge> },
    { header: "Date", render: r => <span className="text-xs text-muted-foreground">{r.created_date ? format(new Date(r.created_date), 'dd/MM/yyyy HH:mm') : '-'}</span> },
  ];

  return (
    <div>
      <PageHeader title="Notifications" subtitle={`${notifs.length} notifications`} />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="interne">Interne</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={Bell} title="Aucune notification" description="Les notifications envoyées apparaîtront ici" />
      ) : (
        <DataTable columns={columns} data={filtered} isLoading={isLoading} />
      )}
    </div>
  );
}