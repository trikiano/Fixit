import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import PageHeader from "@/components/ui/PageHeader";
import { Settings, Store, Palette, Globe, Bell, Shield, Receipt, CheckCircle, MessageSquare, Eye, EyeOff } from 'lucide-react';
import { useAppSettings, applyTheme } from "@/components/settings/SettingsContext";

const CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'USD', symbol: '$', label: 'Dollar US ($)' },
  { code: 'GBP', symbol: '£', label: 'Livre Sterling (£)' },
  { code: 'MAD', symbol: 'DH', label: 'Dirham Marocain (DH)' },
  { code: 'DZD', symbol: 'DA', label: 'Dinar Algérien (DA)' },
  { code: 'TND', symbol: 'DT', label: 'Dinar Tunisien (DT)' },
  { code: 'XOF', symbol: 'CFA', label: 'Franc CFA (CFA)' },
  { code: 'CAD', symbol: 'CA$', label: 'Dollar Canadien (CA$)' },
  { code: 'CHF', symbol: 'CHF', label: 'Franc Suisse (CHF)' },
];

const THEMES = [
  { id: 'dark', label: 'Sombre', description: 'Fond foncé, sobre et professionnel' },
  { id: 'light', label: 'Clair', description: 'Fond blanc, lumineux' },
  { id: 'blue', label: 'Bleu profond', description: 'Thème bleu nuit' },
];

const LANGS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

