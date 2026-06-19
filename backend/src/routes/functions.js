const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

// POST /api/functions/:name - invoke a serverless function
router.post('/:name', requireAuth, async (req, res) => {
  const { name } = req.params;

  if (name === 'sendSms') {
    return handleSendSms(req, res);
  }

  res.status(404).json({ error: `Fonction inconnue: ${name}` });
});

async function handleSendSms(req, res) {
  const { to, message, provider, apiKey, apiSecret, from } = req.body;

  if (!to || !message || !provider || !apiKey) {
    return res.status(400).json({ error: 'Paramètres manquants' });
  }

  const phone = to.replace(/[^\d+]/g, '');
  if (!phone) return res.status(400).json({ error: 'Numéro de téléphone invalide' });

  try {
    let result;

    if (provider === 'twilio') {
      const accountSid = apiKey;
      const authToken = apiSecret;
      const twilioFrom = from || '+15005550006';
      const encoded = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const fetchFn = require('node-fetch');
      const resp = await fetchFn(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: { 'Authorization': `Basic ${encoded}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ To: phone, From: twilioFrom, Body: message }).toString(),
        }
      );
      const data = await resp.json();
      if (!resp.ok) return res.status(400).json({ error: data.message || 'Erreur Twilio', details: data });
      result = { sid: data.sid, status: data.status };

    } else if (provider === 'vonage') {
      const fetchFn = require('node-fetch');
      const resp = await fetchFn('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, from: from || 'TechRepair', to: phone, text: message }),
      });
      const data = await resp.json();
      const msg = data.messages?.[0];
      if (msg?.status !== '0') return res.status(400).json({ error: msg?.['error-text'] || 'Erreur Vonage' });
      result = { id: msg['message-id'], status: 'sent' };

    } else if (provider === 'infobip') {
      const baseUrl = apiSecret;
      const fetchFn = require('node-fetch');
      const resp = await fetchFn(`https://${baseUrl}/sms/2/text/advanced`, {
        method: 'POST',
        headers: { 'Authorization': `App ${apiKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ messages: [{ destinations: [{ to: phone }], from: from || 'TechRepair', text: message }] }),
      });
      const data = await resp.json();
      if (!resp.ok) return res.status(400).json({ error: data.requestError?.serviceException?.text || 'Erreur Infobip' });
      result = { id: data.messages?.[0]?.messageId, status: 'sent' };

    } else {
      return res.status(400).json({ error: 'Fournisseur SMS inconnu' });
    }

    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = router;
