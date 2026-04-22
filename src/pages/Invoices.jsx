import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fixit } from '@/api/fixitClient';
import { fixitFetch } from '@/api/fixitFetch';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import {
  FileText, Plus, Printer, Eye, Trash2, Search, X, Check,
  PlusCircle, Minus, Building2, User, ChevronRight, Download,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// ─── French number to words ───────────────────────────────────────────────────
const UNITS  = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
                 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
                 'dix-sept', 'dix-huit', 'dix-neuf'];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante',
                  'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function centaines(n) {
  if (n === 0) return '';
  if (n < 20) return UNITS[n];
  const d = Math.floor(n / 10), u = n % 10;
  if (d === 7 || d === 9) {
    const base = DIZAINES[d];
    const rest = UNITS[10 + u];
    return u === 0 ? base + (d === 9 ? 's' : '') : base + '-' + rest;
  }
  if (d === 8) return u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + UNITS[u];
  return DIZAINES[d] + (u === 1 && d !== 8 ? '-et-un' : u ? '-' + UNITS[u] : '');
}

function infoCentaines(n) {
  if (n === 0) return '';
  const c = Math.floor(n / 100), r = n % 100;
  if (c === 0) return centaines(r);
  const prefC = c === 1 ? '' : UNITS[c] + '-';
  const suffC = r === 0 && c > 1 ? 'cents' : 'cent';
  return prefC + suffC + (r ? '-' + centaines(r) : '');
}

function nombreEnLettres(n, devise = 'Dinars', deviseSingulier = 'Dinar', centimes = 'Millimes') {
  if (isNaN(n) || n < 0) return '';
  const entier = Math.floor(n);
  const dec    = Math.round((n - entier) * 1000); // millimes (3 décimales)

  function groupe(x) {
    if (x === 0) return '';
    if (x < 100) return infoCentaines(x);
    return infoCentaines(x);
  }

  function grand(x) {
    if (x === 0) return 'zéro';
    const parts = [];
    const milliard = Math.floor(x / 1_000_000_000);
    const million  = Math.floor((x % 1_000_000_000) / 1_000_000);
    const mille    = Math.floor((x % 1_000_000) / 1_000);
    const reste    = x % 1_000;

    if (milliard) parts.push(groupe(milliard) + ' milliard' + (milliard > 1 ? 's' : ''));
    if (million)  parts.push(groupe(million)  + ' million'  + (million  > 1 ? 's' : ''));
    if (mille === 1) parts.push('mille');
    else if (mille > 1) parts.push(groupe(mille) + ' mille');
    if (reste)    parts.push(groupe(reste));
    return parts.join(' ');
  }

  const entierStr = grand(entier);
  const deviseStr = entier > 1 ? devise : deviseSingulier;
  let result = entierStr + ' ' + deviseStr;
  if (dec > 0) result += ' et ' + grand(dec) + ' ' + centimes;
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  brouillon: { label: 'Brouillon',  className: 'bg-gray-100 text-gray-600 border-gray-200' },
  envoyee:   { label: 'Envoyée',    className: 'bg-blue-100 text-blue-700 border-blue-200' },
  payee:     { label: 'Payée',      className: 'bg-green-100 text-green-700 border-green-200' },
  annulee:   { label: 'Annulée',    className: 'bg-red-100 text-red-600 border-red-200' },
};

const PAYMENT_METHODS = [
  { value: 'especes',  label: 'Espèces' },
  { value: 'virement', label: 'Virement bancaire' },
  { value: 'cheque',   label: 'Chèque' },
  { value: 'carte',    label: 'Carte bancaire' },
];

const emptyItem = () => ({ description: '', quantity: 1, unit_price: 0, tax_rate: 19, subtotal_ht: 0, tax_amount: 0, subtotal_ttc: 0 });

const emptyForm = () => ({
  invoice_number: '',
  client_id: '',
  client_name: '', client_address: '', client_phone: '', client_email: '', client_tax_id: '',
  date: new Date().toISOString().slice(0, 10),
  due_date: '',
  status: 'brouillon',
  items: [emptyItem()],
  subtotal_ht: 0, tax_amount: 0, total_ttc: 0,
  notes: '',
  payment_method: 'especes',
  footer_text: '',
});

