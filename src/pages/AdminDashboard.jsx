import React, { useState, useEffect } from 'react';
import { fixitFetch } from '@/api/fixitFetch';
import { Store, Users, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Plus, LogIn, Trash2, Settings, Crown } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  trial:     { label: 'Essai', color: 'bg-blue-100 text-blue-700' },
  active:    { label: 'Actif', color: 'bg-green-100 text-green-700' },
  suspended: { label: 'Suspendu', color: 'bg-red-100 text-red-700' },
  demo:      { label: 'Démo', color: 'bg-purple-100 text-purple-700' },
};

const PLAN_CONFIG = {
  starter:    { label: 'Starter', color: 'bg-gray-100 text-gray-700' },
  pro:        { label: 'Pro', color: 'bg-blue-100 text-blue-700' },
  enterprise: { label: 'Enterprise', color: 'bg-amber-100 text-amber-700' },
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-4">
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editShop, setEditShop] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showCreateDemo, setShowCreateDemo] = useState(false);
  const [demoForm, setDemoForm] = useState({ shop_name: '', email: '', full_name: '', password: 'demo123' });

  const loadShops = async () => {
    setLoading(true);
    try {
      const data = await fixitFetch('/admin/shops');
      setShops(data);
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadShops(); }, []);

  const stats = {
    total: shops.length,
    trial: shops.filter(s => s.subscription_status === 'trial').length,
    active: shops.filter(s => s.subscription_status === 'active').length,
    suspended: shops.filter(s => s.subscription_status === 'suspended').length,
  };

  const getDaysLeft = (shop) => {
    if (!shop.trial_ends_at) return null;
    const diff = Math.ceil((new Date(shop.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const handleSaveSubscription = async () => {
    try {
      await fixitFetch(`/admin/shops/${editShop.id}/subscription`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      toast.success('Abonnement mis à jour');
      setEditShop(null);
      loadShops();
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleImpersonate = async (userId) => {
    try {
      const data = await fixitFetch(`/admin/impersonate/${userId}`, { method: 'POST' });
      localStorage.setItem('fixit_admin_token', localStorage.getItem('fixit_token'));
      localStorage.setItem('fixit_token', data.token);
      window.location.href = '/';
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleCreateDemo = async () => {
    try {
      await fixitFetch('/admin/shops/demo', {
        method: 'POST',
        body: JSON.stringify(demoForm),
      });
      toast.success('Boutique démo créée');
      setShowCreateDemo(false);
      setDemoForm({ shop_name: '', email: '', full_name: '', password: 'demo123' });
      loadShops();
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
  };

  const handleDelete = async (shopId, shopName) => {
    if (!confirm(`Supprimer la boutique "${shopName}" ? Cette action est irréversible.`)) return;
    try {
      await fixitFetch(`/admin/shops/${shopId}`, { method: 'DELETE' });
      toast.success('Boutique supprimée');
      loadShops();
    } catch (err) {
      toast.error('Erreur: ' + err.message);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
            <Crown className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Super Admin</h1>
            <p className="text-sm text-muted-foreground">Gestion des boutiques et abonnements</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadShops} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
          <button onClick={() => setShowCreateDemo(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium">
            <Plus className="h-4 w-4" /> Boutique démo
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Store} label="Total boutiques" value={stats.total} color="bg-primary/10 text-primary" />
        <StatCard icon={CheckCircle} label="Actives" value={stats.active} color="bg-green-100 text-green-600" />
        <StatCard icon={Clock} label="En essai" value={stats.trial} color="bg-blue-100 text-blue-600" />
        <StatCard icon={XCircle} label="Suspendues" value={stats.suspended} color="bg-red-100 text-red-600" />
      </div>

      {/* Shops table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Boutiques ({shops.length})</h2>
        </div>
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="h-8 w-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : shops.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground">Aucune boutique</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Boutique</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Statut</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Plan</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Essai</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground uppercase">Users</th>
                  <th className="text-right p-4 text-xs font-medium text-muted-foreground uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shops.map(shop => {
                  const daysLeft = getDaysLeft(shop);
                  const admin = shop.users?.find(u => u.role === 'admin');
                  return (
                    <tr key={shop.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-foreground">{shop.name}</p>
                        <p className="text-xs text-muted-foreground">{shop.email || '—'}</p>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[shop.subscription_status]?.color}`}>
                          {STATUS_CONFIG[shop.subscription_status]?.label || shop.subscription_status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_CONFIG[shop.plan]?.color}`}>
                          {PLAN_CONFIG[shop.plan]?.label || shop.plan}
                        </span>
                      </td>
                      <td className="p-4">
                        {shop.subscription_status === 'trial' && daysLeft !== null ? (
                          <span className={`text-sm font-medium ${daysLeft <= 2 ? 'text-destructive' : daysLeft <= 5 ? 'text-orange-500' : 'text-blue-600'}`}>
                            {daysLeft > 0 ? `${daysLeft}j restants` : 'Expiré'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{shop.users?.length || 0}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          {admin && (
                            <button onClick={() => handleImpersonate(admin.id)} title="Se connecter"
                              className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                              <LogIn className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => { setEditShop(shop); setEditForm({ subscription_status: shop.subscription_status, plan: shop.plan, trial_ends_at: shop.trial_ends_at?.split('T')[0] || '' }); }}
                            title="Gérer abonnement"
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                            <Settings className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(shop.id, shop.name)} title="Supprimer"
                            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
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
      </div>

      {/* Edit subscription modal */}
      {editShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="font-semibold text-foreground mb-4">Gérer l'abonnement — {editShop.name}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Statut</label>
                <select value={editForm.subscription_status} onChange={e => setEditForm(f => ({ ...f, subscription_status: e.target.value }))}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="trial">Essai</option>
                  <option value="active">Actif</option>
                  <option value="suspended">Suspendu</option>
                  <option value="demo">Démo</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Plan</label>
                <select value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              {editForm.subscription_status === 'trial' && (
                <div>
                  <label className="text-sm font-medium text-foreground">Fin d'essai</label>
                  <input type="date" value={editForm.trial_ends_at} onChange={e => setEditForm(f => ({ ...f, trial_ends_at: e.target.value }))}
                    className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              )}
              {editForm.subscription_status === 'active' && (
                <div>
                  <label className="text-sm font-medium text-foreground">Montant (MAD)</label>
                  <input type="number" value={editForm.amount || ''} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} placeholder="150"
                    className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditShop(null)} className="flex-1 h-10 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm">Annuler</button>
                <button onClick={handleSaveSubscription} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium">Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create demo modal */}
      {showCreateDemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <h3 className="font-semibold text-foreground mb-4">Créer une boutique démo</h3>
            <div className="space-y-3">
              {[
                { key: 'shop_name', label: 'Nom boutique', placeholder: 'Tech Repair Casablanca', type: 'text' },
                { key: 'full_name', label: 'Nom admin', placeholder: 'Mohamed Amine', type: 'text' },
                { key: 'email', label: 'Email', placeholder: 'admin@boutique.com', type: 'email' },
                { key: 'password', label: 'Mot de passe', placeholder: 'demo123', type: 'text' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-foreground">{label}</label>
                  <input type={type} value={demoForm[key]} onChange={e => setDemoForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm" />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowCreateDemo(false)} className="flex-1 h-10 rounded-lg border border-border bg-card hover:bg-muted transition-colors text-sm">Annuler</button>
                <button onClick={handleCreateDemo} className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium">Créer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
