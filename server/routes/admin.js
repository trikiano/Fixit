import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Shop, User, Subscription, Setting } from '../models/index.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key';

// Lister toutes les boutiques
router.get('/shops', async (req, res) => {
  try {
    const shops = await Shop.findAll({
      include: [{ model: User, attributes: ['id', 'email', 'full_name', 'role'], as: 'users' }],
      order: [['created_date', 'DESC']]
    });
    res.json(shops);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Détails d'une boutique
router.get('/shops/:shopId', async (req, res) => {
  try {
    const shop = await Shop.findByPk(req.params.shopId, {
      include: [{ model: User, attributes: { exclude: ['password_hash'] }, as: 'users' }]
    });
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' });
    res.json(shop);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Gérer l'abonnement d'une boutique
router.put('/shops/:shopId/subscription', async (req, res) => {
  try {
    const { subscription_status, trial_ends_at, plan } = req.body;
    const shop = await Shop.findByPk(req.params.shopId);
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' });
    await shop.update({ subscription_status, trial_ends_at, plan });

    // Créer un enregistrement de subscription si activation
    if (subscription_status === 'active') {
      await Subscription.create({
        shop_id: shop.id,
        plan: plan || shop.plan,
        status: 'active',
        starts_at: new Date(),
        ends_at: req.body.ends_at || null,
        amount: req.body.amount || 0,
        notes: req.body.notes || '',
      });
    }
    res.json(shop);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Créer une boutique démo
router.post('/shops/demo', async (req, res) => {
  try {
    const { shop_name, email, full_name, password } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

    const shop = await Shop.create({
      name: shop_name,
      email,
      subscription_status: 'demo',
      plan: 'pro',
    });

    const password_hash = await bcrypt.hash(password || 'demo123', 10);
    await User.create({ email, password_hash, full_name: full_name || shop_name, role: 'admin', shop_id: shop.id });
    await Setting.create({ shop_id: shop.id, shop_name });

    res.status(201).json({ message: 'Boutique démo créée', shop });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Se connecter en tant qu'un user d'une boutique
router.post('/impersonate/:userId', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    const shop = await Shop.findByPk(user.shop_id);
    const token = jwt.sign({
      id: user.id, email: user.email, role: user.role,
      shop_id: user.shop_id, shop_name: shop?.name,
      subscription_status: shop?.subscription_status,
      trial_ends_at: shop?.trial_ends_at,
      impersonated_by: req.user.id,
    }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, shop } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lister tous les users
router.get('/users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Shop, as: 'shop', attributes: ['id', 'name', 'subscription_status', 'plan'] }],
      order: [['created_date', 'DESC']]
    });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Supprimer une boutique
router.delete('/shops/:shopId', async (req, res) => {
  try {
    const shop = await Shop.findByPk(req.params.shopId);
    if (!shop) return res.status(404).json({ error: 'Boutique introuvable' });
    await shop.destroy();
    res.json({ message: 'Boutique supprimée' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