function computeItem(item) {
  const qty    = parseFloat(item.quantity) || 0;
  const up     = parseFloat(item.unit_price) || 0;
  const tax    = parseFloat(item.tax_rate) || 0;
  const ht     = qty * up;
  const taxAmt = ht * tax / 100;
  return { ...item, subtotal_ht: ht, tax_amount: taxAmt, subtotal_ttc: ht + taxAmt };
}

function computeTotals(items) {
  const computed = items.map(computeItem);
  const subtotal_ht = computed.reduce((s, i) => s + i.subtotal_ht, 0);
  const tax_amount  = computed.reduce((s, i) => s + i.tax_amount,  0);
  const total_ttc   = subtotal_ht + tax_amount;
  return { items: computed, subtotal_ht, tax_amount, total_ttc };
}

// ─── Invoice print / PDF ───────────────────────────────────────────────────────
function generatePDF(invoice, settings) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const W = 210, marginL = 14, marginR = 14;
  const colW = W - marginL - marginR;
  const sym  = settings.currency_symbol || 'DT';
  const fmt  = (n) => `${(+n || 0).toFixed(3)} ${sym}`;

  // Colors
  const PRIMARY  = [37, 99, 235];   // blue-600
  const DARKBG   = [30, 41, 59];    // slate-800
  const LIGHTBG  = [241, 245, 249]; // slate-100
  const TEXTDARK = [15, 23, 42];
  const TEXTGRAY = [100, 116, 139];

  let y = 0;

  // ── Header band ──
  doc.setFillColor(...DARKBG);
  doc.rect(0, 0, W, 45, 'F');

  // Logo placeholder / text
  if (settings.shop_logo) {
    try { doc.addImage(settings.shop_logo, 'JPEG', marginL, 8, 28, 28); } catch (_) {}
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text(settings.shop_name || 'Ma Boutique', marginL + 32, 18);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    if (settings.shop_phone)   doc.text(`Tél : ${settings.shop_phone}`,   marginL + 32, 25);
    if (settings.shop_email)   doc.text(`Email : ${settings.shop_email}`, marginL + 32, 30);
    if (settings.shop_address) doc.text(settings.shop_address,             marginL + 32, 35);
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(settings.shop_name || 'Ma Boutique', marginL, 20);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    if (settings.shop_phone)   doc.text(`Tél : ${settings.shop_phone}`,   marginL, 28);
    if (settings.shop_email)   doc.text(`Email : ${settings.shop_email}`, marginL, 33);
    if (settings.shop_address) doc.text(settings.shop_address,             marginL, 38);
  }

  // FACTURE title + number
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.text('FACTURE', W - marginR, 18, { align: 'right' });
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number || '', W - marginR, 26, { align: 'right' });
  doc.setFontSize(8);
  doc.text(`Date : ${invoice.date || ''}`, W - marginR, 32, { align: 'right' });
  if (invoice.due_date) doc.text(`Échéance : ${invoice.due_date}`, W - marginR, 37, { align: 'right' });

  y = 52;

  // ── Client block ──
  doc.setFillColor(...LIGHTBG);
  doc.roundedRect(marginL, y, colW * 0.55, 36, 2, 2, 'F');
  doc.setTextColor(...TEXTDARK);
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('FACTURÉ À', marginL + 4, y + 7);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXTGRAY);
  const cLines = [
    invoice.client_name,
    invoice.client_address,
    invoice.client_phone ? `Tél : ${invoice.client_phone}` : null,
    invoice.client_email ? `Email : ${invoice.client_email}` : null,
    invoice.client_tax_id ? `MF / ICE : ${invoice.client_tax_id}` : null,
  ].filter(Boolean);
  cLines.forEach((l, i) => {
    doc.setTextColor(...(i === 0 ? TEXTDARK : TEXTGRAY));
    if (i === 0) doc.setFont('helvetica', 'bold');
    else doc.setFont('helvetica', 'normal');
    doc.text(l, marginL + 4, y + 13 + i * 5);
  });

  // Status badge
  const stCfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.brouillon;
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(W - marginR - 38, y, 38, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text(stCfg.label.toUpperCase(), W - marginR - 19, y + 8, { align: 'center' });

  y += 44;

  // ── Items table ──
  const tableData = (invoice.items || []).map(item => [
    item.description,
    String(item.quantity),
    fmt(item.unit_price),
    `${item.tax_rate}%`,
    fmt(item.subtotal_ht),
    fmt(item.subtotal_ttc),
  ]);

  doc.autoTable({
    startY: y,
    margin: { left: marginL, right: marginR },
    head: [['Description', 'Qté', 'P.U. HT', 'TVA', 'Total HT', 'Total TTC']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 3, textColor: TEXTDARK },
    headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHTBG },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 14 },
      2: { halign: 'right',  cellWidth: 28 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'right',  cellWidth: 28 },
      5: { halign: 'right',  cellWidth: 30 },
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── Totals block ──
  const totW = 75;
  const totX = W - marginR - totW;

  const rows = [
    ['Sous-total HT', fmt(invoice.subtotal_ht)],
    [`TVA`, fmt(invoice.tax_amount)],
  ];
  rows.forEach(([lbl, val], i) => {
    doc.setFillColor(i % 2 === 0 ? 248 : 241, i % 2 === 0 ? 250 : 245, i % 2 === 0 ? 252 : 249);
    doc.rect(totX, y + i * 8, totW, 8, 'F');
    doc.setTextColor(...TEXTGRAY); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(lbl, totX + 3, y + i * 8 + 5.5);
    doc.setTextColor(...TEXTDARK);
    doc.text(val, W - marginR - 2, y + i * 8 + 5.5, { align: 'right' });
  });

  // Total TTC row
  const ttcY = y + rows.length * 8;
  doc.setFillColor(...PRIMARY);
  doc.rect(totX, ttcY, totW, 10, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  doc.text('TOTAL TTC', totX + 3, ttcY + 7);
  doc.text(fmt(invoice.total_ttc), W - marginR - 2, ttcY + 7, { align: 'right' });

  y = ttcY + 18;

  // ── Total en lettres ──
  const currName = settings.currency === 'TND' ? 'Dinars' : (settings.currency || 'Dinars');
  const centName = settings.currency === 'TND' ? 'Millimes' : 'Centimes';
  const inWords = nombreEnLettres(invoice.total_ttc, currName, currName.replace(/s$/, ''), centName);
  doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(...TEXTGRAY);
  doc.text('Arrêtée la présente facture à la somme de :', marginL, y);
  doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXTDARK);
  const wrappedWords = doc.splitTextToSize(`${inWords}`, colW);
  doc.text(wrappedWords, marginL, y + 5);
  y += 5 + wrappedWords.length * 5 + 6;

  // ── Notes ──
  if (invoice.notes) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...TEXTDARK);
    doc.text('Notes :', marginL, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXTGRAY);
    const noteLines = doc.splitTextToSize(invoice.notes, colW);
    doc.text(noteLines, marginL, y + 5);
    y += 5 + noteLines.length * 5 + 4;
  }

  // ── Payment method ──
  if (invoice.payment_method) {
    const pm = PAYMENT_METHODS.find(p => p.value === invoice.payment_method);
    doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXTGRAY);
    doc.text(`Mode de règlement : ${pm?.label || invoice.payment_method}`, marginL, y);
    y += 6;
  }

  // ── Footer ──
  const footerY = 285;
  doc.setDrawColor(...LIGHTBG);
  doc.setLineWidth(0.3);
  doc.line(marginL, footerY - 4, W - marginR, footerY - 4);
  doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXTGRAY);
  const footerTxt = invoice.footer_text || settings.receipt_footer || 'Merci de votre confiance.';
  doc.text(footerTxt, W / 2, footerY, { align: 'center' });

  return doc;
}

