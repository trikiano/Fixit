import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/components/ui/PageHeader";
import { ShoppingBag, Plus, Search, CreditCard, Settings, TrendingUp, Wallet, Trash2, ArrowDownCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import NewServiceSaleModal from "@/components/services/NewServiceSaleModal";
import CardTopupModal from "@/components/services/CardTopupModal";
import ManageCardsModal from "@/components/services/ManageCardsModal";
import ManageServicesModal from "@/components/services/ManageServicesModal";
import { useAppSettings } from "@/components/settings/SettingsContext";

const paymentLabel = { especes: 'Espèces', carte: 'Carte', virement: 'Virement', credit_client: 'Crédit' };
const paymentColor = { especes: 'bg-green-500/10 text-green-700', carte: 'bg-blue-500/10 text-blue-700', virement: 'bg-purple-500/10 text-purple-700', credit_client: 'bg-orange-500/10 text-orange-700' };

export default function ServicesPage() {
  const qc = useQueryClient();
  const [showNewSale, setShowNewSale] = useState(false);
  const [showTopup, setShowTopup] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCard, setFilterCard] = useState('tous');
  const [filterCat, setFilterCat] = useState('tous');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState('ventes');

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['service-sales'],
    queryFn: () => base44.entities.ServiceSale.list('-created_date', 500),
  });

  const { data: cards = [] } = useQuery({
    queryKey: ['prepaid-cards'],
    queryFn: () => base44.entities.PrepaidCard.list('-created_date', 100),
  });

  const { data: services = [] } = useQuery({
    queryKey: ['service-items'],
    queryFn: () => base44.entities.ServiceItem.list('-created_date', 200),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['service-categories'],
    queryFn: () => base44.entities.ServiceCategory.list('-created_date', 100),
  });

  const { data: topups = [] } = useQuery({
    queryKey: ['card-topups'],
    queryFn: () => base44.entities.CardTopup.list('-created_date', 500),
  });

  // Vendre un service : crée la vente + débite la carte
  const createSaleMutation = useMutation({
    mutationFn: async (data) => {
      const sale = await base44.entities.ServiceSale.create(data);
      // Débiter la carte
      const card = cards.find(c => c.id === data.card_id);
      if (card) {
        const newBalance = (card.current_balance || 0) - (data.cost_price || 0);
        const newSpent = (card.total_spent || 0) + (data.cost_price || 0);
        await base44.entities.PrepaidCard.update(data.card_id, {
          current_balance: Math.max(0, newBalance),
          total_spent: newSpent,
        });
      }
      return sale;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-sales'] });
      qc.invalidateQueries({ queryKey: ['prepaid-cards'] });
    },
  });

  // Recharger une carte : crée un topup + met à jour le solde
  const topupMutation = useMutation({
    mutationFn: async (data) => {
      const topup = await base44.entities.CardTopup.create(data);
      const card = cards.find(c => c.id === data.card_id);
      if (card) {
        await base44.entities.PrepaidCard.update(data.card_id, {
          current_balance: (card.current_balance || 0) + data.amount,
          total_loaded: (card.total_loaded || 0) + data.amount,
        });
      }
      return topup;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prepaid-cards'] });
      qc.invalidateQueries({ queryKey: ['card-topups'] });
    },
  });

  const deleteSaleMutation = useMutation({
    mutationFn: async (sale) => {
      await base44.entities.ServiceSale.delete(sale.id);
      // Rembourser le solde de la carte
      const card = cards.find(c => c.id === sale.card_id);
      if (card) {
        await base44.entities.PrepaidCard.update(sale.card_id, {
          current_balance: (card.current_balance || 0) + (sale.cost_price || 0),
          total_spent: Math.max(0, (card.total_spent || 0) - (sale.cost_price || 0)),
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-sales'] });
      qc.invalidateQueries({ queryKey: ['prepaid-cards'] });
    },
  });

  // Stats globales
  const totalRevenue = sales.reduce((s, x) => s + (x.sell_price || 0), 0);
  const totalCost = sales.reduce((s, x) => s + (x.cost_price || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const totalCardBalance = cards.reduce((s, c) => s + (c.current_balance || 0), 0);

  const filtered = useMemo(() => {
    return sales.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !q || s.client_name?.toLowerCase().includes(q) || s.client_phone?.includes(q) || s.service_name?.toLowerCase().includes(q);
      const matchCard = filterCard === 'tous' || s.card_id === filterCard;
      const matchCat = filterCat === 'tous' || s.category_id === filterCat;
      const d = new Date(s.sale_date || s.created_date);
      const matchFrom = !dateFrom || d >= new Date(dateFrom);
      const matchTo = !dateTo || d <= new Date(dateTo + 'T23:59:59');
      return matchSearch && matchCard && matchCat && matchFrom && matchTo;
    });
  }, [sales, search, filterCard, filterCat, dateFrom, dateTo]);

  const tabs = [
    { id: 'ventes', label: 'Ventes' },
    { id: 'cartes', label: 'Cartes & Soldes' },
    { id: 'recharges', label: 'Historique recharges' },
  ];

  return (
    <div>
      <PageHeader title="Achat de Services" subtitle="Ventes de services, cartes prépayées et marges">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowServices(true)}>
          <Settings className="h-4 w-4" />Services
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowCards(true)}>
          <CreditCard className="h-4 w-4" />Cartes
        </Button>
        <Button onClick={() => setShowTopup(true)} className="gap-2 bg-green-600 hover:bg-green-700 text-white" size="sm">
          <RefreshCw className="h-4 w-4" />Recharger carte
        </Button>
        <Button onClick={() => setShowNewSale(true)} className="gap-2">
          <Plus className="h-4 w-4" />Nouvelle vente
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><ShoppingBag className="h-4 w-4 text-primary" /></div>
            <div><p className="text-xl font-bold">{sales.length}</p><p className="text-xs text-muted-foreground">Ventes totales</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-green-600" /></div>
            <div><p className="text-xl font-bold text-green-600">{totalRevenue.toFixed(0)}</p><p className="text-xs text-muted-foreground">Total encaissé</p></div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center"><Wallet className="h-4 w-4 text-blue-600" /></div>
            <div><p className="text-xl font-bold text-blue-600">{totalProfit.toFixed(0)}</p><p className="text-xs text-muted-foreground">Bénéfice total</p></div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center"><CreditCard className="h-4 w-4 text-orange-500" /></div>
            <div><p className="text-xl font-bold text-orange-500">{totalCardBalance.toFixed(0)}</p><p className="text-xs text-muted-foreground">Solde total cartes</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-muted/30 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: CARTES & SOLDES */}
      {activeTab === 'cartes' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(card => {
            const cardSales = sales.filter(s => s.card_id === card.id);
            const cardTopups = topups.filter(t => t.card_id === card.id);
            const totalSpent = cardSales.reduce((s, x) => s + (x.cost_price || 0), 0);
            const totalLoaded = cardTopups.reduce((s, t) => s + (t.amount || 0), 0);
            return (
              <Card key={card.id} className={`border-2 ${(card.current_balance || 0) < 500 ? 'border-orange-500/30 bg-orange-500/5' : 'border-green-500/20'}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold">{card.name}</p>
                      {card.card_number && <p className="text-xs font-mono text-muted-foreground">{card.card_number}</p>}
                      {card.provider && <p className="text-xs text-muted-foreground">{card.provider}</p>}
                    </div>
                    <Badge variant="outline" className={`${(card.current_balance || 0) < 500 ? 'text-orange-500 border-orange-500/50' : 'text-green-600 border-green-500/50'}`}>
                      {(card.current_balance || 0).toFixed(0)} {card.currency || 'DZD'}
                    </Badge>
                  </div>
                  <Separator className="mb-3" />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><ArrowDownCircle className="h-3 w-3 text-green-500" />Total rechargé</span>
                      <span className="font-semibold text-green-600">+{totalLoaded.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1"><ArrowUpCircle className="h-3 w-3 text-red-500" />Total dépensé</span>
                      <span className="font-semibold text-red-500">-{totalSpent.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{cardSales.length} vente(s)</span>
                      <span className="font-semibold">{cardSales.reduce((s, x) => s + (x.sell_price || 0) - (x.cost_price || 0), 0).toFixed(0)} bénéfice</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="w-full mt-3 gap-2 text-green-700 border-green-500/50 hover:bg-green-500/10" onClick={() => setShowTopup(true)}>
                    <RefreshCw className="h-3 w-3" />Recharger
                  </Button>
                </CardContent>
              </Card>
            );
          })}
          {cards.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Aucune carte prépayée configurée</p>
              <Button className="mt-4" onClick={() => setShowCards(true)}><Plus className="h-4 w-4 mr-2" />Ajouter une carte</Button>
            </div>
          )}
        </div>
      )}

      {/* TAB: RECHARGES */}
      {activeTab === 'recharges' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-green-600" />
              Historique des recharges
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topups.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <RefreshCw className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Aucune recharge enregistrée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                      <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Carte</th>
                      <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Montant</th>
                      <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topups.map(t => (
                      <tr key={t.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                          {t.date ? format(new Date(t.date), 'dd/MM/yy HH:mm') : format(new Date(t.created_date), 'dd/MM/yy HH:mm')}
                        </td>
                        <td className="p-3 font-medium">{t.card_name}</td>
                        <td className="p-3 text-right font-bold text-green-600 text-base">+{(t.amount || 0).toFixed(2)}</td>
                        <td className="p-3 text-xs text-muted-foreground">{t.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB: VENTES */}
      {activeTab === 'ventes' && (
        <>
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Rechercher client, service..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={filterCard} onValueChange={setFilterCard}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Carte" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Toutes les cartes</SelectItem>
                    {cards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterCat} onValueChange={setFilterCat}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Toutes catégories</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="date" className="w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <Input type="date" className="w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-muted-foreground">{filtered.length} vente(s)</CardTitle>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600 font-semibold">Encaissé: {filtered.reduce((s, x) => s + (x.sell_price || 0), 0).toFixed(0)}</span>
                  <span className="text-blue-600 font-semibold">Bénéfice: {filtered.reduce((s, x) => s + (x.sell_price || 0) - (x.cost_price || 0), 0).toFixed(0)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Chargement...</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <ShoppingBag className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Aucune vente trouvée</p>
                  <Button className="mt-4" onClick={() => setShowNewSale(true)}><Plus className="h-4 w-4 mr-2" />Première vente</Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service</th>
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Carte</th>
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paiement</th>
                        <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Coût</th>
                        <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vente</th>
                        <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bénéfice</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(s => {
                        const profit = (s.sell_price || 0) - (s.cost_price || 0);
                        return (
                          <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                            <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                              {format(new Date(s.sale_date || s.created_date), 'dd/MM/yy HH:mm')}
                            </td>
                            <td className="p-3">
                              <p className="font-medium">{s.client_name}</p>
                              <p className="text-xs text-muted-foreground">{s.client_phone}</p>
                            </td>
                            <td className="p-3">
                              <p className="font-medium">{s.service_name}</p>
                              {s.category_name && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{s.category_name}</span>}
                              {s.activation_code && <p className="text-xs text-muted-foreground mt-0.5">Réf: {s.activation_code}</p>}
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">{s.card_name || '—'}</td>
                            <td className="p-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paymentColor[s.payment_method] || ''}`}>
                                {paymentLabel[s.payment_method] || s.payment_method}
                              </span>
                            </td>
                            <td className="p-3 text-right text-muted-foreground">{(s.cost_price || 0).toFixed(2)}</td>
                            <td className="p-3 text-right font-bold text-green-600">{(s.sell_price || 0).toFixed(2)}</td>
                            <td className="p-3 text-right font-semibold text-blue-600">{profit.toFixed(2)}</td>
                            <td className="p-3">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => { if (window.confirm('Supprimer cette vente ? Le solde de la carte sera rétabli.')) deleteSaleMutation.mutate(s); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <NewServiceSaleModal open={showNewSale} onClose={() => setShowNewSale(false)} services={services} cards={cards} onSave={createSaleMutation.mutateAsync} />
      <CardTopupModal open={showTopup} onClose={() => setShowTopup(false)} cards={cards} onSave={topupMutation.mutateAsync} />
      <ManageCardsModal open={showCards} onClose={() => setShowCards(false)} cards={cards} />
      <ManageServicesModal open={showServices} onClose={() => setShowServices(false)} services={services} categories={categories} />
    </div>
  );
}