export default function SettingsPage() {
  const { settings, saveSettings } = useAppSettings();
  const [local, setLocal] = useState(settings);
  const [saved, setSaved] = useState(false);

  // Keep local in sync if settings change externally
  useEffect(() => { setLocal(settings); }, [settings]);

  const update = (key, value) => setLocal(p => ({ ...p, [key]: value }));

  const save = () => {
    saveSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const selectedCurrency = CURRENCIES.find(c => c.code === local.currency) || CURRENCIES[0];

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration générale de l'application">
        <Button onClick={save} className="gap-2">
          {saved ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Settings className="h-4 w-4" />}
          {saved ? 'Sauvegardé !' : 'Sauvegarder'}
        </Button>
      </PageHeader>

      <Tabs defaultValue="boutique" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto bg-muted/40 p-1 rounded-xl">
          <TabsTrigger value="boutique" className="gap-2 text-xs"><Store className="h-3.5 w-3.5" />Boutique</TabsTrigger>
          <TabsTrigger value="devise" className="gap-2 text-xs"><Globe className="h-3.5 w-3.5" />Devise & Taxes</TabsTrigger>
          <TabsTrigger value="apparence" className="gap-2 text-xs"><Palette className="h-3.5 w-3.5" />Apparence</TabsTrigger>
          <TabsTrigger value="reparation" className="gap-2 text-xs"><Receipt className="h-3.5 w-3.5" />Réparation</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 text-xs"><Bell className="h-3.5 w-3.5" />Notifications</TabsTrigger>
          <TabsTrigger value="caisse" className="gap-2 text-xs"><Store className="h-3.5 w-3.5" />Caisse</TabsTrigger>
          <TabsTrigger value="securite" className="gap-2 text-xs"><Shield className="h-3.5 w-3.5" />Sécurité</TabsTrigger>
        </TabsList>

        {/* Boutique */}
        <TabsContent value="boutique">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4 text-primary" />Informations de la boutique</CardTitle>
              <CardDescription>Nom, coordonnées et identité visuelle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nom de la boutique</Label>
                  <Input value={local.shop_name} onChange={e => update('shop_name', e.target.value)} placeholder="TechRepair Pro" />
                </div>
                <div className="space-y-1.5">
                  <Label>Téléphone</Label>
                  <Input value={local.shop_phone} onChange={e => update('shop_phone', e.target.value)} placeholder="+33 1 23 45 67 89" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={local.shop_email} onChange={e => update('shop_email', e.target.value)} placeholder="contact@boutique.fr" />
                </div>
                <div className="space-y-1.5">
                  <Label>Site web</Label>
                  <Input value={local.shop_website} onChange={e => update('shop_website', e.target.value)} placeholder="https://www.boutique.fr" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Adresse complète</Label>
                <Input value={local.shop_address} onChange={e => update('shop_address', e.target.value)} placeholder="123 Rue de la Paix, 75001 Paris" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devise & Taxes */}
        <TabsContent value="devise">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-primary" />Devise & Taxes</CardTitle>
              <CardDescription>Configuration monétaire et fiscale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-1.5">
                <Label>Devise principale</Label>
                <Select value={local.currency} onValueChange={v => update('currency', v)}>
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue>
                      <span className="font-medium">{selectedCurrency.symbol} — {selectedCurrency.label}</span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {CURRENCIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        <span className="font-mono font-bold w-10 inline-block">{c.symbol}</span>
                        <span className="ml-2">{c.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Symbole actuel : <span className="font-bold text-foreground text-sm">{selectedCurrency.symbol}</span></p>
                <p className="text-xs text-emerald-400 mt-1">✓ Appliqué sur toutes les pages et le POS</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Nombre de décimales</Label>
                  <Select value={local.currency_decimals ?? '2'} onValueChange={v => update('currency_decimals', v)}>
                    <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 — Entier (ex: 1500 DA)</SelectItem>
                      <SelectItem value="2">2 — Centimes (ex: 1500.00 DA)</SelectItem>
                      <SelectItem value="3">3 — Millimes (ex: 1500.000 DA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Position du symbole</Label>
                  <Select value={local.currency_symbol_position ?? 'right'} onValueChange={v => update('currency_symbol_position', v)}>
                    <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Gauche — DA 1500</SelectItem>
                      <SelectItem value="right">Droite — 1500 DA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 text-sm">
                <p className="text-muted-foreground text-xs mb-1">Aperçu du format</p>
                <p className="font-bold text-lg text-foreground">
                  {(local.currency_symbol_position ?? 'right') === 'left'
                    ? `${CURRENCIES.find(c => c.code === local.currency)?.symbol || local.currency} ${(12500).toFixed(parseInt(local.currency_decimals ?? '2'))}`
                    : `${(12500).toFixed(parseInt(local.currency_decimals ?? '2'))} ${CURRENCIES.find(c => c.code === local.currency)?.symbol || local.currency}`
                  }
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Taux de TVA</Label>
                  <Select value={local.tax_rate} onValueChange={v => update('tax_rate', v)}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% — Exonéré</SelectItem>
                      <SelectItem value="5.5">5,5% — Taux réduit</SelectItem>
                      <SelectItem value="10">10% — Taux intermédiaire</SelectItem>
                      <SelectItem value="20">20% — Taux normal (France)</SelectItem>
                      <SelectItem value="21">21% — Taux normal (Belgique)</SelectItem>
                      <SelectItem value="19">19% — Taux normal (Allemagne)</SelectItem>
                      <SelectItem value="7.7">7,7% — Taux normal (Suisse)</SelectItem>
                      <SelectItem value="Personnalisé">Personnalisé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {local.tax_rate === 'Personnalisé' && (
                  <div className="space-y-1.5">
                    <Label>Taux personnalisé (%)</Label>
                    <Input type="number" min="0" max="100" value={local.custom_tax} onChange={e => update('custom_tax', e.target.value)} placeholder="Ex: 14" className="max-w-xs" />
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Switch checked={local.price_include_tax} onCheckedChange={v => update('price_include_tax', v)} />
                  <div>
                    <Label>Prix TTC par défaut</Label>
                    <p className="text-xs text-muted-foreground">Les prix affichés incluent la TVA</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label>Format de date</Label>
                <Select value={local.date_format} onValueChange={v => update('date_format', v)}>
                  <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (ex: 06/03/2026)</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (ex: 03/06/2026)</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ex: 2026-03-06)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Apparence */}
        <TabsContent value="apparence">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4 text-primary" />Apparence & Langue</CardTitle>
              <CardDescription>Thème visuel et localisation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Thème de l'interface</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {THEMES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { update('theme', t.id); applyTheme(t.id); }}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all ${local.theme === t.id ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
                    >
                      <div className={`h-10 w-full rounded-lg mb-3 ${t.id === 'light' ? 'bg-gray-100 border border-gray-200' : t.id === 'blue' ? 'bg-blue-950' : 'bg-zinc-900'}`}>
                        <div className={`h-full w-1/3 rounded-l-lg ${t.id === 'light' ? 'bg-gray-200' : t.id === 'blue' ? 'bg-blue-900' : 'bg-zinc-800'}`} />
                      </div>
                      <p className="text-sm font-semibold">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                      {local.theme === t.id && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <CheckCircle className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label>Langue de l'interface</Label>
                <Select value={local.language} onValueChange={v => update('language', v)}>
                  <SelectTrigger className="w-full max-w-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGS.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Réparation */}
        <TabsContent value="reparation">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" />Atelier & Réparation</CardTitle>
              <CardDescription>Paramètres par défaut pour les tickets de réparation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Garantie réparation par défaut (jours)</Label>
                  <Select value={local.default_warranty_repair} onValueChange={v => update('default_warranty_repair', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 jours</SelectItem>
                      <SelectItem value="60">60 jours</SelectItem>
                      <SelectItem value="90">90 jours</SelectItem>
                      <SelectItem value="180">6 mois</SelectItem>
                      <SelectItem value="365">1 an</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Garantie vente par défaut (jours)</Label>
                  <Select value={local.default_warranty_sale} onValueChange={v => update('default_warranty_sale', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">90 jours</SelectItem>
                      <SelectItem value="180">6 mois</SelectItem>
                      <SelectItem value="365">1 an</SelectItem>
                      <SelectItem value="730">2 ans</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Préfixe tickets réparation</Label>
                  <Input value={local.repair_prefix} onChange={e => update('repair_prefix', e.target.value.toUpperCase())} placeholder="REP" className="max-w-xs font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>Préfixe numéros de vente</Label>
                  <Input value={local.sale_prefix} onChange={e => update('sale_prefix', e.target.value.toUpperCase())} placeholder="VNT" className="max-w-xs font-mono" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-primary" />Notifications automatiques</CardTitle>
              <CardDescription>Canaux et événements déclencheurs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Canaux d'envoi</Label>
                {[
                  { key: 'notif_email', label: 'Email', desc: 'Notifications par email' },
                  { key: 'notif_sms', label: 'SMS', desc: 'Notifications par SMS' },
                  { key: 'notif_whatsapp', label: 'WhatsApp', desc: 'Messages WhatsApp automatiques' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={local[item.key]} onCheckedChange={v => update(item.key, v)} />
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Événements déclencheurs</Label>
                {[
                  { key: 'notif_repair_ready', label: 'Réparation prête', desc: 'Notifier le client quand la réparation est prête' },
                  { key: 'notif_low_stock', label: 'Stock bas', desc: 'Alerter quand un produit atteint le seuil minimum' },
                  { key: 'notif_warranty_expire', label: 'Expiration garantie', desc: 'Rappel 7 jours avant expiration' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={local[item.key]} onCheckedChange={v => update(item.key, v)} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Caisse */}
        <TabsContent value="caisse">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Store className="h-4 w-4 text-primary" />Caisse & Tickets</CardTitle>
              <CardDescription>Comportement de la caisse et des reçus</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'require_close_reason', label: 'Justification obligatoire en cas d\'écart de caisse', desc: 'Impossible de fermer la caisse avec un écart sans justification' },
                { key: 'auto_print_receipt', label: 'Impression automatique du ticket', desc: 'Imprimer le reçu dès la validation d\'une vente' },
                { key: 'show_tax_on_receipt', label: 'Afficher la TVA sur le ticket', desc: 'Détail de la TVA sur les reçus clients' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={local[item.key]} onCheckedChange={v => update(item.key, v)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sécurité */}
        <TabsContent value="securite">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Sécurité & Accès</CardTitle>
              <CardDescription>Paramètres de sécurité et contrôle d'accès</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Double authentification (2FA) Admin</p>
                  <p className="text-xs text-muted-foreground">Obligatoire pour les comptes administrateurs</p>
                </div>
                <Switch checked={local.two_fa_admin} onCheckedChange={v => update('two_fa_admin', v)} />
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Délai d'expiration de session (minutes)</Label>
                  <Select value={local.session_timeout} onValueChange={v => update('session_timeout', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 heure</SelectItem>
                      <SelectItem value="120">2 heures</SelectItem>
                      <SelectItem value="480">8 heures (journée)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Longueur minimale du mot de passe</Label>
                  <Select value={local.min_password_length} onValueChange={v => update('min_password_length', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6 caractères</SelectItem>
                      <SelectItem value="8">8 caractères (recommandé)</SelectItem>
                      <SelectItem value="10">10 caractères</SelectItem>
                      <SelectItem value="12">12 caractères (fort)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}