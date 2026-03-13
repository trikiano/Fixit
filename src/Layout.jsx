import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { SettingsProvider, useAppSettings } from "@/components/settings/SettingsContext";
import {
  LayoutDashboard, Users, Package, Wrench, ShoppingCart,
  Truck, Shield, DollarSign, Receipt, Tag, Bell,
  ClipboardList, Settings, Menu, X, ChevronDown,
  LogOut, Warehouse, ScrollText, ShoppingBag, Wifi, FileText
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Principal",
    items: [
      { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
    ]
  },
  {
    label: "Commerce",
    items: [
      { name: "Clients", icon: Users, page: "Clients" },
      { name: "Ventes", icon: ShoppingCart, page: "Sales" },
      { name: "Forfaits Internet", icon: Wifi, page: "InternetSales" },
      { name: "Caisse", icon: DollarSign, page: "CashRegister" },
      { name: "Promotions", icon: Tag, page: "Promotions" },
    ]
  },
  {
    label: "Atelier",
    items: [
      { name: "Réparations", icon: Wrench, page: "Repairs" },
      { name: "Garanties & SAV", icon: Shield, page: "Warranties" },
    ]
  },
  {
    label: "Stock & Achats",
    items: [
      { name: "Produits", icon: Package, page: "Products" },
      { name: "Mouvements Stock", icon: Warehouse, page: "StockMovements" },
      { name: "Fournisseurs", icon: Truck, page: "Suppliers" },
      { name: "Commandes Achat", icon: Receipt, page: "PurchaseOrders" },
      { name: "Factures Fournisseurs", icon: FileText, page: "SupplierInvoices" },
    ]
  },
  {
    label: "Administration",
    items: [
      { name: "Dépenses", icon: ClipboardList, page: "Expenses" },
      { name: "Journal Audit", icon: ScrollText, page: "AuditLogs" },
      { name: "Notifications", icon: Bell, page: "Notifications" },
      { name: "Paramètres", icon: Settings, page: "Settings" },
    ]
  }
];

function LayoutInner({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const { settings } = useAppSettings();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const toggleGroup = (label) => {
    setCollapsed(p => ({ ...p, [label]: !p[label] }));
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="h-16 flex items-center px-5 border-b border-border gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Wrench className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">{settings.shop_name || 'TechRepair Pro'}</h1>
            <p className="text-[10px] text-muted-foreground">Gestion Boutique</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          {navGroups.map(group => (
            <div key={group.label} className="mb-2">
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {group.label}
                <ChevronDown className={cn("h-3 w-3 transition-transform", collapsed[group.label] && "-rotate-90")} />
              </button>
              {!collapsed[group.label] && group.items.map(item => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {user && (
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {user.full_name?.[0] || user.email?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{user.full_name || user.email}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user.role || 'user'}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => base44.auth.logout()}>
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border flex items-center px-4 lg:px-6 gap-4 bg-card/50 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Link to={createPageUrl("POS")} title="Caisse POS">
              <Button variant="ghost" size="icon" className="relative bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30">
                <ShoppingBag className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
            </Button>
            <Link to={createPageUrl("Settings")}>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <SettingsProvider>
      <LayoutInner currentPageName={currentPageName}>{children}</LayoutInner>
    </SettingsProvider>
  );
}