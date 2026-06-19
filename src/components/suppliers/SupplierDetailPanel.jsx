import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, FileText, ShoppingCart, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { useAppSettings } from '@/components/settings/SettingsContext';

const statusConfig = {
  en_attente: { label: 'En attente', class: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  partielle: { label: 'Partielle', class: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  soldee: { label: 'Soldée', class: 'bg-green-500/20 text-green-400 border-green-500/30' },
  annulee: { label: 'Annulée', class: 'bg-muted text-muted-foreground' },
};

export default function SupplierDetailPanel({ supplier, open, onClose }) {
  const { formatCurrency } = useAppSettings();
  const { data: invoices = [] } = useQuery({
    queryKey: ['supplierInvoices', supplier?.id],
    queryFn: () => base44.entities.SupplierInvoice.filter({ supplier_id: supplier.id }),
    enabled: !!supplier?.id,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['purchaseOrders', supplier?.id],
    queryFn: () => base44.entities.PurchaseOrder.filter({ supplier_id: supplier.id }),
    enabled: !!supplier?.id,
  });

  if (!supplier) return null;

  const totalDebt = invoices.reduce((s, i) => s + (i.remaining_debt || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.amount_paid || 0), 0);
  const pendingInvoices = invoices.filter(i => i.status !== 'soldee' && i.status !== 'annulee');

  // Historique de tous les paiements de toutes les factures
  const allPayments = invoices.flatMap(inv =>
    (inv.payments || []).map(p => ({ ...p, invoice_number: inv.invoice_number, invoice_id: inv.id }))
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            {supplier.name}
          </DialogTitle>
        </DialogHeader>

        {/* Infos contact */}
        <div className="text-sm text-muted-foreground space-y-1">
          {supplier.contact_name && <p>Contact : {supplier.contact_name}</p>}
          <p>📞 {supplier.phone}{supplier.email ? ` · ✉️ ${supplier.email}` : ''}</p>
        </div>

        <Separator />

        {/* Résumé financier */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-red-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Dette totale</p>
              <p className="text-xl font-bold text-red-400">{formatCurrency(totalDebt)}</p>
            </CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total payé</p>
              <p className="text-xl font-bold text-green-400">{formatCurrency(totalPaid)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Factures impayées</p>
              <p className="text-xl font-bold text-amber-400">{pendingInvoices.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Factures impayées */}
        {pendingInvoices.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" /> Factures en cours
            </h4>
            <div className="space-y-2">
              {pendingInvoices.map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                  <div>
                    <p className="font-medium font-mono text-primary">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[250px]">{inv.description}</p>
                    <p className="text-xs text-muted-foreground">{inv.invoice_date}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={statusConfig[inv.status]?.class}>{statusConfig[inv.status]?.label}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Total: {formatCurrency(inv.total_amount || 0)}</p>
                    <p className="font-bold text-red-400">{formatCurrency(inv.remaining_debt || 0)} restant</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Historique des paiements */}
        <div>
          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-green-400" /> Historique des paiements
          </h4>
          {allPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun paiement enregistré</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {allPayments.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                  <div>
                    <p className="font-medium text-green-400">+{formatCurrency(p.amount || 0)}</p>
                    <p className="text-xs text-muted-foreground">{p.method} — Facture {p.invoice_number}</p>
                    {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{p.date}</span>
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Commandes */}
        {orders.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" /> Commandes ({orders.length})
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {orders.map(o => (
                  <div key={o.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                    <span className="font-mono text-primary">{o.order_number}</span>
                    <span className="text-muted-foreground">{o.status}</span>
                    <span className="font-medium">{formatCurrency(o.total_amount || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}