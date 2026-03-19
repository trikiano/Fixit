import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/ui/StatusBadge";
import { format } from 'date-fns';
import { ShoppingCart, Package, CreditCard, Banknote, Receipt } from 'lucide-react';
import { useAppSettings } from "@/components/settings/SettingsContext";

function fmtDate(d) {
  if (!d) return '-';
  try { return format(new Date(d), 'dd/MM/yyyy HH:mm'); } catch { return d; }
}

export default function CashRegisterDetail({ register, onClose }) {
  const { formatCurrency } = useAppSettings();
  const { data: allSales = [], isLoading } = useQuery({
    queryKey: ['sales-all'],
    queryFn: () => base44.entities.Sale.filter({ status: 'completee' }, '-created_date', 500),
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['expenses-all'],
    queryFn: () => base44.entities.Expense.list('-created_date', 200),
  });

  // Filter sales within this register's date range
  const regDate = register.date; // 'yyyy-MM-dd'
  const isOpen = register.status === 'ouverte';
  const openTime = register.created_date ? new Date(register.created_date) : new Date(`${regDate}T00:00:00`);
  const closeTime = register.closing_date ? new Date(register.closing_date) : (isOpen ? new Date() : new Date(`${regDate}T23:59:59`));

  const sales = allSales.filter(s => {
    if (!s.created_date) return false;
    const d = new Date(s.created_date);
    return d >= openTime && d <= closeTime;
  });

  const expenses = allExpenses.filter(e => {
    const d = e.date === regDate || e.created_date?.startsWith(regDate);
    return d;
  });

  const totalCash = sales.filter(s => s.payment_method === 'especes' || s.payments?.some(p => p.method === 'especes')).reduce((sum, s) => {
    if (s.payment_method === 'especes') return sum + (s.total || 0);
    const cashPayment = s.payments?.find(p => p.method === 'especes');
    return sum + (cashPayment?.amount || 0);
  }, 0);
  const totalCard = sales.filter(s => s.payment_method === 'carte' || s.payments?.some(p => p.method === 'carte')).reduce((sum, s) => {
    if (s.payment_method === 'carte') return sum + (s.total || 0);
    const cardPayment = s.payments?.find(p => p.method === 'carte');
    return sum + (cardPayment?.amount || 0);
  }, 0);
  const totalSales = sales.reduce((s, v) => s + (v.total || 0), 0);
  const totalExp = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Receipt className="h-5 w-5 text-primary" />
            <div>
              <p>Journal de caisse — {register.date}</p>
              <p className="text-sm font-normal text-muted-foreground">
                Ouverture: {formatCurrency(register.opening_balance || 0)} &nbsp;·&nbsp;
                <StatusBadge status={register.status} />
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Résumé */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-muted/30 rounded-xl p-3 border border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Ventes totales</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(totalSales)}</p>
            <p className="text-xs text-muted-foreground">{sales.length} ticket(s)</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 border border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Banknote className="h-3 w-3" />Espèces</p>
            <p className="text-lg font-bold">{formatCurrency(totalCash)}</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 border border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><CreditCard className="h-3 w-3" />Carte</p>
            <p className="text-lg font-bold">{formatCurrency(totalCard)}</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 border border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Dépenses</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(totalExp)}</p>
          </div>
        </div>

        {register.status === 'fermee' && (
          <div className="p-3 rounded-xl border border-border/50 bg-muted/20 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">Solde attendu: <span className="font-bold text-foreground">{formatCurrency(register.expected_balance || 0)}</span></span>
            <span className="text-muted-foreground">Solde réel: <span className="font-bold text-foreground">{formatCurrency(register.closing_balance || 0)}</span></span>
            <span className="text-muted-foreground">Écart: <span className={`font-bold ${(register.difference || 0) !== 0 ? 'text-destructive' : 'text-foreground'}`}>{formatCurrency(register.difference || 0)}</span></span>
          </div>
        )}

        {/* Liste des ventes */}
        <div>
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><ShoppingCart className="h-4 w-4" />Ventes de la session ({sales.length})</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">Chargement...</p>
          ) : sales.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">Aucune vente sur cette session</p>
          ) : (
            <div className="space-y-2">
              {sales.map(sale => (
                <div key={sale.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                  {/* Header ticket */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/50">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-bold text-primary">{sale.sale_number || '-'}</span>
                      <span className="text-sm text-muted-foreground">{sale.client_name || 'Client passager'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {sale.payment_method === 'especes' ? '💵 Espèces' : sale.payment_method === 'carte' ? '💳 Carte' : sale.payment_method === 'mixte' ? '🔀 Mixte' : sale.payment_method}
                      </Badge>
                      <span className="text-sm font-bold">{formatCurrency(sale.total || 0)}</span>
                    </div>
                  </div>
                  {/* Produits */}
                  {sale.items?.length > 0 && (
                    <div className="px-4 py-2">
                      {sale.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1 text-sm border-b last:border-0 border-border/30">
                          <div className="flex items-center gap-2">
                            <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span>{item.product_name}</span>
                            <span className="text-muted-foreground">× {item.quantity}</span>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            {item.discount > 0 && <span className="text-xs text-muted-foreground line-through">{formatCurrency((item.unit_price || 0) * item.quantity)}</span>}
                            <span className="font-medium">{formatCurrency(item.total || 0)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="px-4 py-1.5 flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
                    <span>{fmtDate(sale.created_date)}</span>
                    {sale.discount_total > 0 && <span className="text-orange-500">Remise: -{formatCurrency(sale.discount_total)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dépenses */}
        {expenses.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-2">Dépenses de la journée ({expenses.length})</p>
            <div className="space-y-1.5">
              {expenses.map(e => (
                <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/20 text-sm">
                  <span>{e.description}</span>
                  <span className="font-medium text-destructive">-{formatCurrency(e.amount || 0)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}