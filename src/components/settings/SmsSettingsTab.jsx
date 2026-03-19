import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MessageSquare, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const SMS_PROVIDERS = [
  {
    value: 'twilio',
    label: 'Twilio',
    url: 'https://console.twilio.com',
    apiKeyLabel: 'Account SID',
    apiSecretLabel: 'Auth Token',
    fromLabel: 'Numéro Twilio (ex: +33612345678)',
    extraInfo: 'Depuis votre Console Twilio → Account Info',
  },
  {
    value: 'vonage',
    label: 'Vonage (Nexmo)',
    url: 'https://dashboard.nexmo.com',
    apiKeyLabel: 'API Key',
    apiSecretLabel: 'API Secret',
    fromLabel: 'Expéditeur (nom ou numéro, 11 car. max)',
    extraInfo: 'Depuis votre Dashboard Vonage → API settings',
  },
  {
    value: 'infobip',
    label: 'Infobip',
    url: 'https://portal.infobip.com',
    apiKeyLabel: 'API Key',
    apiSecretLabel: 'Base URL (ex: xxxxx.api.infobip.com)',
    fromLabel: 'Expéditeur (nom ou numéro)',
    extraInfo: 'Depuis votre portail Infobip → Developers → API Keys',
  },
];

const DEFAULT_TEMPLATE = `🧾 Ticket {numero}
Boutique: {boutique}
Client: {client}

Articles:
{articles}

TOTAL: {total}

Merci pour votre confiance !`;

export default function SmsSettingsTab({ local, update, onSave, saved }) {
  const [showSecret, setShowSecret] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testStatus, setTestStatus] = useState(null); // null | 'loading' | 'ok' | 'error'
  const [testMsg, setTestMsg] = useState('');

  const provider = SMS_PROVIDERS.find(p => p.value === (local.sms_provider || 'twilio'));

  const sendTest = async () => {
    if (!testPhone) return;
    setTestStatus('loading');
    setTestMsg('');
    try {
      const res = await base44.functions.invoke('sendSms', {
        to: testPhone,
        message: `✅ Test SMS depuis ${local.shop_name || 'TechRepair Pro'} — Configuration SMS OK !`,
        provider: local.sms_provider || 'twilio',
        apiKey: local.sms_api_key || '',
        apiSecret: local.sms_api_secret || '',
        from: local.sms_from || '',
      });
      if (res.data?.success) {
        setTestStatus('ok');
        setTestMsg('SMS envoyé avec succès !');
      } else {
        setTestStatus('error');
        setTestMsg(res.data?.error || 'Erreur inconnue');
      }
    } catch (e) {
      setTestStatus('error');
      setTestMsg(e.message || 'Erreur réseau');
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="h-4 w-4 text-primary" />Configuration SMS</CardTitle>
          <CardDescription>Paramètres pour l'envoi de tickets par SMS depuis le POS</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Provider */}
          <div className="space-y-1.5">
            <Label>Fournisseur SMS</Label>
            <Select value={local.sms_provider || 'twilio'} onValueChange={v => update('sms_provider', v)}>
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SMS_PROVIDERS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {provider && (
              <p className="text-xs text-muted-foreground">
                {provider.extraInfo} —{' '}
                <a href={provider.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">{provider.url}</a>
              </p>
            )}
          </div>

          <Separator />

          {/* API Key + Secret */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{provider?.apiKeyLabel || 'API Key'}</Label>
              <Input
                value={local.sms_api_key || ''}
                onChange={e => update('sms_api_key', e.target.value)}
                placeholder="Votre clé API..."
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{provider?.apiSecretLabel || 'API Secret'}</Label>
              <div className="relative">
                <Input
                  type={showSecret ? 'text' : 'password'}
                  value={local.sms_api_secret || ''}
                  onChange={e => update('sms_api_secret', e.target.value)}
                  placeholder="Votre secret..."
                  className="font-mono text-sm pr-10"
                />
                <button
                  onClick={() => setShowSecret(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* From */}
          <div className="space-y-1.5">
            <Label>{provider?.fromLabel || 'Expéditeur'}</Label>
            <Input
              value={local.sms_from || ''}
              onChange={e => update('sms_from', e.target.value)}
              placeholder={local.sms_provider === 'twilio' ? '+33612345678' : local.shop_name || 'TechRepair'}
              className="max-w-xs"
            />
          </div>

          <Separator />

          {/* Template du ticket SMS */}
          <div className="space-y-1.5">
            <Label>Modèle du ticket SMS</Label>
            <p className="text-xs text-muted-foreground">
              Variables disponibles : <code className="bg-muted px-1 rounded">{'{numero}'}</code> <code className="bg-muted px-1 rounded">{'{boutique}'}</code> <code className="bg-muted px-1 rounded">{'{client}'}</code> <code className="bg-muted px-1 rounded">{'{articles}'}</code> <code className="bg-muted px-1 rounded">{'{total}'}</code>
            </p>
            <Textarea
              value={local.sms_ticket_template || DEFAULT_TEMPLATE}
              onChange={e => update('sms_ticket_template', e.target.value)}
              rows={9}
              className="font-mono text-xs"
            />
            <Button variant="outline" size="sm" onClick={() => update('sms_ticket_template', DEFAULT_TEMPLATE)}>
              Réinitialiser le modèle
            </Button>
          </div>

          <Separator />

          {/* Sauvegarder */}
          {onSave && (
            <div className="flex justify-end pt-2">
              <Button onClick={onSave} className="gap-2">
                {saved ? <><CheckCircle className="h-4 w-4 text-green-400" /> Sauvegardé !</> : 'Sauvegarder les paramètres SMS'}
              </Button>
            </div>
          )}

          <Separator />

          {/* Test */}
          <div className="space-y-2">
            <Label>Tester l'envoi SMS</Label>
            <div className="flex gap-2">
              <Input
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="+213xxxxxxxxx"
                className="max-w-xs"
              />
              <Button onClick={sendTest} disabled={testStatus === 'loading' || !testPhone || !local.sms_api_key}>
                {testStatus === 'loading' ? 'Envoi...' : 'Envoyer test'}
              </Button>
            </div>
            {testStatus === 'ok' && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-500"><CheckCircle className="h-4 w-4" />{testMsg}</p>
            )}
            {testStatus === 'error' && (
              <p className="flex items-center gap-1.5 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{testMsg}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}