import React, { useMemo } from 'react';

import { fixit } from '@/api/fixitClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";
import StatusBadge from "@/components/ui/StatusBadge";
import { format } from 'date-fns';
import { ShoppingCart, Package, CreditCard, Banknote, Receipt, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';




import { useAppSettings } from "@/components/settings/SettingsContext";


function fmtDate(d) {
  if (!d) return '-';
  try { 
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return format(date, 'dd/MM/yyyy HH:mm'); 
  } catch { return d; }
}

function fmtTime(d) {
  if (!d) return '--:--';
  try { 
    const date = new Date(d);
    if (isNaN(date.getTime())) return '--:--';
    return format(date, 'HH:mm'); 
  } catch { return '--:--'; }
}


export default function CashRegisterDetail({ register, onClose }) {
  if (!register) return null;
  const { formatCurrency, settings } = useAppSettings();

  const { data: allSales = [], isLoading } = useQuery({

    queryKey: ['sales-all'],
    queryFn: () => fixit.entities.Sale.filter({ status: 'completee' }, '-created_date', 500),
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['expenses-all'],
    queryFn: () => fixit.entities.Expense.list('-created_date', 200),
  });

  const { sales, expenses, totalCash, totalCard, totalSales, totalExp, openTime, closeTime } = useMemo(() => {
    try {
      const regDate = register.date || format(new Date(), 'yyyy-MM-dd');
      const isOpen = register.status === 'ouverte';
      
      const parseSafeDate = (d, fallback) => {
        if (!d) return fallback;
        const date = new Date(d);
        return isNaN(date.getTime()) ? fallback : date;
      };

      const ot = parseSafeDate(register.created_date, new Date(`${regDate}T00:00:00`));
      const ct = parseSafeDate(register.closing_date, (isOpen ? new Date() : new Date(`${regDate}T23:59:59`)));

      const filteredSales = (allSales || []).filter(s => {
        if (!s || !s.created_date) return false;
        const d = new Date(s.created_date);
        return d >= ot && d <= ct;
      });

      const filteredExpenses = (allExpenses || []).filter(e => {
        if (!e) return false;
        return e.date === regDate || e.created_date?.startsWith(regDate);
      });

      const cash = filteredSales.reduce((sum, s) => {
        if (s.payment_method === 'especes') return sum + (Number(s.total) || 0);
        const cp = (s.payments || []).find(p => p.method === 'especes');
        return sum + (Number(cp?.amount) || 0);
      }, 0);

      const card = filteredSales.reduce((sum, s) => {
        if (s.payment_method === 'carte') return sum + (Number(s.total) || 0);
        const cp = (s.payments || []).find(p => p.method === 'carte');
        return sum + (Number(cp?.amount) || 0);
      }, 0);

      const tSales = filteredSales.reduce((s, v) => s + (Number(v.total) || 0), 0);
      const tExp = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

      return { 
        sales: filteredSales, expenses: filteredExpenses, 
        totalCash: cash, totalCard: card, totalSales: tSales, totalExp: tExp,
        openTime: ot, closeTime: ct
      };
    } catch (e) {
      console.error("Crash in CashRegisterDetail logic:", e);
      return { 
        sales: [], expenses: [], 
        totalCash: 0, totalCard: 0, totalSales: 0, totalExp: 0,
        openTime: new Date(), closeTime: new Date()
      };
    }
  }, [register, allSales, allExpenses]);




  const handleGeneratePDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const bName = settings.business_name || 'FIXIT PRO';
      
      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text(bName.toUpperCase(), 15, 20);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text('Système de Gestion POS & Stock', 15, 25);
      doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, 29);
      
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(15, 35, 195, 35);
      
      // Title
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text('RAPPORT DE CAISSE', 195, 20, { align: 'right' });
      doc.setFontSize(12);
      doc.text(`SESSION DU ${register.date}`, 195, 27, { align: 'right' });

      // Summary Section
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('RÉSUMÉ FINANCIER', 15, 45);
      
      const summaryData = [
        ['Fond de caisse initial', formatCurrency(register.opening_balance || 0)],
        ['Total Ventes Brutes', formatCurrency(totalSales)],
        ['Dépenses Totales', `-${formatCurrency(totalExp)}`],
        ['Solde Attendu (Théorique)', formatCurrency((Number(register.opening_balance) || 0) + totalSales - totalExp)],
        ['Solde Réel (Clôture)', register.closing_balance != null ? formatCurrency(register.closing_balance) : '-'],
        ['Écart de Caisse', formatCurrency(register.difference || 0)]
      ];

      autoTable(doc, {
        startY: 48,
        body: summaryData,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: { 0: { cellWidth: 50, fontStyle: 'normal' }, 1: { fontStyle: 'bold', halign: 'right' } },
        margin: { left: 15, right: 100 }
      });

      const summaryFinalY = doc.lastAutoTable?.finalY || 48;

      // Payment methods summary
      doc.text('DÉTAILS ENCAISSEMENTS', 115, 45);
      const paymentData = [
        ['Espèces', formatCurrency(totalCash)],
        ['Carte Bancaire', formatCurrency(totalCard)],
        ['Nombre de Tickets', sales.length.toString()],
        ['Statut Session', (register.status || 'ouverte').toUpperCase()],
        ['Caissier', register.opened_by || 'Non défini'],
        ['ID Session', `SES-${(register.date || '').replace(/-/g, '')}-${(register.id || '').toString().slice(-4)}`]
      ];
      
      autoTable(doc, {
        startY: 48,
        body: paymentData,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2.5 },
        columnStyles: { 0: { cellWidth: 40, fontStyle: 'normal' }, 1: { fontStyle: 'bold', halign: 'right' } },
        margin: { left: 115 }
      });

      const paymentFinalY = doc.lastAutoTable?.finalY || 48;
      const finalTopY = Math.max(summaryFinalY, paymentFinalY);

      // Sales Table
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('JOURNAL DES VENTES', 15, finalTopY + 20);

      autoTable(doc, {
        startY: finalTopY + 23,
        head: [['Heure', 'Ticket #', 'Client', 'Mode', 'Montant']],
        body: sales.map(s => [
          fmtTime(s.created_date),
          s.sale_number || '-',
          s.client_name || 'Passager',
          s.payment_method || '-',
          formatCurrency(s.total || 0)
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 4: { halign: 'right', fontStyle: 'bold' } }
      });

      const salesFinalY = doc.lastAutoTable?.finalY || finalTopY + 23;

      // Expenses Table if any
      if (expenses.length > 0) {
        doc.text('JOURNAL DES DÉPENSES', 15, salesFinalY + 15);
        autoTable(doc, {
          startY: salesFinalY + 18,
          head: [['Description', 'Montant']],
          body: expenses.map(e => [e.description, `-${formatCurrency(e.amount || 0)}`]),
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [185, 28, 28], textColor: 255 },
          columnStyles: { 1: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] } }
        });
      }

      // Signatures
      const finalReportY = doc.lastAutoTable?.finalY || salesFinalY;
      const ySign = finalReportY + 30;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('SIGNATURE DU RESPONSABLE', 15, ySign);
      doc.text('CACHET DE L\'ÉTABLISSEMENT', 150, ySign);
      doc.setDrawColor(203, 213, 225);
      doc.line(15, ySign + 10, 65, ySign + 10);
      doc.rect(150, ySign + 5, 30, 20);

      doc.save(`RapportCaisse_${register.date}.pdf`);
    } catch (err) {
      console.error("PDF generator error:", err);
      toast.error("Erreur lors de la création du PDF. Veuillez vérifier la console.");
    }
  };



  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* --- Reporting Page for Print --- */}
        <div className="hidden print:block font-serif text-slate-900 print-content">

          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tight uppercase">{settings.business_name || 'FIXIT PRO'}</h1>
              <p className="text-sm">Système de Gestion de Stock & POS</p>
              <p className="text-xs text-slate-500">Document généré le {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            </div>
            <div className="text-right">
              <div className="bg-slate-900 text-white px-4 py-2 font-bold text-lg mb-2">RAPPORT DE CAISSE</div>
              <p className="font-mono font-bold text-xl">SESSION : {register.date}</p>
            </div>
          </div>

          {/* Session Overview */}
          <div className="grid grid-cols-2 gap-8 mb-10">
            <div className="space-y-4">
              <h3 className="font-bold border-b pb-1 text-slate-700 uppercase text-xs tracking-wider">Résumé Financier</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b"><td className="py-2 text-slate-600">Fond de caisse initial</td><td className="py-2 text-right font-bold">{formatCurrency(register.opening_balance || 0)}</td></tr>
                  <tr className="border-b"><td className="py-2 text-slate-600">Total Ventes Nettes</td><td className="py-2 text-right font-bold">{formatCurrency(totalSales)}</td></tr>
                  <tr className="border-b"><td className="py-2 text-slate-600">Dépenses Sortantes</td><td className="py-2 text-right font-bold text-destructive">-{formatCurrency(totalExp)}</td></tr>
                  <tr className="bg-slate-50 font-black text-lg"><td className="py-3 px-2">SOLDE ATTENDU</td><td className="py-3 px-2 text-right">{formatCurrency(register.expected_balance || (register.opening_balance || 0) + totalSales - totalExp)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="space-y-4">
              <h3 className="font-bold border-b pb-1 text-slate-700 uppercase text-xs tracking-wider">Détail des Encaissements</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b"><td className="py-2 text-slate-600">Total Espèces</td><td className="py-2 text-right font-bold">{formatCurrency(totalCash)}</td></tr>
                  <tr className="border-b"><td className="py-2 text-slate-600">Total Carte Bancaire</td><td className="py-2 text-right font-bold">{formatCurrency(totalCard)}</td></tr>
                  <tr className="border-b"><td className="py-2 text-slate-500 italic">Nombre de tickets</td><td className="py-2 text-right italic">{sales.length}</td></tr>
                  <tr className="bg-slate-50 font-bold"><td className="py-3 px-2 text-slate-600">Statut Session</td><td className="py-3 px-2 text-right uppercase">{register.status || 'ouverte'}</td></tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* Sales Table */}
          <div className="space-y-4 mb-10">
            <h3 className="font-bold border-b pb-1 text-slate-700 uppercase text-xs tracking-wider">Journal des Ventes</h3>
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  <th className="py-3 px-2 text-left font-bold uppercase">Heure</th>
                  <th className="py-3 px-2 text-left font-bold uppercase">Ticket #</th>
                  <th className="py-3 px-2 text-left font-bold uppercase">Client</th>
                  <th className="py-3 px-2 text-left font-bold uppercase">Paiement</th>
                  <th className="py-3 px-2 text-right font-bold uppercase text-primary">Montant</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(sale => (
                  <tr key={sale.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="py-2.5 px-2">{fmtTime(sale.created_date)}</td>

                    <td className="py-2.5 px-2 font-mono font-bold">{sale.sale_number || '-'}</td>
                    <td className="py-2.5 px-2">{sale.client_name || 'Client passager'}</td>
                    <td className="py-2.5 px-2 capitalize">{sale.payment_method}</td>
                    <td className="py-2.5 px-2 text-right font-bold">{formatCurrency(sale.total || 0)}</td>
                  </tr>
                ))}
                {sales.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic font-serif">Aucune vente enregistrée sur cette session.</td></tr>}
              </tbody>
              <tfoot className="bg-slate-50 font-bold">
                <tr>
                  <td colSpan={4} className="py-3 px-2 text-right uppercase text-xs">TOTAL GÉNÉRAL VENTES</td>
                  <td className="py-3 px-2 text-right text-base text-primary">{formatCurrency(totalSales)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Expenses Table */}
          {expenses.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-bold border-b pb-1 text-slate-700 uppercase text-xs tracking-wider text-destructive">Bilan des Dépenses</h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-2 px-2 text-left">Description</th>
                    <th className="py-2 px-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2 px-2">{e.description}</td>
                      <td className="py-2 px-2 text-right font-bold text-destructive">-{formatCurrency(e.amount || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="mt-20 flex justify-between border-t border-dotted border-slate-400 pt-8">
            <div className="text-center space-y-8">
              <p className="text-xs uppercase font-bold text-slate-500">Signature Responsable</p>
              <div className="h-16 w-48 border-b border-slate-300"></div>
            </div>
            <div className="text-center space-y-8">
              <p className="text-xs uppercase font-bold text-slate-500">Cachet Établissement</p>
              <div className="h-20 w-20 border-2 border-slate-200 rounded-full flex items-center justify-center text-[8px] italic text-slate-300">CACHET ICI</div>
            </div>
          </div>
        </div>

        {/* --- Standard UI View --- */}
        <div className="print:hidden space-y-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-primary" />
                <div>
                  <p>Journal de caisse — {register.date}</p>
                  <p className="text-sm font-normal text-muted-foreground">
                    Ouverture: {formatCurrency(register.opening_balance || 0)} &nbsp;·&nbsp;
                    <StatusBadge status={register.status} />
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleGeneratePDF} className="gap-2">
                <FileText className="h-4 w-4" /> Générer PDF
              </Button>

            </DialogTitle>
          </DialogHeader>



        {/* Résumé */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-muted/30 rounded-xl p-3 border border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Ventes totales</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(totalSales)}</p>
            <p className="text-xs text-muted-foreground">{sales.length} ticket(s)</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 border border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-1">Caissier</p>
            <p className="text-sm font-bold truncate" title={register.opened_by || 'Non défini'}>{register.opened_by || 'Non défini'}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Responsable Ouverture</p>
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
        </div>
      </DialogContent>
      <style>{`
        @media print {
          @page { size: portrait; margin: 0.5in; }
          body { margin: 0; padding: 0; background-color: white !important; visibility: hidden !important; }
          #root { display: none !important; } 
          [role="dialog"] { 
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
          }
          .print-content, .print-content * { 
            visibility: visible !important; 
            display: block !important; 
          }
          table { display: table !important; width: 100% !important; }
          thead { display: table-header-group !important; }
          tr { display: table-row !important; }
          th, td { display: table-cell !important; }
          .print\\:hidden { display: none !important; }
          button { display: none !important; }
        }


      `}</style>
    </Dialog>


  );
}