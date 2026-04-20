import express from 'express';
import * as models from '../models/index.js';
import { checkSubscription } from '../middlewares/auth.js';

const router = express.Router();

// Map lowercase plural resource names → Sequelize models
const tableMap = {
  'products':           models.Product,
  'clients':            models.Client,
  'repairs':            models.Repair,
  'sales':              models.Sale,
  'stock-movements':    models.StockMovement,
  'suppliers':          models.Supplier,
  'supplier-invoices':  models.SupplierInvoice,
  'purchase-orders':    models.PurchaseOrder,
  'expenses':           models.Expense,
  'warranties':         models.Warranty,
  'promotions':         models.Promotion,
  'service-sales':      models.ServiceSale,
  'service-items':      models.ServiceItem,
  'service-categories': models.ServiceCategory,
  'prepaid-cards':      models.PrepaidCard,
  'card-topups':        models.CardTopup,
  'audit-logs':         models.AuditLog,
  'notifications':      models.Notification,
  'settings':           models.Setting,
  'users':              models.User,
  'brands':             models.Brand,
  'device-types':       models.DeviceType,
  'device-models':      models.DeviceModel,
  'product-categories': models.ProductCategory,
  'cash-registers':     models.CashRegister,
};

// Helper: shop_id filter for multi-tenant isolation
function getShopFilter(req) {
  if (req.user?.role === 'super_admin') return {};
  return req.user?.shop_id ? { shop_id: req.user.shop_id } : {};
}

// GET /api/:table — list all
router.get('/:table', checkSubscription, async (req, res) => {
  const Model = tableMap[req.params.table];
  if (!Model) return res.status(404).json({ error: `Table "${req.params.table}" not found` });

  try {
    const { sort, limit, ...filters } = req.query;
    const order = sort
      ? [[sort.replace('-', ''), sort.startsWith('-') ? 'DESC' : 'ASC']]
      : [['created_date', 'DESC']];
    const parsedLimit = limit ? parseInt(limit) : undefined;

    const where = { ...getShopFilter(req) };
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && Model.rawAttributes[key]) {
        where[key] = value;
      }
    }

    const rows = await Model.findAll({
      where,
      order,
      ...(parsedLimit ? { limit: parsedLimit } : {}),
    });
    res.json(rows);
  } catch (err) {
    console.error(`[GET /api/${req.params.table}] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/:table/:id — get one
router.get('/:table/:id', checkSubscription, async (req, res) => {
  const Model = tableMap[req.params.table];
  if (!Model) return res.status(404).json({ error: `Table "${req.params.table}" not found` });

  try {
    const where = { id: req.params.id, ...getShopFilter(req) };
    const row = await Model.findOne({ where });
    if (!row) return res.status(404).json({ error: 'Enregistrement introuvable' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/:table — create
router.post('/:table', checkSubscription, async (req, res) => {
  const Model = tableMap[req.params.table];
  if (!Model) return res.status(404).json({ error: `Table "${req.params.table}" not found` });

  try {
    const data = { ...req.body };
    if (req.user?.role !== 'super_admin' && req.user?.shop_id && Model.rawAttributes.shop_id) {
      data.shop_id = req.user.shop_id;
    }
    const row = await Model.create(data);
    res.status(201).json(row);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      if (req.body.name) {
        try {
          const existing = await Model.findOne({ where: { name: req.body.name, ...getShopFilter(req) } });
          if (existing) return res.status(200).json(existing);
        } catch (_) {}
      }
      return res.status(409).json({ error: 'Cet élément existe déjà.' });
    }
    console.error(`[POST /api/${req.params.table}] Error:`, err.message);
    res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
});

// PUT /api/:table/:id — update
router.put('/:table/:id', checkSubscription, async (req, res) => {
  const Model = tableMap[req.params.table];
  if (!Model) return res.status(404).json({ error: `Table "${req.params.table}" not found` });

  try {
    const where = { id: req.params.id, ...getShopFilter(req) };
    const row = await Model.findOne({ where });
    if (!row) return res.status(404).json({ error: 'Enregistrement introuvable' });
    await row.update(req.body);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/:table/:id — delete
router.delete('/:table/:id', checkSubscription, async (req, res) => {
  const Model = tableMap[req.params.table];
  if (!Model) return res.status(404).json({ error: `Table "${req.params.table}" not found` });

  try {
    const where = { id: req.params.id, ...getShopFilter(req) };
    const row = await Model.findOne({ where });
    if (!row) return res.status(404).json({ error: 'Enregistrement introuvable' });
    await row.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
