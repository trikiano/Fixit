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
import { Wifi, Plus, Search, FileText, TrendingUp, Users, DollarSign, Trash2, HandCoins, Wallet, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import NewSaleModal from "@/components/internet/NewSaleModal";
import AccountReportModal from "@/components/internet/AccountReportModal";
import SupplierPaymentModal from "@/components/internet/SupplierPaymentModal";

const ACCOUNTS = ['Compte Principal', 'Compte 2', 'Application A', 'Application B'];

const paymentLabel = { especes: 'Espèces', carte: 'Carte', virement: 'Virement', credit_client: 'Crédit' };
const paymentColor = { especes: 'bg-green-500/10 text-green-400', carte: 'bg-blue-500/10 text-blue-400', virement: 'bg-purple-500/10 text-purple-400', credit_client: 'bg-orange-500/10 text-orange-400' };
const statusColor = { vendu: 'bg-blue-500/10 text-blue-400', active: 'bg-green-500/10 text-green-400', expire: 'bg-gray-500/10 text-gray-400', annule: 'bg-red-500/10 text-red-400' };
const statusLabel = { vendu: 'Vendu', active: 'Actif', expire: 'Expiré', annule: 'Annulé' };

export default function InternetSalesPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [search, setSearch] = useState('');
  const [filterAccount, setFilterAccount] = useState('tous');
  const [filterPayment, setFilterPayment] = useState('tous');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportAccount, setReportAccount] = useState('');
  const [activeTab, setActiveTab] = useState('ventes'); // 'ventes' | 'caisse' | 'paiements'

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['internet-sales'],
    queryFn: () => base44.entities.InternetSale.list('-created_date', 500),
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['internet-packages'],
    queryFn: () => base44.entities.InternetPackage.list('-created_date', 100),
  });

  const { data: supplierPayments = [] } = useQuery({
    queryKey: ['supplier-payments'],
    queryFn: () => base44.entities.SupplierPayment.list('-created_date', 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.InternetSale.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['internet-sales'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.InternetSale.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['internet-sales'] }),
  });

  const paymentMutation = useMutation({
    mutationFn: (data) => base44.entities.SupplierPayment.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-payments'] }),
  });

  // Calculs globaux par compte : total vendu vs total payé au fournisseur
  const accountStats = useMemo(() => {
    const stats = {};
    sales.forEach(s => {
      const key = s.account_used || 'Non spécifié';
      if (!stats[key]) stats[key] = { count: 0, revenue: 0, paid: 0 };
      stats[key].count++;
      stats[key].revenue += s.sell_price || 0;
    });
    supplierPayments.forEach(p => {
      const key = p.account_name;
      if (!stats[key]) stats[key] = { count: 0, revenue: 0, paid: 0 };
      stats[key].paid += p.amount_given || 0;
    });
    // unpaid = ce qui reste à donner au fournisseur
    Object.keys(stats).forEach(k => {
      stats[k].unpaid = Math.max(0, stats[k].revenue - stats[k].paid);
    });
    return stats;
  }, [sales, supplierPayments]);

  // Total caisse internet = argent que vous avez gardé (votre bénéfice sur chaque vente)
  const totalRevenue = sales.reduce((s, x) => s + (x.sell_price || 0), 0);
  const totalCost = sales.reduce((s, x) => s + (x.cost_price || 0), 0);
  const totalPaidToSupplier = supplierPayments.reduce((s, x) => s + (x.amount_given || 0), 0);
  const totalDueToSupplier = totalRevenue - totalPaidToSupplier; // ce qu'on doit encore donner
  const totalProfit = totalRevenue - totalCost; // votre gain total

  const filtered = useMemo(() => {
    return sales.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !q || s.client_name?.toLowerCase().includes(q) || s.client_phone?.includes(q) || s.package_name?.toLowerCase().includes(q);
      const matchAccount = filterAccount === 'tous' || s.account_used === filterAccount;
      const matchPayment = filterPayment === 'tous' || s.payment_method === filterPayment;
      const saleDate = new Date(s.sale_date || s.created_date);
      const matchFrom = !dateFrom || saleDate >= new Date(dateFrom);
      const matchTo = !dateTo || saleDate <= new Date(dateTo + 'T23:59:59');
      return matchSearch && matchAccount && matchPayment && matchFrom && matchTo;
    });
  }, [sales, search, filterAccount, filterPayment, dateFrom, dateTo]);

  const openReport = (account) => { setReportAccount(account); setShowReport(true); };

  const tabs = [
    { id: 'ventes', label: 'Ventes' },
    { id: 'caisse', label: 'Caisse & Comptes' },
    { id: 'paiements', label: 'Paiements fournisseur' },
  ];

  return (
    <div>
      <PageHeader title="Forfaits Internet" subtitle="Ventes, caisse et paiements fournisseur">
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="h-4 w-4" />Nouvelle vente
        </Button>
        <Button onClick={() => setShowPayment(true)} className="gap-2 bg-orange-500 hover:bg-orange-600 text-white">
          <HandCoins className="h-4 w-4" />Payer fournisseur
        </Button>
      </PageHeader>

      {/* Résumé caisse global */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Wifi className="h-4 w-4 text-primary" /></div>
            <div><p className="text-xl font-bold">{sales.length}</p><p className="text-xs text-muted-foreground">Ventes totales</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center"><DollarSign className="h-4 w-4 text-green-400" /></div>
            <div><p className="text-xl font-bold text-green-400">{totalRevenue.toFixed(2)} €</p><p className="text-xs text-muted-foreground">Total encaissé</p></div>
          </CardContent>
        </Card>
        <Card className="border-2 border-orange-500/40 bg-orange-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-orange-500/20 flex items-center justify-center"><HandCoins className="h-4 w-4 text-orange-400" /></div>
            <div>
              <p className="text-xl font-bold text-orange-400">{totalDueToSupplier.toFixed(2)} €</p>
              <p className="text-xs text-muted-foreground">À donner fournisseur</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-500/40 bg-blue-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/20 flex items-center justify-center"><Wallet className="h-4 w-4 text-blue-400" /></div>
            <div>
              <p className="text-xl font-bold text-blue-400">{totalProfit.toFixed(2)} €</p>
              <p className="text-xs text-muted-foreground">Votre bénéfice</p>
            </div>
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

      {/* TAB: CAISSE & COMPTES */}
      {activeTab === 'caisse' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(accountStats).map(([account, data]) => (
              <Card key={account} className={`border-2 transition-colors ${data.unpaid > 0 ? 'border-orange-500/30 bg-orange-500/5' : 'border-green-500/30 bg-green-500/5'}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-base">{account}</p>
                      <p className="text-xs text-muted-foreground">{data.count} vente{data.count > 1 ? 's' : ''}</p>
                    </div>
                    {data.unpaid > 0
                      ? <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full flex items-center gap-1"><Clock className="h-3 w-3" />En attente</span>
                      : <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full flex items-center gap-1"><CheckCircle className="h-3 w-3" />Soldé</span>
                    }
                  </div>
                  <Separator className="mb-3" />
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total vendu</span>
                      <span className="font-semibold">{data.revenue.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Déjà payé fournisseur</span>
                      <span className="font-semibold text-green-400">-{data.paid.toFixed(2)} €</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-base">
                      <span>Reste à donner</span>
                      <span className={data.unpaid > 0 ? 'text-orange-400' : 'text-green-400'}>{data.unpaid.toFixed(2)} €</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openReport(account)}>
                      <FileText className="h-3 w-3 mr-1" />Rapport
                    </Button>
                    {data.unpaid > 0 && (
                      <Button size="sm" className="flex-1 text-xs bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setShowPayment(true)}>
                        <HandCoins className="h-3 w-3 mr-1" />Payer
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB: PAIEMENTS FOURNISSEUR */}
      {activeTab === 'paiements' && (
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-orange-400" />
              Historique des paiements au fournisseur
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {supplierPayments.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <HandCoins className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>Aucun paiement enregistré</p>
                <Button className="mt-4 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setShowPayment(true)}>
                  <Plus className="h-4 w-4 mr-2" />Enregistrer un paiement
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                      <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compte</th>
                      <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total ventes</th>
                      <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Montant donné</th>
                      <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierPayments.map(p => (
                      <tr key={p.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                          {p.payment_date ? format(new Date(p.payment_date), 'dd/MM/yyyy HH:mm') : format(new Date(p.created_date), 'dd/MM/yyyy HH:mm')}
                        </td>
                        <td className="p-3 font-medium">{p.account_name}</td>
                        <td className="p-3 text-right text-muted-foreground">{p.total_sales_amount ? `${p.total_sales_amount.toFixed(2)} €` : '—'}</td>
                        <td className="p-3 text-right">
                          <span className="font-bold text-orange-400 text-base">{p.amount_given.toFixed(2)} €</span>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{p.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td colSpan={3} className="p-3 font-semibold text-sm">Total payé au fournisseur</td>
                      <td className="p-3 text-right font-bold text-orange-400 text-base">{totalPaidToSupplier.toFixed(2)} €</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB: VENTES */}
      {activeTab === 'ventes' && (
        <>
          {/* Filtres */}
          <Card className="border-border/50 mb-4">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Rechercher client, forfait..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <Select value={filterAccount} onValueChange={setFilterAccount}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="Compte" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tous les comptes</SelectItem>
                    {ACCOUNTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterPayment} onValueChange={setFilterPayment}>
                  <SelectTrigger className="w-36"><SelectValue placeholder="Paiement" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tous">Tout paiement</SelectItem>
                    <SelectItem value="especes">Espèces</SelectItem>
                    <SelectItem value="carte">Carte</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                    <SelectItem value="credit_client">Crédit</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="date" className="w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <Input type="date" className="w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                <Button variant="outline" size="sm" onClick={() => openReport('')} className="gap-1">
                  <FileText className="h-3.5 w-3.5" />Rapport
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">{filtered.length} vente{filtered.length > 1 ? 's' : ''}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Chargement...</div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center">
                  <Wifi className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Aucune vente trouvée</p>
                  <Button className="mt-4" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-2" />Première vente</Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/20">
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client</th>
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Forfait</th>
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compte</th>
                        <th className="text-left p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paiement</th>
                        <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prix</th>
                        <th className="text-right p-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bénéfice</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(s => {
                        const profit = (s.sell_price || 0) - (s.cost_price || 0);
                        const dateStr = s.sale_date || s.created_date;
                        return (
                          <tr key={s.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                            <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                              {dateStr ? format(new Date(dateStr), 'dd/MM/yy HH:mm') : '—'}
                            </td>
                            <td className="p-3">
                              <p className="font-medium">{s.client_name}</p>
                              <p className="text-xs text-muted-foreground">{s.client_phone}</p>
                            </td>
                            <td className="p-3">
                              <p className="font-medium">{s.package_name}</p>
                              <div className="flex gap-1 mt-0.5">
                                {s.data_amount && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{s.data_amount}</span>}
                                {s.validity_days && <span className="text-xs text-muted-foreground">{s.validity_days}j</span>}
                              </div>
                              {s.activation_code && <p className="text-xs text-muted-foreground">Réf: {s.activation_code}</p>}
                            </td>
                            <td className="p-3 text-sm text-muted-foreground">{s.account_used || '—'}</td>
                            <td className="p-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${paymentColor[s.payment_method] || ''}`}>
                                {paymentLabel[s.payment_method] || s.payment_method}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold text-green-400">{(s.sell_price || 0).toFixed(2)} €</td>
                            <td className="p-3 text-right font-semibold text-blue-400">{profit.toFixed(2)} €</td>
                            <td className="p-3">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => { if (window.confirm('Supprimer cette vente ?')) deleteMutation.mutate(s.id); }}>
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

      <NewSaleModal open={showNew} onClose={() => setShowNew(false)} packages={packages} accounts={ACCOUNTS} onSave={createMutation.mutateAsync} />
      <AccountReportModal open={showReport} onClose={() => setShowReport(false)} sales={sales} accountName={reportAccount} dateFrom={dateFrom} dateTo={dateTo} />
      <SupplierPaymentModal open={showPayment} onClose={() => setShowPayment(false)} accounts={ACCOUNTS} salesByAccount={accountStats} onSave={paymentMutation.mutateAsync} />
    </div>
  );
}