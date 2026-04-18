import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAppSettings } from "@/components/settings/SettingsContext";
import {
  LayoutDashboard, Users, ShoppingCart, ShoppingBag, DollarSign,
  Tag, Wrench, Shield, Package, Warehouse, Truck, Receipt,
  FileText, ClipboardList, ScrollText, Bell, Settings, Monitor
} from 'lucide-react';

const APP_PAGES = [
  { page: 'POS', label: 'Caisse POS', icon: Monitor, color: 'bg-emerald-500', text: 'text-white', desc: 'Point de vente' },
  { page: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'bg-blue-500', text: 'text-white', desc: 'Vue d\'ensemble' },
  { page: 'Clients', label: 'Clients', icon: Users, color: 'bg-violet-500', text: 'text-white', desc: 'Gestion clients' },
  { page: 'Sales', label: 'Ventes', icon: ShoppingCart, color: 'bg-orange-500', text: 'text-white', desc: 'Historique ventes' },
  { page: 'Services', label: 'Services', icon: ShoppingBag, color: 'bg-pink-500', text: 'text-white', desc: 'Achat services' },
  { page: 'CashRegister', label: 'Caisse', icon: DollarSign, color: 'bg-yellow-500', text: 'text-white', desc: 'Registre de caisse' },
  { page: 'Promotions', label: 'Promotions', icon: Tag, color: 'bg-red-500', text: 'text-white', desc: 'Codes promo' },
  { page: 'Repairs', label: 'Réparations', icon: Wrench, color: 'bg-amber-600', text: 'text-white', desc: 'Atelier réparation' },
  { page: 'Warranties', label: 'Garanties', icon: Shield, color: 'bg-teal-500', text: 'text-white', desc: 'SAV & garanties' },
  { page: 'Products', label: 'Produits', icon: Package, color: 'bg-cyan-500', text: 'text-white', desc: 'Inventaire' },
  { page: 'StockMovements', label: 'Stock', icon: Warehouse, color: 'bg-slate-500', text: 'text-white', desc: 'Mouvements stock' },
  { page: 'Suppliers', label: 'Fournisseurs', icon: Truck, color: 'bg-indigo-500', text: 'text-white', desc: 'Gestion fournisseurs' },
  { page: 'PurchaseOrders', label: 'Commandes', icon: Receipt, color: 'bg-lime-600', text: 'text-white', desc: 'Commandes achat' },
  { page: 'SupplierInvoices', label: 'Factures', icon: FileText, color: 'bg-rose-500', text: 'text-white', desc: 'Factures fournisseurs' },
  { page: 'Expenses', label: 'Dépenses', icon: ClipboardList, color: 'bg-fuchsia-500', text: 'text-white', desc: 'Charges & dépenses' },
  { page: 'AuditLogs', label: 'Audit', icon: ScrollText, color: 'bg-gray-600', text: 'text-white', desc: 'Journal d\'audit' },
  { page: 'Notifications', label: 'Notifications', icon: Bell, color: 'bg-sky-500', text: 'text-white', desc: 'Alertes & notifs' },
  { page: 'Settings', label: 'Paramètres', icon: Settings, color: 'bg-zinc-600', text: 'text-white', desc: 'Configuration' },
];

export default function Home() {
  const navigate = useNavigate();
  const { settings } = useAppSettings();

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-10 px-6">
      <div className="mb-8 text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3">
          <Wrench className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{settings.shop_name || 'TechRepair Pro'}</h1>
        <p className="text-sm text-muted-foreground mt-1">Sélectionnez une section</p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 max-w-4xl w-full">
        {APP_PAGES.map(({ page, label, icon: Icon, color, text, desc }) => (
          <button
            key={page}
            onClick={() => navigate(createPageUrl(page))}
            className="flex flex-col items-center gap-2 p-4 rounded-2xl hover:bg-muted/60 active:scale-95 transition-all group"
          >
            <div className={`h-14 w-14 rounded-2xl ${color} flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow`}>
              <Icon className={`h-7 w-7 ${text}`} />
            </div>
            <span className="text-xs font-semibold text-foreground text-center leading-tight">{label}</span>
            <span className="text-[10px] text-muted-foreground text-center leading-tight hidden sm:block">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}