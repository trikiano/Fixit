import { createClientFromRequest } from 'npm:@fixit/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    // Lire le body en premier (avant auth qui peut consommer le stream)
    const body = await req.json();

    const fixit = createClientFromRequest(req);
    const user = await fixit.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { to, message, provider, apiKey, apiSecret, from } = body;

    if (!to || !message || !provider || !apiKey) {
      return Response.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    // Nettoyer le numéro (garder seulement chiffres et +)
    const phone = to.replace(/[^\d+]/g, '');
    if (!phone) return Response.json({ error: 'Numéro de téléphone invalide' }, { status: 400 });

    let result;

    if (provider === 'twilio') {
      const accountSid = apiKey;
      const authToken = apiSecret;
      const twilioFrom = from || '+15005550006';
      const encoded = btoa(`${accountSid}:${authToken}`);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${encoded}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, From: twilioFrom, Body: message }),
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.message || 'Erreur Twilio', details: data }, { status: 400 });
      result = { sid: data.sid, status: data.status };

    } else if (provider === 'vonage') {
      const res = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, from: from || 'TechRepair', to: phone, text: message }),
      });
      const data = await res.json();
      const msg = data.messages?.[0];
      if (msg?.status !== '0') return Response.json({ error: msg?.['error-text'] || 'Erreur Vonage' }, { status: 400 });
      result = { id: msg['message-id'], status: 'sent' };

    } else if (provider === 'infobip') {
      const baseUrl = apiSecret;
      const res = await fetch(`https://${baseUrl}/sms/2/text/advanced`, {
        method: 'POST',
        headers: {
          'Authorization': `App ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ destinations: [{ to: phone }], from: from || 'TechRepair', text: message }]
        }),
      });
      const data = await res.json();
      if (!res.ok) return Response.json({ error: data.requestError?.serviceException?.text || 'Erreur Infobip' }, { status: 400 });
      result = { id: data.messages?.[0]?.messageId, status: 'sent' };

    } else {
      return Response.json({ error: 'Fournisseur SMS inconnu' }, { status: 400 });
    }

    return Response.json({ success: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});