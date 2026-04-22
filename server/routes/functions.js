import express from 'express';
import { sequelize, Setting } from '../models/index.js';

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

// POST /api/functions/nextInvoiceNumber — generate next invoice number for shop
router.post('/nextInvoiceNumber', async (req, res) => {
  try {
    const { Invoice } = await import('../models/index.js');
    const count = await Invoice.count({ where: { shop_id: req.user?.shop_id } });
    const num = String(count + 1).padStart(6, '0');
    const prefix = req.body?.prefix || 'FAC';
    res.json({ invoice_number: `${prefix}-${num}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/functions/analyzeProductPhoto — IA vision pour détecter un produit depuis une photo
router.post('/analyzeProductPhoto', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'Image manquante' });

    // Récupère la clé API depuis les paramètres de la boutique
    const setting = await Setting.findOne({ where: { shop_id: req.user?.shop_id } });
    const apiKey = setting?.openai_api_key || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'Clé API OpenAI non configurée. Allez dans Paramètres → Intégrations pour ajouter votre clé.',
      });
    }

    const prompt = `Tu es un assistant spécialisé dans l'identification de produits pour un atelier de réparation et de vente.
Analyse soigneusement cette photo et extrais TOUTES les informations visibles : texte sur l'emballage, étiquettes de prix, codes-barres, logos, noms de modèles.
Réponds UNIQUEMENT avec un objet JSON valide (sans markdown, sans backticks) avec ces champs :
{
  "name": "nom complet du produit (marque + modèle si possible)",
  "brand": "marque ou fabricant",
  "model": "numéro ou nom de modèle exact (ex: iPhone 13 Pro, Galaxy S23, etc.)",
  "category": "catégorie précise (Smartphone, Tablette, Laptop, Accessoire, Câble, Batterie, Ecran, Chargeur, Coque, Pièce détachée, Autre)",
  "barcode": "numéro de code-barres ou EAN visible (null si absent)",
  "sku": "référence ou code article visible (null si absent)",
  "condition": "neuf ou occasion ou reconditionne",
  "sell_price": "prix de vente visible sur étiquette ou emballage sous forme de nombre décimal (null si absent)",
  "buy_price": "prix d'achat ou coût si visible (null si absent)",
  "description": "description courte incluant caractéristiques importantes visibles"
}
IMPORTANT pour les prix : cherche attentivement toute étiquette de prix, autocollant, sticker, prix barré, prix promotionnel. Retourne uniquement le nombre (ex: 29.99), pas de symboles monétaires.
Si une information n'est pas visible, utilise null. Réponds UNIQUEMENT avec le JSON brut.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(502).json({ error: err.error?.message || 'Erreur OpenAI' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return res.status(502).json({ error: 'Réponse vide de l\'IA' });

    // Nettoie les éventuels backticks markdown
    const clean = content.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    let product;
    try {
      product = JSON.parse(clean);
    } catch {
      return res.status(502).json({ error: 'L\'IA n\'a pas retourné un JSON valide', raw: content });
    }

    res.json(product);
  } catch (err) {
    console.error('[analyzeProductPhoto]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