// ─── Invoice Preview (HTML) ────────────────────────────────────────────────────
function InvoicePreview({ invoice, settings, onClose }) {
  const sym = settings.currency_symbol || 'DT';
  const fmt = (n) => `${(+n || 0).toFixed(3)} ${sym}`;
  const stCfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.brouillon;
  const currName = settings.currency === 'TND' ? 'Dinars' : (settings.currency || 'Dinars');
  const centName = settings.currency === 'TND' ? 'Millimes' : 'Centimes';

  const handlePrint = () => {
    const doc = generatePDF(invoice, settings);
    doc.save(`${invoice.invoice_number || 'facture'}.pdf`);
    toast.success('PDF généré');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden text-slate-900">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white">
          <span className="font-semibold text-sm">Aperçu facture — {invoice.invoice_number}</span>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium transition-colors">
              <Download className="h-3.5 w-3.5" />Télécharger PDF
            </button>
            <button onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Invoice body */}
        <div className="p-8 font-sans" style={{ fontFamily: 'system-ui, sans-serif' }}>
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              {settings.shop_logo && (
                <img src={settings.shop_logo} alt="logo" className="h-14 mb-2 object-contain" />
              )}
              <h2 className="text-xl font-bold text-slate-800">{settings.shop_name}</h2>
              {settings.shop_address && <p className="text-xs text-slate-500 mt-0.5">{settings.shop_address}</p>}
              {settings.shop_phone   && <p className="text-xs text-slate-500">Tél : {settings.shop_phone}</p>}
              {settings.shop_email   && <p className="text-xs text-slate-500">{settings.shop_email}</p>}
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-extrabold text-blue-600 tracking-wide">FACTURE</h1>
              <p className="text-sm font-bold text-slate-700 mt-1">{invoice.invoice_number}</p>
              <p className="text-xs text-slate-500">Date : {invoice.date}</p>
              {invoice.due_date && <p className="text-xs text-slate-500">Échéance : {invoice.due_date}</p>}
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold border ${stCfg.className}`}>
                {stCfg.label}
              </span>
            </div>
          </div>

          {/* Client */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6 w-72">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Facturé à</p>
            <p className="font-bold text-slate-800">{invoice.client_name}</p>
            {invoice.client_address && <p className="text-xs text-slate-500 mt-0.5">{invoice.client_address}</p>}
            {invoice.client_phone   && <p className="text-xs text-slate-500">Tél : {invoice.client_phone}</p>}
            {invoice.client_email   && <p className="text-xs text-slate-500">{invoice.client_email}</p>}
            {invoice.client_tax_id  && <p className="text-xs text-slate-500">MF / ICE : {invoice.client_tax_id}</p>}
          </div>

          {/* Items table */}
          <table className="w-full text-xs mb-6 border-collapse">
            <thead>
              <tr className="bg-blue-600 text-white">
                <th className="text-left px-3 py-2 rounded-tl-lg">Description</th>
                <th className="text-center px-2 py-2 w-12">Qté</th>
                <th className="text-right px-2 py-2 w-24">P.U. HT</th>
                <th className="text-center px-2 py-2 w-14">TVA</th>
                <th className="text-right px-2 py-2 w-24">Total HT</th>
                <th className="text-right px-3 py-2 w-24 rounded-tr-lg">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-3 py-2 text-slate-700">{item.description}</td>
                  <td className="px-2 py-2 text-center">{item.quantity}</td>
                  <td className="px-2 py-2 text-right">{fmt(item.unit_price)}</td>
                  <td className="px-2 py-2 text-center">{item.tax_rate}%</td>
                  <td className="px-2 py-2 text-right">{fmt(item.subtotal_ht)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(item.subtotal_ttc)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-4">
            <div className="w-64">
              <div className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Sous-total HT</span>
                <span className="font-medium">{fmt(invoice.subtotal_ht)}</span>
              </div>
              <div className="flex justify-between text-xs py-1.5 border-b border-slate-100">
                <span className="text-slate-500">TVA</span>
                <span className="font-medium">{fmt(invoice.tax_amount)}</span>
              </div>
              <div className="flex justify-between py-2.5 bg-blue-600 rounded-lg px-3 mt-2">
                <span className="text-white text-sm font-bold">TOTAL TTC</span>
                <span className="text-white text-sm font-bold">{fmt(invoice.total_ttc)}</span>
              </div>
            </div>
          </div>

          {/* Total en lettres */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-xs text-slate-600 italic">
            Arrêtée la présente facture à la somme de :{' '}
            <span className="font-semibold not-italic text-slate-800">
              {nombreEnLettres(invoice.total_ttc, currName, currName.replace(/s$/, ''), centName)}
            </span>
          </div>

          {/* Notes & payment */}
          {invoice.notes && (
            <div className="text-xs text-slate-500 mb-3">
              <span className="font-semibold text-slate-700">Notes : </span>{invoice.notes}
            </div>
          )}
          {invoice.payment_method && (
            <div className="text-xs text-slate-500 mb-4">
              <span className="font-semibold text-slate-700">Mode de règlement : </span>
              {PAYMENT_METHODS.find(p => p.value === invoice.payment_method)?.label || invoice.payment_method}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
            {invoice.footer_text || settings.receipt_footer || 'Merci de votre confiance.'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function Invoices() {
  const { settings } = useAppSettings();
  const sym = settings.currency_symbol || 'DT';
  const fmt = (n) => `${(+n || 0).toFixed(3)} ${sym}`;
  const qc  = useQueryClient();

  const [search,      setSearch]      = useState('');
  const [dialogOpen,  setDialogOpen]  = useState(false);
  const [previewInv,  setPreviewInv]  = useState(null);
  const [form,        setForm]        = useState(emptyForm());
  const [editing,     setEditing]     = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => fixit.entities.Invoice.list('-created_date'),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => fixit.entities.Client.list(),
  });

  const openNew = async () => {
    const f = emptyForm();
    try {
      const res = await fixitFetch('/functions/nextInvoiceNumber', {
        method: 'POST',
        body: JSON.stringify({ prefix: 'FAC' }),
      });
      f.invoice_number = res.invoice_number;
    } catch (_) { f.invoice_number = `FAC-${Date.now().toString(36).toUpperCase()}`; }
    if (settings.receipt_footer) f.footer_text = settings.receipt_footer;
    setForm(f);
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (inv) => {
    setForm({ ...inv, items: inv.items || [emptyItem()] });
    setEditing(inv);
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm()); };

  // ── Item helpers ──
  const setItem = (idx, key, val) => {
    const updated = form.items.map((it, i) => i === idx ? computeItem({ ...it, [key]: val }) : it);
    const totals = computeTotals(updated);
    setForm(f => ({ ...f, ...totals }));
  };

  const addItem = () => {
    const updated = [...form.items, emptyItem()];
    const totals = computeTotals(updated);
    setForm(f => ({ ...f, ...totals }));
  };

  const removeItem = (idx) => {
    const updated = form.items.filter((_, i) => i !== idx);
    const totals = computeTotals(updated.length ? updated : [emptyItem()]);
    setForm(f => ({ ...f, ...totals }));
  };

  const setClientFromId = (clientId) => {
    const c = clients.find(cl => cl.id === clientId);
    if (!c) return;
    setForm(f => ({
      ...f,
      client_id: clientId,
      client_name:    c.name        || '',
      client_address: c.address     || '',
      client_phone:   c.phone       || '',
      client_email:   c.email       || '',
      client_tax_id:  c.tax_id      || '',
    }));
  };

  // ── Save ──
  const saveMutation = useMutation({
    mutationFn: (data) => editing
      ? fixit.entities.Invoice.update(editing.id, data)
      : fixit.entities.Invoice.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      toast.success(editing ? 'Facture mise à jour' : 'Facture créée');
      closeDialog();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!form.client_name) { toast.error('Le nom du client est requis'); return; }
    const totals = computeTotals(form.items);
    saveMutation.mutate({ ...form, ...totals });
  };

  // ── Delete ──
  const deleteMutation = useMutation({
    mutationFn: (id) => fixit.entities.Invoice.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); toast.success('Facture supprimée'); },
  });

  const filtered = invoices.filter(inv =>
    !search || (inv.invoice_number + ' ' + inv.client_name).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Factures" subtitle={`${invoices.length} facture${invoices.length !== 1 ? 's' : ''}`}>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />Nouvelle facture
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher facture ou client…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      {filtered.length === 0 && !isLoading ? (
        <EmptyState icon={FileText} title="Aucune facture" description="Créez votre première facture client" actionLabel="Nouvelle facture" onAction={openNew} />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">N°</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total TTC</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Chargement…</td></tr>
              ) : filtered.map((inv, i) => {
                const stCfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.brouillon;
                return (
                  <tr key={inv.id} className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                    onClick={() => openEdit(inv)}>
                    <td className="px-4 py-3 font-mono text-sm font-medium text-primary">{inv.invoice_number}</td>
                    <td className="px-4 py-3 font-medium">{inv.client_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.date}</td>
                    <td className="px-4 py-3 text-right font-semibold">{fmt(inv.total_ttc)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${stCfg.className}`}>
                        {stCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setPreviewInv(inv)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => {
                          const doc = generatePDF(inv, settings);
                          doc.save(`${inv.invoice_number || 'facture'}.pdf`);
                        }}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                          <Printer className="h-4 w-4" />
                        </button>
                        <button onClick={() => setConfirmState({
                          open: true, title: 'Supprimer cette facture ?',
                          description: `La facture ${inv.invoice_number} sera définitivement supprimée.`,
                          onConfirm: () => { setConfirmState(s => ({ ...s, open: false })); deleteMutation.mutate(inv.id); }
                        })}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create/Edit Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {editing ? `Modifier ${editing.invoice_number}` : 'Nouvelle facture'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Top row: invoice info */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 rounded-xl border border-border/50">
              <div>
                <Label>N° Facture</Label>
                <Input value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))} className="font-mono" />
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>Échéance</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mode de règlement</Label>
                <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(pm => <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Client block */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <User className="h-4 w-4 text-primary" />Informations client
              </div>
              {clients.length > 0 && (
                <div>
                  <Label>Sélectionner un client existant</Label>
                  <Select value={form.client_id} onValueChange={setClientFromId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Nom du client *</Label>
                  <Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Nom complet ou entreprise" />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={form.client_email} onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))} />
                </div>
                <div>
                  <Label>MF / ICE / RNE</Label>
                  <Input value={form.client_tax_id} onChange={e => setForm(f => ({ ...f, client_tax_id: e.target.value }))} placeholder="Identifiant fiscal" />
                </div>
                <div className="col-span-2">
                  <Label>Adresse</Label>
                  <Input value={form.client_address} onChange={e => setForm(f => ({ ...f, client_address: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FileText className="h-4 w-4 text-primary" />Lignes de facturation
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground w-14">Qté</th>
                      <th className="text-right px-2 py-2 font-medium text-muted-foreground w-24">P.U. HT</th>
                      <th className="text-center px-2 py-2 font-medium text-muted-foreground w-16">TVA %</th>
                      <th className="text-right px-2 py-2 font-medium text-muted-foreground w-24">Total TTC</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="px-2 py-1.5">
                          <Input value={item.description} onChange={e => setItem(idx, 'description', e.target.value)}
                            className="h-7 text-xs" placeholder="Description du produit/service" />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input type="number" min="1" value={item.quantity} onChange={e => setItem(idx, 'quantity', e.target.value)}
                            className="h-7 text-xs text-center" />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input type="number" min="0" step="0.001" value={item.unit_price} onChange={e => setItem(idx, 'unit_price', e.target.value)}
                            className="h-7 text-xs text-right" />
                        </td>
                        <td className="px-1 py-1.5">
                          <Input type="number" min="0" max="100" value={item.tax_rate} onChange={e => setItem(idx, 'tax_rate', e.target.value)}
                            className="h-7 text-xs text-center" />
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold text-foreground">
                          {fmt(item.subtotal_ttc)}
                        </td>
                        <td className="px-1 py-1.5">
                          <button onClick={() => removeItem(idx)}
                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="px-3 py-2 bg-muted/20 border-t border-border/50">
                  <button onClick={addItem}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                    <PlusCircle className="h-3.5 w-3.5" />Ajouter une ligne
                  </button>
                </div>
              </div>

              {/* Totals summary */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Sous-total HT</span>
                    <span>{fmt(form.subtotal_ht)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>TVA</span>
                    <span>{fmt(form.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-foreground py-2 border-t border-border">
                    <span>Total TTC</span>
                    <span className="text-primary text-base">{fmt(form.total_ttc)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes & footer */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Notes</Label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} placeholder="Conditions, remarques…"
                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <Label>Pied de page</Label>
                <textarea value={form.footer_text} onChange={e => setForm(f => ({ ...f, footer_text: e.target.value }))}
                  rows={3} placeholder="Merci de votre confiance…"
                  className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-2">
              <button onClick={() => { handleSave(); }} disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/40 hover:bg-muted text-sm text-muted-foreground border border-border transition-colors">
                <Eye className="h-4 w-4" />Aperçu après sauvegarde
              </button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeDialog}>Annuler</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
                  <Check className="h-4 w-4" />
                  {saveMutation.isPending ? 'Sauvegarde…' : editing ? 'Mettre à jour' : 'Créer la facture'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      {previewInv && <InvoicePreview invoice={previewInv} settings={settings} onClose={() => setPreviewInv(null)} />}

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={v => setConfirmState(s => ({ ...s, open: v }))}
        title={confirmState.title}
        description={confirmState.description}
        variant="danger"
        onConfirm={confirmState.onConfirm}
      />
    </div>
  );
}
