import React, { useMemo } from 'react';
import { fixit } from '@/api/fixitClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/ui/StatusBadge";
import { format } from 'date-fns';
import {
  ShoppingCart, Wrench, Zap, Banknote, CreditCard,
  Receipt, FileText, TrendingUp, Tag, ArrowDownCircle,
  BarChart3, Clock, Users
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { useAppSettings } from "@/components/settings/SettingsContext";

/* ─── helpers ─────────────────────────────────────────────────── */
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
function parseItems(raw) {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}
function parsePayments(raw) {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

/* ─── extract cash / card from a record ──────────────────────── */
function extractPayments(record, amountField = 'total') {
  const total = Number(record[amountField]) || 0;
  const method = record.payment_method || '';
  const payments = parsePayments(record.payments);

  if (payments.length > 0) {
    const cash = payments.filter(p => p.method === 'especes').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const card = payments.filter(p => p.method === 'carte').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return { cash, card };
  }
  if (method === 'especes') return { cash: total, card: 0 };
  if (method === 'carte')   return { cash: 0, card: total };
  if (method === 'mixte')   return { cash: total / 2, card: total / 2 }; // fallback split
  return { cash: 0, card: 0 };
}

/* ─── KPI card ────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon: Icon, color = 'text-foreground', bg = 'bg-muted/30' }) {
  return (
    <div className={`${bg} rounded-xl p-3 border border-border/50 flex flex-col gap-1`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}{label}
      </div>
      <p className={`text-lg font-bold leading-tight ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/* ─── section title ──────────────────────────────────────────── */
function SectionTitle({ icon: Icon, children, color = 'text-foreground' }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-semibold ${color} mb-2`}>
      {Icon && <Icon className="h-4 w-4" />}{children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function CashRegisterDetail({ register, onClose }) {
  if (!register) return null;
  const { formatCurrency, settings } = useAppSettings();
  const regDate = register.date || format(new Date(), 'yyyy-MM-dd');

  /* ── 1. Queries ─────────────────────────────────────────────── */
  const { data: allSales = [], isLoading: loadSales } = useQuery({
    queryKey: ['sales-by-date', regDate],
    queryFn: async () => {
      // Stratégie 1 : filtre par sale_date (nouveau champ)
      try {
        const bySaleDate = await fixit.entities.Sale.filter({ sale_date: regDate }, '-created_date', 1000);
        if (Array.isArray(bySaleDate) && bySaleDate.length > 0) return bySaleDate;
      } catch (_) { /* colonne peut ne pas exister en DB */ }

      // Stratégie 2 : liste récente + filtre client-side par created_date
      const recent = await fixit.entities.Sale.list('-created_date', 2000);
      const byCreated = recent.filter(s => s && String(s.created_date || '').slice(0, 10) === regDate);
      if (byCreated.length > 0) return byCreated;

      // Stratégie 3 : filtre par sale_date dans les données reçues (compatibilité)
      return recent.filter(s => s && (s.sale_date === regDate));
    },
    staleTime: 0,
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['expenses-by-date', regDate],
    queryFn: () => fixit.entities.Expense.list('-created_date', 500),
    staleTime: 0,
  });

  const { data: allRepairs = [] } = useQuery({
    queryKey: ['repairs-by-date', regDate],
    queryFn: async () => {
      const all = await fixit.entities.Repair.list('-created_date', 500);
      return all.filter(r => {
        const d = r.completed_date || r.created_date || '';
        return String(d).slice(0, 10) === regDate;
      });
    },
    staleTime: 0,
  });

  const { data: allServiceSales = [] } = useQuery({
    queryKey: ['service-sales-by-date', regDate],
    queryFn: async () => {
      const all = await fixit.entities.ServiceSale.list('-created_date', 500);
      return all.filter(s => String(s.created_date || '').slice(0, 10) === regDate);
    },
    staleTime: 0,
  });

  /* ── 2. Computed metrics ────────────────────────────────────── */
  const metrics = useMemo(() => {
    try {
      /* --- Ventes produits --- */
      const sales = allSales || [];
      let salesCash = 0, salesCard = 0, salesTotal = 0, salesDiscounts = 0;
      const productMap = {};

      sales.forEach(s => {
        const { cash, card } = extractPayments(s, 'total');
        salesCash  += cash;
        salesCard  += card;
        salesTotal += Number(s.total) || 0;
        salesDiscounts += Number(s.discount_total) || 0;

        const items = parseItems(s.items);
        items.forEach(it => {
          const key = it.product_name || 'Inconnu';
          if (!productMap[key]) productMap[key] = { qty: 0, total: 0 };
          productMap[key].qty   += Number(it.quantity) || 0;
          productMap[key].total += Number(it.total)    || 0;
        });
      });

      /* --- Dépenses --- */
      const expenses = (allExpenses || []).filter(e => {
        if (!e) return false;
        return e.date === regDate || String(e.created_date || '').slice(0, 10) === regDate;
      });
      const totalExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

      /* --- Réparations payées --- */
      const repairs = (allRepairs || []).filter(r => (Number(r.final_cost) || 0) > 0);
      let repairCash = 0, repairCard = 0, repairTotal = 0;
      repairs.forEach(r => {
        const { cash, card } = extractPayments(r, 'final_cost');
        repairCash  += cash;
        repairCard  += card;
        repairTotal += Number(r.final_cost) || 0;
      });

      /* --- Services --- */
      const serviceSales = allServiceSales || [];
      let serviceCash = 0, serviceCard = 0, serviceTotal = 0;
      serviceSales.forEach(ss => {
        const { cash, card } = extractPayments(ss, 'total');
        serviceCash  += cash;
        serviceCard  += card;
        serviceTotal += Number(ss.total) || 0;
      });

      /* --- Totaux consolidés --- */
      const totalRevenue   = salesTotal + repairTotal + serviceTotal;
      const allCash        = salesCash + repairCash + serviceCash;
      const allCard        = salesCard + repairCard + serviceCard;
      const nbTransactions = sales.length + repairs.length + serviceSales.length;
      const avgTicket      = nbTransactions > 0 ? totalRevenue / nbTransactions : 0;

      /* Solde physique caisse = fond ouverture + encaissements espèces - dépenses */
      const openingBalance  = Number(register.opening_balance) || 0;
      const expectedCashBalance = openingBalance + allCash - totalExpenses;

      const productRows = Object.entries(productMap)
        .sort((a, b) => b[1].total - a[1].total);

      return {
        sales, expenses, repairs, serviceSales,
        salesCash, salesCard, salesTotal, salesDiscounts,
        repairCash, repairCard, repairTotal,
        serviceCash, serviceCard, serviceTotal,
        totalRevenue, allCash, allCard,
        totalExpenses, nbTransactions, avgTicket,
        expectedCashBalance, openingBalance,
        productMap, productRows,
      };
    } catch (e) {
      console.error('CashRegisterDetail metrics error:', e);
      return {
        sales: [], expenses: [], repairs: [], serviceSales: [],
        salesCash: 0, salesCard: 0, salesTotal: 0, salesDiscounts: 0,
        repairCash: 0, repairCard: 0, repairTotal: 0,
        serviceCash: 0, serviceCard: 0, serviceTotal: 0,
        totalRevenue: 0, allCash: 0, allCard: 0,
        totalExpenses: 0, nbTransactions: 0, avgTicket: 0,
        expectedCashBalance: 0, openingBalance: 0,
        productMap: {}, productRows: [],
      };
    }
  }, [regDate, allSales, allExpenses, allRepairs, allServiceSales, register]);

  /* ── 3. PDF generation ──────────────────────────────────────── */
  const handleGeneratePDF = () => {
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const bName = settings.shop_name || settings.business_name || 'FIXIT PRO';
      const DARK  = [30, 41, 59];
      const GRAY  = [100, 116, 139];
      const BLUE  = [37, 99, 235];
      const GREEN = [22, 163, 74];
      const RED   = [185, 28, 28];
      const AMBER = [180, 83, 9];

      const {
        sales, expenses, repairs, serviceSales,
        salesTotal, salesDiscounts,
        repairTotal, serviceTotal,
        totalRevenue, allCash, allCard,
        totalExpenses, nbTransactions, avgTicket,
        expectedCashBalance, openingBalance,
        productRows,
      } = metrics;

      /* ── En-tête ── */
      doc.setFillColor(...DARK);
      doc.rect(0, 0, 210, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text(bName.toUpperCase(), 14, 11);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.text('RAPPORT DE SESSION CAISSE', 14, 18);
      doc.text(`Session du ${register.date}  ·  Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 24);
      doc.text(`Caissier: ${register.opened_by || '—'}  ·  Statut: ${(register.status || 'ouverte').toUpperCase()}`, 14, 29);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
      doc.text(`#${(register.id || '').toString().slice(-6).padStart(6, '0')}`, 196, 20, { align: 'right' });

      let y = 38;

      /* ── Section 1 : Synthèse financière (2 colonnes) ── */
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK);
      doc.text('SYNTHÈSE FINANCIÈRE', 14, y);
      doc.text('BILAN DE CAISSE ESPÈCES', 112, y);
      y += 3;

      autoTable(doc, {
        startY: y,
        body: [
          ['CA Ventes produits',  formatCurrency(salesTotal)],
          ['CA Réparations',      formatCurrency(repairTotal)],
          ['CA Services',         formatCurrency(serviceTotal)],
          ['CHIFFRE D\'AFFAIRES TOTAL', formatCurrency(totalRevenue)],
          ['Remises accordées',   salesDiscounts > 0 ? `-${formatCurrency(salesDiscounts)}` : formatCurrency(0)],
          ['Depenses',            `-${formatCurrency(totalExpenses)}`],
          ['RESULTAT NET', formatCurrency(totalRevenue - totalExpenses)],
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2 },
        columnStyles: { 0: { cellWidth: 52 }, 1: { fontStyle: 'bold', halign: 'right', cellWidth: 30 } },
        bodyStyles: {},
        didParseCell(data) {
          if (data.row.index === 3 || data.row.index === 6) {
            data.cell.styles.fillColor = data.row.index === 3 ? BLUE : GREEN;
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.row.index === 5) data.cell.styles.textColor = RED;
        },
        margin: { left: 14, right: 112 },
      });
      const yA = doc.lastAutoTable?.finalY || y;

      autoTable(doc, {
        startY: y,
        body: [
          ['Fond d\'ouverture',    formatCurrency(openingBalance)],
          ['Especes ventes',       formatCurrency(metrics.salesCash)],
          ['Especes reparations',  formatCurrency(metrics.repairCash)],
          ['Especes services',     formatCurrency(metrics.serviceCash)],
          ['TOTAL ESPECES ENTRANTS', formatCurrency(allCash)],
          ['Depenses especes',    `-${formatCurrency(totalExpenses)}`],
          ['SOLDE ESPECES ATTENDU', formatCurrency(expectedCashBalance)],
        ],
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.2 },
        columnStyles: { 0: { cellWidth: 52 }, 1: { fontStyle: 'bold', halign: 'right', cellWidth: 30 } },
        didParseCell(data) {
          if (data.row.index === 4 || data.row.index === 6) {
            data.cell.styles.fillColor = data.row.index === 4 ? [71, 85, 105] : BLUE;
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.row.index === 5) data.cell.styles.textColor = RED;
        },
        margin: { left: 112 },
      });
      const yB = doc.lastAutoTable?.finalY || y;
      y = Math.max(yA, yB) + 5;

      /* ── Section 2 : Indicateurs clés ── */
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK);
      doc.text('INDICATEURS CLÉS', 14, y); y += 3;

      autoTable(doc, {
        startY: y,
        body: [
          ['Nb total transactions', String(nbTransactions),
           'Dont ventes', String(sales.length),
           'Dont réparations', String(repairs.length),
           'Dont services', String(serviceSales.length)],
          ['Panier moyen', formatCurrency(avgTicket),
           'Total carte', formatCurrency(allCard),
           'Total espèces', formatCurrency(allCash),
           'Remises', salesDiscounts > 0 ? `-${formatCurrency(salesDiscounts)}` : '—'],
        ],
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { textColor: GRAY }, 1: { fontStyle: 'bold' },
          2: { textColor: GRAY }, 3: { fontStyle: 'bold' },
          4: { textColor: GRAY }, 5: { fontStyle: 'bold' },
          6: { textColor: GRAY }, 7: { fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc.lastAutoTable?.finalY || y) + 5;

      /* ── Section 3 : Ventilation par mode de paiement ── */
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK);
      doc.text('VENTILATION PAR MODE DE PAIEMENT', 14, y); y += 3;

      autoTable(doc, {
        startY: y,
        head: [['Mode', 'Ventes', 'Réparations', 'Services', 'TOTAL', '% CA']],
        body: [
          ['Especes (cash)',
           formatCurrency(metrics.salesCash), formatCurrency(metrics.repairCash), formatCurrency(metrics.serviceCash),
           formatCurrency(allCash),
           totalRevenue > 0 ? `${((allCash / totalRevenue) * 100).toFixed(1)}%` : '0%'],
          ['Carte bancaire',
           formatCurrency(metrics.salesCard), formatCurrency(metrics.repairCard), formatCurrency(metrics.serviceCard),
           formatCurrency(allCard),
           totalRevenue > 0 ? `${((allCard / totalRevenue) * 100).toFixed(1)}%` : '0%'],
          ['TOTAL',
           formatCurrency(salesTotal), formatCurrency(repairTotal), formatCurrency(serviceTotal),
           formatCurrency(totalRevenue), '100%'],
        ],
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: DARK, textColor: 255, fontStyle: 'bold' },
        columnStyles: { 4: { fontStyle: 'bold', textColor: BLUE }, 5: { halign: 'right' } },
        didParseCell(data) {
          if (data.row.index === 2) {
            data.cell.styles.fillColor = [241, 245, 249];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc.lastAutoTable?.finalY || y) + 5;

      /* ── Section 4 : Top articles vendus ── */
      if (metrics.productRows.length > 0) {
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK);
        doc.text('TOP ARTICLES VENDUS', 14, y); y += 3;

        autoTable(doc, {
          startY: y,
          head: [['Article', 'Qté', 'CA', '% CA ventes']],
          body: metrics.productRows.slice(0, 15).map(([name, v]) => [
            name,
            String(v.qty),
            formatCurrency(v.total),
            salesTotal > 0 ? `${((v.total / salesTotal) * 100).toFixed(1)}%` : '0%',
          ]),
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: BLUE, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [241, 245, 249] },
          columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right' } },
          margin: { left: 14, right: 14 },
        });
        y = (doc.lastAutoTable?.finalY || y) + 5;
      }

      /* ── Section 5 : Journal des ventes ── */
      if (sales.length > 0) {
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK);
        doc.text(`JOURNAL DES VENTES PRODUITS (${sales.length} ticket${sales.length > 1 ? 's' : ''})`, 14, y); y += 3;

        const salesRows = [];
        sales.forEach(s => {
          const items = parseItems(s.items);
          const { cash, card } = extractPayments(s, 'total');
          salesRows.push([
            { content: fmtTime(s.created_date), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: s.sale_number || '—', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            { content: s.client_name || 'Passager', styles: { fillColor: [241, 245, 249] } },
            { content: cash > 0 && card > 0 ? 'Mixte' : cash > 0 ? 'Espèces' : 'Carte', styles: { fillColor: [241, 245, 249] } },
            { content: s.discount_total > 0 ? `-${formatCurrency(s.discount_total)}` : '—', styles: { fillColor: [241, 245, 249], textColor: AMBER } },
            { content: formatCurrency(s.total || 0), styles: { fontStyle: 'bold', halign: 'right', textColor: BLUE, fillColor: [241, 245, 249] } },
          ]);
          items.forEach(it => {
            salesRows.push([
              '',
              { content: '  > ' + (it.product_name || '-'), colSpan: 2, styles: { fontSize: 7, textColor: GRAY } },
              '',
              { content: `×${it.quantity}`, styles: { fontSize: 7, halign: 'center', textColor: GRAY } },
              { content: `@${formatCurrency(it.unit_price || 0)}`, styles: { fontSize: 7, halign: 'right', textColor: GRAY } },
              { content: formatCurrency(it.total || 0), styles: { fontSize: 7, halign: 'right', textColor: GRAY } },
            ]);
          });
        });

        autoTable(doc, {
          startY: y,
          head: [['Heure', 'Ticket #', 'Client', 'Mode', 'Remise', 'Montant']],
          body: salesRows,
          styles: { fontSize: 8, cellPadding: 2.2 },
          headStyles: { fillColor: DARK, textColor: 255, fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 12 }, 1: { cellWidth: 22 }, 2: { cellWidth: 'auto' },
            3: { cellWidth: 16 }, 4: { halign: 'right', cellWidth: 20 }, 5: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
          },
          foot: [['', '', '', '', 'TOTAL VENTES', formatCurrency(salesTotal)]],
          footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: DARK },
          margin: { left: 14, right: 14 },
        });
        y = (doc.lastAutoTable?.finalY || y) + 5;
      }

      /* ── Section 6 : Réparations ── */
      if (repairs.length > 0) {
        if (y > 240) { doc.addPage(); y = 15; }
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK);
        doc.text(`RÉPARATIONS ENCAISSÉES (${repairs.length})`, 14, y); y += 3;

        autoTable(doc, {
          startY: y,
          head: [['Ticket', 'Client', 'Appareil', 'Technicien', 'Mode', 'Montant']],
          body: repairs.map(r => {
            const { cash, card } = extractPayments(r, 'final_cost');
            return [
              r.ticket_number || '—',
              r.client_name || '—',
              `${r.device_brand || ''} ${r.device_model || ''}`.trim() || '—',
              r.assigned_to || '—',
              cash > 0 && card > 0 ? 'Mixte' : cash > 0 ? 'Espèces' : 'Carte',
              formatCurrency(r.final_cost || 0),
            ];
          }),
          styles: { fontSize: 8, cellPadding: 2.2 },
          headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: { 5: { halign: 'right', fontStyle: 'bold', textColor: BLUE } },
          foot: [['', '', '', '', 'TOTAL RÉPARATIONS', formatCurrency(repairTotal)]],
          footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: DARK },
          margin: { left: 14, right: 14 },
        });
        y = (doc.lastAutoTable?.finalY || y) + 5;
      }

      /* ── Section 7 : Services ── */
      if (serviceSales.length > 0) {
        if (y > 240) { doc.addPage(); y = 15; }
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK);
        doc.text(`SERVICES VENDUS (${serviceSales.length})`, 14, y); y += 3;

        autoTable(doc, {
          startY: y,
          head: [['Service', 'Client', 'Qté', 'Mode', 'Montant']],
          body: serviceSales.map(ss => {
            const { cash, card } = extractPayments(ss, 'total');
            return [
              ss.service_name || '—',
              ss.client_name || '—',
              String(ss.quantity || 1),
              cash > 0 && card > 0 ? 'Mixte' : cash > 0 ? 'Espèces' : 'Carte',
              formatCurrency(ss.total || 0),
            ];
          }),
          styles: { fontSize: 8, cellPadding: 2.2 },
          headStyles: { fillColor: [109, 40, 217], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [250, 248, 255] },
          columnStyles: { 2: { halign: 'center' }, 4: { halign: 'right', fontStyle: 'bold', textColor: BLUE } },
          foot: [['', '', '', 'TOTAL SERVICES', formatCurrency(serviceTotal)]],
          footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: DARK },
          margin: { left: 14, right: 14 },
        });
        y = (doc.lastAutoTable?.finalY || y) + 5;
      }

      /* ── Section 8 : Dépenses ── */
      if (expenses.length > 0) {
        if (y > 240) { doc.addPage(); y = 15; }
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...RED);
        doc.text('DÉPENSES / SORTIES DE CAISSE', 14, y); y += 3;

        autoTable(doc, {
          startY: y,
          head: [['Description', 'Date', 'Montant']],
          body: metrics.expenses.map(e => [
            e.description || '—',
            fmtDate(e.date || e.created_date),
            `-${formatCurrency(e.amount || 0)}`,
          ]),
          styles: { fontSize: 8, cellPadding: 2.2 },
          headStyles: { fillColor: RED, textColor: 255 },
          columnStyles: { 2: { halign: 'right', fontStyle: 'bold', textColor: RED } },
          foot: [['', 'TOTAL DÉPENSES', `-${formatCurrency(metrics.totalExpenses)}`]],
          footStyles: { fillColor: [255, 241, 242], fontStyle: 'bold', textColor: RED },
          margin: { left: 14, right: 14 },
        });
        y = (doc.lastAutoTable?.finalY || y) + 5;
      }

      /* ── Section 9 : Récapitulatif clôture ── */
      if (y > 230) { doc.addPage(); y = 15; }
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...DARK);
      doc.text('RÉCAPITULATIF DE CLÔTURE', 14, y); y += 3;

      autoTable(doc, {
        startY: y,
        body: [
          ['Fond d\'ouverture',          formatCurrency(openingBalance)],
          ['+ Total espèces encaissées', formatCurrency(allCash)],
          ['- Dépenses en espèces',      `-${formatCurrency(metrics.totalExpenses)}`],
          ['= SOLDE ESPÈCES ATTENDU',    formatCurrency(expectedCashBalance)],
          ['Solde réel (clôture)',        register.closing_balance != null ? formatCurrency(register.closing_balance) : 'Non renseigné'],
          ['Écart de caisse',             register.difference != null ? formatCurrency(register.difference) : '—'],
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { cellWidth: 80 }, 1: { fontStyle: 'bold', halign: 'right', cellWidth: 40 } },
        didParseCell(data) {
          if (data.row.index === 3) {
            data.cell.styles.fillColor = BLUE;
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 10;
          }
          if (data.row.index === 2 || data.row.index === 5) data.cell.styles.textColor = RED;
        },
        margin: { left: 14, right: 14 },
      });
      y = (doc.lastAutoTable?.finalY || y) + 15;

      /* ── Zone signature ── */
      if (y > 260) { doc.addPage(); y = 15; }
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...GRAY);
      doc.text('SIGNATURE DU RESPONSABLE', 14, y);
      doc.text("CACHET DE L'ÉTABLISSEMENT", 152, y);
      doc.setDrawColor(203, 213, 225);
      doc.line(14, y + 14, 70, y + 14);
      doc.rect(152, y + 4, 32, 18);

      doc.save(`Session_Caisse_${register.date}.pdf`);
      toast.success('Rapport PDF généré avec succès');
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Erreur lors de la génération du PDF');
    }
  };

  /* ── 4. Render ──────────────────────────────────────────────── */
  const {
    sales, expenses, repairs, serviceSales,
    salesTotal, salesDiscounts, repairTotal, serviceTotal,
    totalRevenue, allCash, allCard, totalExpenses,
    nbTransactions, avgTicket, expectedCashBalance,
    productRows,
  } = metrics;

  const isLoading = loadSales;

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">

        {/* ─── Titre ─────────────────────────────────────────── */}
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Receipt className="h-5 w-5 text-primary" />
              <div>
                <p className="text-base">Rapport de session — {register.date}</p>
                <p className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                  Ouverture : {formatCurrency(register.opening_balance || 0)}
                  &nbsp;·&nbsp;<StatusBadge status={register.status} />
                  {register.opened_by && <>&nbsp;·&nbsp;{register.opened_by}</>}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleGeneratePDF} className="gap-2 shrink-0">
              <FileText className="h-4 w-4" /> Générer PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">

          {/* ─── KPIs chiffre d'affaires ────────────────────── */}
          <div>
            <SectionTitle icon={BarChart3}>Chiffre d'affaires — toutes sources</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <KpiCard label="Ventes produits" value={formatCurrency(salesTotal)}
                sub={`${sales.length} ticket${sales.length > 1 ? 's' : ''}`}
                icon={ShoppingCart} color="text-blue-600" />
              <KpiCard label="Réparations" value={formatCurrency(repairTotal)}
                sub={`${repairs.length} dossier${repairs.length > 1 ? 's' : ''}`}
                icon={Wrench} color="text-slate-600" />
              <KpiCard label="Services" value={formatCurrency(serviceTotal)}
                sub={`${serviceSales.length} vente${serviceSales.length > 1 ? 's' : ''}`}
                icon={Zap} color="text-violet-600" />
              <KpiCard label="CA TOTAL" value={formatCurrency(totalRevenue)}
                sub={`${nbTransactions} transactions`}
                icon={TrendingUp} color="text-primary" bg="bg-primary/5 border-primary/20" />
            </div>
          </div>

          {/* ─── Modes de paiement ──────────────────────────── */}
          <div>
            <SectionTitle icon={CreditCard}>Ventilation par mode de paiement</SectionTitle>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/60 text-xs text-muted-foreground border-b border-border">
                    <th className="text-left px-3 py-2">Mode</th>
                    <th className="text-right px-3 py-2">Ventes</th>
                    <th className="text-right px-3 py-2">Réparations</th>
                    <th className="text-right px-3 py-2">Services</th>
                    <th className="text-right px-3 py-2 font-semibold text-foreground">Total</th>
                    <th className="text-right px-3 py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/30">
                    <td className="px-3 py-2 flex items-center gap-2"><Banknote className="h-3.5 w-3.5 text-green-600" />Espèces</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(metrics.salesCash)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(metrics.repairCash)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(metrics.serviceCash)}</td>
                    <td className="px-3 py-2 text-right font-bold">{formatCurrency(allCash)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                      {totalRevenue > 0 ? `${((allCash / totalRevenue) * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="px-3 py-2 flex items-center gap-2"><CreditCard className="h-3.5 w-3.5 text-blue-600" />Carte</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(metrics.salesCard)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(metrics.repairCard)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(metrics.serviceCard)}</td>
                    <td className="px-3 py-2 text-right font-bold">{formatCurrency(allCard)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                      {totalRevenue > 0 ? `${((allCard / totalRevenue) * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 border-t border-border font-bold">
                    <td className="px-3 py-2 text-xs uppercase tracking-wide">Total</td>
                    <td className="px-3 py-2 text-right text-sm">{formatCurrency(salesTotal)}</td>
                    <td className="px-3 py-2 text-right text-sm">{formatCurrency(repairTotal)}</td>
                    <td className="px-3 py-2 text-right text-sm">{formatCurrency(serviceTotal)}</td>
                    <td className="px-3 py-2 text-right text-primary">{formatCurrency(totalRevenue)}</td>
                    <td className="px-3 py-2 text-right text-xs">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ─── Indicateurs statistiques ───────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KpiCard label="Panier moyen" value={formatCurrency(avgTicket)} icon={Users} />
            <KpiCard label="Remises accordées"
              value={salesDiscounts > 0 ? `-${formatCurrency(salesDiscounts)}` : '—'}
              icon={Tag}
              color={salesDiscounts > 0 ? 'text-amber-600' : 'text-muted-foreground'} />
            <KpiCard label="Dépenses" value={formatCurrency(totalExpenses)}
              icon={ArrowDownCircle} color="text-destructive" />
            <KpiCard label="Résultat net" value={formatCurrency(totalRevenue - totalExpenses)}
              icon={TrendingUp}
              color={(totalRevenue - totalExpenses) >= 0 ? 'text-green-600' : 'text-destructive'} />
          </div>

          {/* ─── Bilan caisse espèces ────────────────────────── */}
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <SectionTitle icon={Banknote}>Bilan caisse espèces (physique)</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-sm">
              <div className="text-muted-foreground">Fond d'ouverture</div>
              <div className="font-semibold">{formatCurrency(register.opening_balance || 0)}</div>
              <div className="text-muted-foreground">Espèces encaissées</div>
              <div className="font-semibold text-green-600">+ {formatCurrency(allCash)}</div>
              <div className="text-muted-foreground">Dépenses espèces</div>
              <div className="font-semibold text-destructive">- {formatCurrency(totalExpenses)}</div>
              <div className="text-muted-foreground font-semibold">Solde attendu</div>
              <div className="font-bold text-primary">{formatCurrency(expectedCashBalance)}</div>
            </div>
            {register.status === 'fermee' && (
              <>
                <Separator className="my-3" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                  <div className="text-muted-foreground">Solde réel (clôture)</div>
                  <div className="font-semibold">{register.closing_balance != null ? formatCurrency(register.closing_balance) : 'N/A'}</div>
                  <div />
                  <div className="text-muted-foreground">Écart de caisse</div>
                  <div className={`font-bold ${(register.difference || 0) !== 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {formatCurrency(register.difference || 0)}
                    {(register.difference || 0) === 0 && ' ✓'}
                  </div>
                  {register.difference_reason && (
                    <div className="text-xs text-amber-600 italic col-span-3">
                      Raison : {register.difference_reason}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ─── Top articles ────────────────────────────────── */}
          {productRows.length > 0 && (
            <div>
              <SectionTitle icon={ShoppingCart}>Articles vendus</SectionTitle>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-xs text-muted-foreground border-b border-border">
                      <th className="text-left px-3 py-2">Article</th>
                      <th className="text-center px-3 py-2">Qté</th>
                      <th className="text-right px-3 py-2">CA</th>
                      <th className="text-right px-3 py-2">% CA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRows.map(([name, v], i) => (
                      <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2">{name}</td>
                        <td className="px-3 py-2 text-center text-muted-foreground">×{v.qty}</td>
                        <td className="px-3 py-2 text-right font-semibold text-primary">{formatCurrency(v.total)}</td>
                        <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                          {salesTotal > 0 ? `${((v.total / salesTotal) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t border-border">
                      <td className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                        {productRows.length} article{productRows.length > 1 ? 's' : ''}
                      </td>
                      <td className="px-3 py-2 text-center text-xs font-semibold">
                        {productRows.reduce((s, [, v]) => s + v.qty, 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-primary">{formatCurrency(salesTotal)}</td>
                      <td className="px-3 py-2 text-right text-xs">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ─── Journal des ventes ──────────────────────────── */}
          <div>
            <SectionTitle icon={ShoppingCart}>
              Journal des ventes ({sales.length})
            </SectionTitle>
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Chargement...</p>
            ) : sales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-xl">
                Aucune vente produit sur cette session
              </p>
            ) : (
              <div className="space-y-2">
                {sales.map(sale => {
                  const items = parseItems(sale.items);
                  const { cash, card } = extractPayments(sale, 'total');
                  const modeLabel = cash > 0 && card > 0 ? '🔀 Mixte' : cash > 0 ? '💵 Espèces' : '💳 Carte';
                  return (
                    <div key={sale.id} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/50">
                        <div className="flex items-center gap-3">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{fmtTime(sale.created_date)}</span>
                          <span className="text-sm font-mono font-bold text-primary">{sale.sale_number || '-'}</span>
                          <span className="text-sm text-muted-foreground">{sale.client_name || 'Passager'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{modeLabel}</Badge>
                          {sale.discount_total > 0 && (
                            <Badge variant="secondary" className="text-xs text-amber-600">
                              -{formatCurrency(sale.discount_total)}
                            </Badge>
                          )}
                          <span className="text-sm font-bold">{formatCurrency(sale.total || 0)}</span>
                        </div>
                      </div>
                      {items.length > 0 && (
                        <div className="px-4 py-2">
                          {items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between py-1 text-sm border-b last:border-0 border-border/30">
                              <span className="text-muted-foreground">{item.product_name} × {item.quantity}</span>
                              <span className="font-medium">{formatCurrency(item.total || 0)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ─── Réparations ────────────────────────────────── */}
          {repairs.length > 0 && (
            <div>
              <SectionTitle icon={Wrench} color="text-slate-700">
                Réparations encaissées ({repairs.length})
              </SectionTitle>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-xs text-muted-foreground border-b border-border">
                      <th className="text-left px-3 py-2">Ticket</th>
                      <th className="text-left px-3 py-2">Client</th>
                      <th className="text-left px-3 py-2">Appareil</th>
                      <th className="text-left px-3 py-2">Technicien</th>
                      <th className="text-center px-3 py-2">Mode</th>
                      <th className="text-right px-3 py-2">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repairs.map(r => {
                      const { cash, card } = extractPayments(r, 'final_cost');
                      const modeLabel = cash > 0 && card > 0 ? '🔀 Mixte' : cash > 0 ? '💵 Espèces' : '💳 Carte';
                      return (
                        <tr key={r.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono font-bold text-xs">{r.ticket_number || '—'}</td>
                          <td className="px-3 py-2">{r.client_name || '—'}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs">
                            {`${r.device_brand || ''} ${r.device_model || ''}`.trim() || '—'}
                          </td>
                          <td className="px-3 py-2 text-xs">{r.assigned_to || '—'}</td>
                          <td className="px-3 py-2 text-center text-xs">{modeLabel}</td>
                          <td className="px-3 py-2 text-right font-bold">{formatCurrency(r.final_cost || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t border-border">
                      <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold uppercase">Total Réparations</td>
                      <td className="px-3 py-2 text-right font-bold text-primary">{formatCurrency(repairTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ─── Services ───────────────────────────────────── */}
          {serviceSales.length > 0 && (
            <div>
              <SectionTitle icon={Zap} color="text-violet-700">
                Services vendus ({serviceSales.length})
              </SectionTitle>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-violet-50 dark:bg-violet-950/30 text-xs text-muted-foreground border-b border-border">
                      <th className="text-left px-3 py-2">Service</th>
                      <th className="text-left px-3 py-2">Client</th>
                      <th className="text-center px-3 py-2">Qté</th>
                      <th className="text-center px-3 py-2">Mode</th>
                      <th className="text-right px-3 py-2">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceSales.map(ss => {
                      const { cash, card } = extractPayments(ss, 'total');
                      const modeLabel = cash > 0 && card > 0 ? '🔀 Mixte' : cash > 0 ? '💵 Espèces' : '💳 Carte';
                      return (
                        <tr key={ss.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                          <td className="px-3 py-2 font-medium">{ss.service_name || '—'}</td>
                          <td className="px-3 py-2">{ss.client_name || '—'}</td>
                          <td className="px-3 py-2 text-center">×{ss.quantity || 1}</td>
                          <td className="px-3 py-2 text-center text-xs">{modeLabel}</td>
                          <td className="px-3 py-2 text-right font-bold">{formatCurrency(ss.total || 0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/30 border-t border-border">
                      <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold uppercase">Total Services</td>
                      <td className="px-3 py-2 text-right font-bold text-primary">{formatCurrency(serviceTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ─── Dépenses ────────────────────────────────────── */}
          {expenses.length > 0 && (
            <div>
              <SectionTitle icon={ArrowDownCircle} color="text-destructive">
                Dépenses / Sorties de caisse ({expenses.length})
              </SectionTitle>
              <div className="space-y-1.5">
                {expenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 text-sm">
                    <div>
                      <span>{e.description}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{fmtDate(e.date || e.created_date)}</span>
                    </div>
                    <span className="font-medium text-destructive">-{formatCurrency(e.amount || 0)}</span>
                  </div>
                ))}
                <div className="flex justify-end pt-1">
                  <span className="text-sm font-bold text-destructive">Total : -{formatCurrency(totalExpenses)}</span>
                </div>
              </div>
            </div>
          )}

        </div>{/* end space-y-5 */}

        {/* ─── Print styles ────────────────────────────────── */}
        <style>{`
          @media print {
            @page { size: portrait; margin: 0.5in; }
            body { margin:0; padding:0; background:white !important; visibility:hidden !important; }
            #root { display:none !important; }
            [role="dialog"] {
              visibility:visible !important; position:absolute !important;
              left:0 !important; top:0 !important; width:100% !important;
              margin:0 !important; padding:0 !important;
              border:none !important; box-shadow:none !important; background:white !important;
            }
            .print-content, .print-content * { visibility:visible !important; display:block !important; }
            table { display:table !important; width:100% !important; }
            thead { display:table-header-group !important; }
            tr { display:table-row !important; }
            th, td { display:table-cell !important; }
            .print\\:hidden { display:none !important; }
            button { display:none !important; }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
