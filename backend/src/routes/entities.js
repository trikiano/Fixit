const router = require('express').Router();
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

// Mapping: URL name -> Prisma model key
const MODEL_MAP = {
  Client: 'client',
  Product: 'product',
  Repair: 'repair',
  Sale: 'sale',
  Supplier: 'supplier',
  Expense: 'expense',
  PurchaseOrder: 'purchaseOrder',
  SupplierInvoice: 'supplierInvoice',
  SupplierPayment: 'supplierPayment',
  StockMovement: 'stockMovement',
  CashRegister: 'cashRegister',
  Warranty: 'warranty',
  Promotion: 'promotion',
  ServiceCategory: 'serviceCategory',
  ServiceItem: 'serviceItem',
  ServiceSale: 'serviceSale',
  PrepaidCard: 'prepaidCard',
  CardTopup: 'cardTopup',
  InternetPackage: 'internetPackage',
  InternetSale: 'internetSale',
  NotificationLog: 'notificationLog',
  AuditLog: 'auditLog',
};

const MAX_TAKE = 1000;

function resolveTake(limit) {
  const parsed = parseInt(limit);
  if (!parsed || parsed <= 0) return MAX_TAKE;
  return Math.min(parsed, MAX_TAKE);
}

function getModel(name) {
  const key = MODEL_MAP[name];
  if (!key) return null;
  return prisma[key];
}

function parseSortOrder(sort) {
  if (!sort) return [{ created_date: 'desc' }];
  const field = sort.startsWith('-') ? sort.slice(1) : sort;
  const dir = sort.startsWith('-') ? 'desc' : 'asc';
  return [{ [field]: dir }];
}

function buildWhereClause(filters) {
  if (!filters || typeof filters !== 'object') return {};
  const where = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Support { gte, lte, lt, gt, contains } operators
      where[key] = value;
    } else {
      where[key] = value;
    }
  }
  return where;
}

function formatRecord(record) {
  if (!record) return null;
  const out = { ...record };
  if (out.created_date instanceof Date) out.created_date = out.created_date.toISOString();
  if (out.updated_date instanceof Date) out.updated_date = out.updated_date.toISOString();
  return out;
}

// GET /api/entities/:entity - list with optional sort and limit
router.get('/:entity', requireAuth, async (req, res) => {
  const model = getModel(req.params.entity);
  if (!model) return res.status(404).json({ error: `Entité inconnue: ${req.params.entity}` });

  const { sort, limit, ...filters } = req.query;
  const take = resolveTake(limit);
  const orderBy = parseSortOrder(sort);
  const where = buildWhereClause(filters);

  try {
    const records = await model.findMany({ where, orderBy, take });
    res.json(records.map(formatRecord));
  } catch (err) {
    console.error(`GET /${req.params.entity}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/entities/:entity/filter - filter with body
router.post('/:entity/filter', requireAuth, async (req, res) => {
  const model = getModel(req.params.entity);
  if (!model) return res.status(404).json({ error: `Entité inconnue: ${req.params.entity}` });

  const { filters = {}, sort, limit } = req.body;
  const take = resolveTake(limit);
  const orderBy = parseSortOrder(sort);
  const where = buildWhereClause(filters);

  try {
    const records = await model.findMany({ where, orderBy, take });
    res.json(records.map(formatRecord));
  } catch (err) {
    console.error(`POST /${req.params.entity}/filter:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entities/:entity/:id - get one
router.get('/:entity/:id', requireAuth, async (req, res) => {
  const model = getModel(req.params.entity);
  if (!model) return res.status(404).json({ error: `Entité inconnue: ${req.params.entity}` });

  try {
    const record = await model.findUnique({ where: { id: req.params.id } });
    if (!record) return res.status(404).json({ error: 'Enregistrement introuvable' });
    res.json(formatRecord(record));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/entities/:entity - create
router.post('/:entity', requireAuth, async (req, res) => {
  const model = getModel(req.params.entity);
  if (!model) return res.status(404).json({ error: `Entité inconnue: ${req.params.entity}` });

  try {
    const data = { ...req.body };
    delete data.id;
    delete data.created_date;
    delete data.updated_date;

    const record = await model.create({ data });
    res.status(201).json(formatRecord(record));
  } catch (err) {
    console.error(`POST /${req.params.entity}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/entities/:entity/:id - update
router.patch('/:entity/:id', requireAuth, async (req, res) => {
  const model = getModel(req.params.entity);
  if (!model) return res.status(404).json({ error: `Entité inconnue: ${req.params.entity}` });

  try {
    const data = { ...req.body };
    delete data.id;
    delete data.created_date;
    delete data.updated_date;

    const record = await model.update({ where: { id: req.params.id }, data });
    res.json(formatRecord(record));
  } catch (err) {
    console.error(`PATCH /${req.params.entity}/${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/entities/:entity/:id - delete
router.delete('/:entity/:id', requireAuth, async (req, res) => {
  const model = getModel(req.params.entity);
  if (!model) return res.status(404).json({ error: `Entité inconnue: ${req.params.entity}` });

  try {
    await model.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
