import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Plus, Trash2, Tag } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fixit } from '@/api/fixitClient';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const emptyService = { name: '', category_id: '', category_name: '', cost_price: '', sell_price: '', description: '' };
const emptyCategory = { name: '', color: 'blue' };
const colors = ['blue', 'green', 'orange', 'purple', 'red', 'cyan'];

export default function ManageServicesModal({ open, onClose, services, categories }) {
  const qc = useQueryClient();
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showCatForm, setShowCatForm] = useState(false);
  const [serviceForm, setServiceForm] = useState(emptyService);
  const [catForm, setCatForm] = useState(emptyCategory);

  const createServiceMutation = useMutation({
    mutationFn: (data) => fixit.entities.ServiceItem.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-items'] }); setShowServiceForm(false); setServiceForm(emptyService); },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: (id) => fixit.entities.ServiceItem.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-items'] }),
  });

  const createCatMutation = useMutation({
    mutationFn: (data) => fixit.entities.ServiceCategory.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['service-categories'] }); setShowCatForm(false); setCatForm(emptyCategory); },
  });

  const deleteCatMutation = useMutation({
    mutationFn: (id) => fixit.entities.ServiceCategory.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['service-categories'] }),
  });

  const handleCreateService = () => {
    if (!serviceForm.name || !serviceForm.sell_price || !serviceForm.cost_price) return;
    const cat = categories.find(c => c.id === serviceForm.category_id);
    createServiceMutation.mutate({
      ...serviceForm,
      category_name: cat?.name || '',
      cost_price: parseFloat(serviceForm.cost_price) || 0,
      sell_price: parseFloat(serviceForm.sell_price) || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Paramétrage des services
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="services">
          <TabsList className="w-full">
            <TabsTrigger value="services" className="flex-1">Services</TabsTrigger>
            <TabsTrigger value="categories" className="flex-1">Catégories</TabsTrigger>
          </TabsList>

          {/* Services */}
          <TabsContent value="services" className="space-y-3 mt-3">
            {services.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <div>
                  <p className="font-semibold text-sm">{s.name}</p>
                  {s.category_name && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{s.category_name}</span>}
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Coût: {(s.cost_price || 0).toFixed(2)} | Vente: <span className="text-green-600 font-semibold">{(s.sell_price || 0).toFixed(2)}</span></p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => { if (window.confirm('Supprimer ce service ?')) deleteServiceMutation.mutate(s.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {services.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Aucun service configuré</p>}

            {!showServiceForm ? (
              <Button variant="outline" className="w-full gap-2" onClick={() => setShowServiceForm(true)}>
                <Plus className="h-4 w-4" />Ajouter un service
              </Button>
            ) : (
              <div className="border border-border/50 rounded-lg p-4 space-y-3">
                <p className="font-semibold text-sm">Nouveau service</p>
                <div>
                  <Label>Nom du service *</Label>
                  <Input className="mt-1" placeholder="Forfait 10GB Ooredoo..." value={serviceForm.name} onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <Select value={serviceForm.category_id} onValueChange={v => setServiceForm(f => ({ ...f, category_id: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Prix coûtant *</Label>
                    <Input className="mt-1" type="number" placeholder="0.00" value={serviceForm.cost_price} onChange={e => setServiceForm(f => ({ ...f, cost_price: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Prix vente *</Label>
                    <Input className="mt-1" type="number" placeholder="0.00" value={serviceForm.sell_price} onChange={e => setServiceForm(f => ({ ...f, sell_price: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input className="mt-1" placeholder="Optionnel..." value={serviceForm.description} onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowServiceForm(false)}>Annuler</Button>
                  <Button className="flex-1" onClick={handleCreateService} disabled={!serviceForm.name || !serviceForm.sell_price || !serviceForm.cost_price}>Créer</Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Catégories */}
          <TabsContent value="categories" className="space-y-3 mt-3">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  <p className="font-semibold text-sm">{c.name}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => { if (window.confirm('Supprimer cette catégorie ?')) deleteCatMutation.mutate(c.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {categories.length === 0 && <p className="text-center text-muted-foreground py-4 text-sm">Aucune catégorie</p>}

            {!showCatForm ? (
              <Button variant="outline" className="w-full gap-2" onClick={() => setShowCatForm(true)}>
                <Plus className="h-4 w-4" />Ajouter une catégorie
              </Button>
            ) : (
              <div className="border border-border/50 rounded-lg p-4 space-y-3">
                <p className="font-semibold text-sm">Nouvelle catégorie</p>
                <div>
                  <Label>Nom *</Label>
                  <Input className="mt-1" placeholder="Forfait Internet, Solde, Visa..." value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCatForm(false)}>Annuler</Button>
                  <Button className="flex-1" onClick={() => createCatMutation.mutate(catForm)} disabled={!catForm.name}>Créer</Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}