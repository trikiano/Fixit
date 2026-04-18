import express from 'express';
import { sequelize } from '../models/index.js';

const router = express.Router();

// POST /api/functions/sendSms — ported from the fixit cloud function
router.post('/sendSms', async (req, res) => {
  try {
    const { to, message, provider, apiKey, apiSecret, from } = req.body;

    if (!to || !message || !provider || !apiKey) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    // Clean phone number
    const phone = to.replace(/[^\d+]/g, '');
    if (!phone) return res.status(400).json({ error: 'Numéro de téléphone invalide' });

    let result;

    if (provider === 'twilio') {
      const accountSid = apiKey;
      const authToken = apiSecret;
      const twilioFrom = from || '+15005550006';
      const encoded = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${encoded}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: phone, From: twilioFrom, Body: message }),
      });
      const data = await response.json();
      if (!response.ok) return res.status(400).json({ error: data.message || 'Erreur Twilio', details: data });
      result = { sid: data.sid, status: data.status };

    } else if (provider === 'vonage') {
      const response = await fetch('https://rest.nexmo.com/sms/json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, from: from || 'Fixit', to: phone, text: message }),
      });
      const data = await response.json();
      const msg = data.messages?.[0];
      if (msg?.status !== '0') return res.status(400).json({ error: msg?.['error-text'] || 'Erreur Vonage' });
      result = { id: msg['message-id'], status: 'sent' };

    } else if (provider === 'infobip') {
      const baseUrl = apiSecret;
      const response = await fetch(`https://${baseUrl}/sms/2/text/advanced`, {
        method: 'POST',
        headers: {
          'Authorization': `App ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ destinations: [{ to: phone }], from: from || 'Fixit', text: message }]
        }),
      });
      const data = await response.json();
      if (!response.ok) return res.status(400).json({ error: data.requestError?.serviceException?.text || 'Erreur Infobip' });
      result = { id: data.messages?.[0]?.messageId, status: 'sent' };

    } else {
      return res.status(400).json({ error: 'Fournisseur SMS inconnu' });
    }

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/functions/getDistinctValues
router.post('/getDistinctValues', async (req, res) => {
  try {
    const { table, column, filters = {} } = req.body;
    if (!table || !column) {
      return res.status(400).json({ error: 'Missing table or column' });
    }
    const allowedTables = ['products', 'repairs'];
    if (!allowedTables.includes(table)) {
      return res.status(403).json({ error: 'Invalid table' });
    }

    const quote = (i) => sequelize.getQueryInterface().quoteIdentifier(i);
    let baseSql = `SELECT DISTINCT ${quote(column)} AS value FROM ${quote(table)} WHERE ${quote(column)} IS NOT NULL AND ${quote(column)} != ''`;
    let replacements = [];

    // Add dynamic AND conditions for cascading dropdowns
    for (const [fCol, fVal] of Object.entries(filters)) {
      if (fVal != null && String(fVal).trim() !== '') {
        baseSql += ` AND ${quote(fCol)} = ?`;
        replacements.push(String(fVal).trim());
      }
    }

    baseSql += ` ORDER BY value ASC`;

    const [results] = await sequelize.query(baseSql, { 
      replacements,
      type: sequelize.QueryTypes.SELECT 
    });
    
    res.json({ success: true, result: results.map(r => r.value) });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
