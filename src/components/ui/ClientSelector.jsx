import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { User, Plus, Search, Phone, X } from 'lucide-react';
import { toast } from "@/components/ui/use-toast";

/**
 * ClientSelector — Composant réutilisable pour sélectionner ou créer un client
 * Props:
 *   clientName, clientPhone — valeurs actuelles
 *   onSelect(name, phone) — callback quand un client est sélectionné/saisi
 *   required — booléen
 *   defaultPassager — si true, "Client passager" est sélectionné par défaut
 */
export default function ClientSelector({ clientName, clientPhone, onSelect, required = false, defaultPassager = true }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState(clientName && clientName !== 'Client passager' ? clientName : '');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const wrapperRef = useRef(null);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date', 500),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create(data),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      onSelect(created.full_name, created.phone);
      setQuery(created.full_name);
      setShowCreate(false);
      setNewName('');
      setNewPhone('');
    },
  });

  // Filtre clients
  const filtered = query.length >= 1
    ? clients.filter(c =>
        c.full_name?.toLowerCase().includes(query.toLowerCase()) ||
        c.phone?.includes(query)
      ).slice(0, 8)
    : clients.slice(0, 8);

  // Fermer le dropdown si clic dehors
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectClient = (client) => {
    onSelect(client.full_name, client.phone);
    setQuery(client.full_name);
    setShowDropdown(false);
  };

  const selectPassager = () => {
    onSelect('Client passager', '');
    setQuery('');
    setShowDropdown(false);
  };

  const handleQueryChange = (val) => {
    setQuery(val);
    onSelect(val, val === '' ? '' : clientPhone);
    setShowDropdown(true);
  };

  const handleCreate = async () => {
    if (!newName || !newPhone) return;
    setSaving(true);
    try {
      await createMutation.mutateAsync({ full_name: newName, phone: newPhone });
    } catch (err) {
      toast({ title: "Erreur", description: "Le client n'a pas pu être créé. Réessayez.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isPassager = !clientName || clientName === 'Client passager';

  return (
    <div className="space-y-2">
      <div ref={wrapperRef} className="relative">
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              placeholder={isPassager ? "Client passager (par défaut)" : "Rechercher client..."}
              className="pl-8 pr-8"
            />
            {query && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => { setQuery(''); if (defaultPassager) selectPassager(); else onSelect('', ''); }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => { setNewName(query); setShowCreate(true); setShowDropdown(false); }}
            title="Créer un nouveau client"
            className="flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Dropdown suggestions */}
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
            {/* Client passager en haut */}
            <button
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors border-b border-border/50 ${isPassager ? 'bg-muted/30' : ''}`}
              onClick={selectPassager}
            >
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="text-left">
                <p className="font-medium text-muted-foreground">Client passager</p>
                <p className="text-xs text-muted-foreground">Client anonyme</p>
              </div>
              {isPassager && <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Sélectionné</span>}
            </button>

            {/* Liste clients */}
            {filtered.length > 0 ? (
              <div className="max-h-52 overflow-y-auto">
                {filtered.map(c => (
                  <button
                    key={c.id}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors"
                    onClick={() => selectClient(c)}
                  >
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{c.full_name?.charAt(0)?.toUpperCase()}</span>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="font-medium truncate">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" />{c.phone}
                      </p>
                    </div>
                    {c.segment && <span className="text-xs text-muted-foreground capitalize">{c.segment}</span>}
                  </button>
                ))}
              </div>
            ) : query.length > 0 ? (
              <div className="px-3 py-3 text-center">
                <p className="text-xs text-muted-foreground mb-2">Aucun client trouvé pour "{query}"</p>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => { setNewName(query); setShowCreate(true); setShowDropdown(false); }}>
                  <Plus className="h-3 w-3 mr-1" />Créer "{query}"
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Affichage téléphone si client sélectionné */}
      {clientPhone && clientPhone !== '' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-1.5">
          <Phone className="h-3 w-3" />
          <span className="font-medium">{clientPhone}</span>
          <span className="text-muted-foreground">— {clientName}</span>
        </div>
      )}

      {/* Modal création rapide */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Nouveau client
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Nom complet *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Prénom Nom" autoFocus />
            </div>
            <div>
              <Label>Téléphone *</Label>
              <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="06 xx xx xx xx" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={saving || !newName || !newPhone}>
                {saving ? 'Création...' : 'Créer et sélectionner'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}