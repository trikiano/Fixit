import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Wifi, TrendingUp, Package } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAppSettings } from "@/components/settings/SettingsContext";


export default function AccountReportModal({ open, onClose, sales, accountName, dateFrom, dateTo }) {
  const { formatCurrency } = useAppSettings();
  const filtered = useMemo(() => {

    if (!sales) return [];
    return sales.filter(s => {
      const matchAccount = !accountName || s.account_used === accountName;
      const saleDate = new Date(s.sale_date || s.created_date);
      const matchFrom = !dateFrom || saleDate >= new Date(dateFrom);
      const matchTo = !dateTo || saleDate <= new Date(dateTo + 'T23:59:59');
      return matchAccount && matchFrom && matchTo;
    });
  }, [sales, accountName, dateFrom, dateTo]);

  const totalRevenue = filtered.reduce((s, x) => s + (x.sell_price || 0), 0);
  const totalCost = filtered.reduce((s, x) => s + (x.cost_price || 0), 0);
  const totalProfit = totalRevenue - totalCost;

  const byPackage = filtered.reduce((acc, s) => {
    const key = s.package_name || 'Sans nom';
    acc[key] = acc[key] || { count: 0, revenue: 0 };
    acc[key].count++;
    acc[key].revenue += s.sell_price || 0;
    return acc;
  }, {});

  const paymentLabel = { especes: 'Espèces', carte: 'Carte', virement: 'Virement', credit_client: 'Crédit' };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Rapport — {accountName || 'Tous les comptes'}
          </DialogTitle>
          {(dateFrom || dateTo) && (
            <p className="text-sm text-muted-foreground">
              {dateFrom && format(new Date(dateFrom), 'dd MMM yyyy', { locale: fr })}
              {dateFrom && dateTo && ' → '}
              {dateTo && format(new Date(dateTo), 'dd MMM yyyy', { locale: fr })}
            </p>
          )}
        </DialogHeader>

        {/* Stats résumé */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          <div className="bg-primary/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Ventes</p>
          </div>
          <div className="bg-green-500/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground">Chiffre d'affaires</p>
          </div>
          <div className="bg-blue-500/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{formatCurrency(totalProfit)}</p>

            <p className="text-xs text-muted-foreground">Bénéfice net</p>
          </div>
        </div>

        {/* Répartition par forfait */}
        {Object.keys(byPackage).length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-semibold mb-2 flex items-center gap-1"><Package className="h-4 w-4" />Répartition par forfait</p>
              <div className="space-y-2">
                {Object.entries(byPackage).map(([name, data]) => (
                  <div key={name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Wifi className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm">{name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{data.count}x</Badge>
                      <span className="text-sm font-semibold text-green-400">{formatCurrency(data.revenue)}</span>

                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Liste détaillée */}
        <Separator />
        <div>
          <p className="text-sm font-semibold mb-2 flex items-center gap-1"><TrendingUp className="h-4 w-4" />Détail des ventes ({filtered.length})</p>
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Aucune vente sur cette période</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {filtered.sort((a, b) => new Date(b.sale_date || b.created_date) - new Date(a.sale_date || a.created_date)).map(s => (
                <div key={s.id} className="p-3 rounded-lg border border-border/50 bg-card/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">{s.client_name}</p>
                      <p className="text-xs text-muted-foreground">{s.client_phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-green-400">{formatCurrency(s.sell_price)}</p>

                      <p className="text-xs text-muted-foreground">{paymentLabel[s.payment_method] || s.payment_method}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="outline" className="text-xs"><Wifi className="h-3 w-3 mr-1" />{s.package_name}</Badge>
                    {s.data_amount && <Badge variant="outline" className="text-xs">{s.data_amount}</Badge>}
                    {s.validity_days && <Badge variant="outline" className="text-xs">{s.validity_days}j</Badge>}
                    {s.activation_code && <span className="text-xs text-muted-foreground">Réf: {s.activation_code}</span>}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {format(new Date(s.sale_date || s.created_date), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground mt-1 italic">{s.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}