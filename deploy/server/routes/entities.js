import express from 'express';
import { Op } from 'sequelize';
import * as models from '../models/index.js';
import { Brand, DeviceType, DeviceModel, ProductCategory } from '../models/index.js';

const router = express.Router();

// Map entity name to Sequelize model
const rawEntityMap = {
  Product: models.Product,
  CashRegister: models.CashRegister,
  Client: models.Client,

  Repair: models.Repair,
  Sale: models.Sale,
  StockMovement: models.StockMovement,
  Supplier: models.Supplier,
  SupplierInvoice: models.SupplierInvoice,
  PurchaseOrder: models.PurchaseOrder,
  Expense: models.Expense,
  Warranty: models.Warranty,
  Promotion: models.Promotion,
  ServiceSale: models.ServiceSale,
  ServiceItem: models.ServiceItem,
  ServiceCategory: models.ServiceCategory,
  PrepaidCard: models.PrepaidCard,
  CardTopup: models.CardTopup,
  AuditLog: models.AuditLog,
  Notification: models.Notification,
  NotificationLog: models.NotificationLog,
  Setting: models.Setting,

  User: models.User,
  // New persistent entities
  Brand: Brand,
  DeviceType: DeviceType,
  DeviceModel: DeviceModel,
  ProductCategory: ProductCategory,
};

// Create a normalized map for case-insensitive lookup
const entityMap = {};
Object.entries(rawEntityMap).forEach(([key, model]) => {
  entityMap[key] = model;
  entityMap[key.toLowerCase()] = model;
});

// GET /api/entities/:entity — list all (with optional sort and limit)
router.get('/:entity', async (req, res) => {
  const Model = entityMap[req.params.entity];
  if (!Model) {
    console.error(`[Entity Error] Model for "${req.params.entity}" is missing. Available: ${Object.keys(entityMap).join(', ')}`);
    return res.status(404).json({ error: `Entity "${req.params.entity}" not found` });
  }

  try {
    const { sort, limit, ...filters } = req.query;
    const order = sort ? [[sort.replace('-', ''), sort.startsWith('-') ? 'DESC' : 'ASC']] : [['created_date', 'DESC']];
    const parsedLimit = limit ? parseInt(limit) : undefined;

    // Build filter conditions from query params
    const where = {};
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
    console.error(`[GET /api/entities/${req.params.entity}] Error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/entities/:entity/:id — get one
router.get('/:entity/:id', async (req, res) => {
  const Model = entityMap[req.params.entity];
  if (!Model) return res.status(404).json({ error: `Entity "${req.params.entity}" not found` });

  try {
    const row = await Model.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Record not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/entities/:entity — create
router.post('/:entity', async (req, res) => {
  const Model = entityMap[req.params.entity];
  if (!Model) return res.status(404).json({ error: `Entity "${req.params.entity}" not found` });

  try {
    const row = await Model.create(req.body);
    res.status(201).json(row);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      // Si on essaie de recréer une entité qui existe déjà (nom identique)
      if (req.body.name) {
        try {
          const existing = await Model.findOne({ where: { name: req.body.name } });
          if (existing) {
            // Retourne simplement l'entité existante, ce qui rend la création idempotente !
            return res.status(200).json(existing);
          }
        } catch (findErr) {
          console.error(`Error finding existing entity for ${req.params.entity}`, findErr);
        }
      }
      return res.status(409).json({ error: "Cet élément existe déjà." });
    }

    console.error(`[POST /api/entities/${req.params.entity}] Error:`, err);
    res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

// PUT /api/entities/:entity/:id — update
router.put('/:entity/:id', async (req, res) => {
  try {
    const Model = entityMap[req.params.entity];
    if (!Model) return res.status(404).json({ error: `Entity "${req.params.entity}" not found` });

    const row = await Model.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Record not found' });

    await row.update(req.body);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/entities/:entity/:id — delete
router.delete('/:entity/:id', async (req, res) => {
  try {
    const Model = entityMap[req.params.entity];
    if (!Model) return res.status(404).json({ error: `Entity "${req.params.entity}" not found` });

    const row = await Model.findByPk(req.params.id);
    if (!row) return res.status(404).json({ error: 'Record not found' });

    await row.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
