import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatCard from "@/components/ui/StatCard";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  DollarSign, ShoppingCart, Wrench, Package, Users,
  TrendingUp, AlertTriangle, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

const COLORS = ['hsl(217,91%,60%)', 'hsl(160,60%,45%)', 'hsl(30,80%,55%)', 'hsl(280,65%,60%)', 'hsl(340,75%,55%)'];

export default function Dashboard() {
  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => base44.entities.Sale.list('-created_date', 100) });
  const { data: repairs = [] } = useQuery({ queryKey: ['repairs'], queryFn: () => base44.entities.Repair.list('-created_date', 100) });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => base44.entities.Product.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list('-created_date', 50) });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list('-created_date', 50) });

  const todaySales = sales.filter(s => s.status === 'completee');
  const totalCA = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const activeRepairs = repairs.filter(r => !['livre', 'annule'].includes(r.status));
  const lowStockProducts = products.filter(p => p.quantity <= (p.min_stock || 2) && p.is_active !== false);

  // Revenue by day (last 7 days)
  const revenueByDay = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const dayStr = format(day, 'yyyy-MM-dd');
    const dayRevenue = todaySales
      .filter(s => s.created_date?.startsWith(dayStr))
      .reduce((sum, s) => sum + (s.total || 0), 0);
    return { name: format(day, 'EEE', { locale: fr }), revenue: dayRevenue };
  });

  // Repairs by status
  const repairsByStatus = repairs.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  const repairPieData = Object.entries(repairsByStatus).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground mt-1">{format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Chiffre d'affaires" value={`${totalCA.toFixed(2)} €`} icon={DollarSign} subtitle="Toutes ventes" />
        <StatCard title="Ventes" value={todaySales.length} icon={ShoppingCart} subtitle="Transactions" />
        <StatCard title="Réparations actives" value={activeRepairs.length} icon={Wrench} subtitle="En cours" />
        <StatCard title="Clients" value={clients.length} icon={Users} subtitle="Total enregistrés" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Revenus (7 derniers jours)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,47%,18%)" />
                <XAxis dataKey="name" stroke="hsl(215,20%,55%)" fontSize={12} />
                <YAxis stroke="hsl(215,20%,55%)" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(222,47%,10%)', border: '1px solid hsl(222,47%,18%)', borderRadius: 8 }}
                  labelStyle={{ color: 'hsl(210,40%,98%)' }}
                />
                <Bar dataKey="revenue" fill="hsl(217,91%,60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Réparations par statut</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={repairPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {repairPieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(222,47%,10%)', border: '1px solid hsl(222,47%,18%)', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2">
              {repairPieData.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <StatusBadge status={entry.name} />
                  <span className="text-muted-foreground">({entry.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts & Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock Alerts */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertes Stock Bas ({lowStockProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune alerte</p>
              ) : lowStockProducts.slice(0, 10).map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.brand} {p.model}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-destructive">{p.quantity} en stock</p>
                    <p className="text-xs text-muted-foreground">Min: {p.min_stock || 2}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Repairs */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Réparations récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {repairs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune réparation</p>
              ) : repairs.slice(0, 10).map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{r.ticket_number || 'Sans ticket'}</p>
                    <p className="text-xs text-muted-foreground">{r.client_name} — {r.device_brand} {r.device_model}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}