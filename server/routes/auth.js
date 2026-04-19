import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Shop, Setting } from '../models/index.js';
import { authenticate as _authenticate } from '../middlewares/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key';

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    if (!user.is_active) return res.status(403).json({ error: 'Compte désactivé' });

    // Load shop info for multi-tenant token
    let shop = null;
    if (user.shop_id) {
      shop = await Shop.findByPk(user.shop_id);
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      shop_id: user.shop_id || null,
      shop_name: shop?.name || null,
      subscription_status: shop?.subscription_status || null,
      trial_ends_at: shop?.trial_ends_at || null,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        shop_id: user.shop_id,
        shop_name: shop?.name || null,
        subscription_status: shop?.subscription_status || null,
        trial_ends_at: shop?.trial_ends_at || null,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: { exclude: ['password_hash'] } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register — creates a new Shop + admin User + Setting (trial 7 days)
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name, shop_name, role } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email déjà utilisé' });

    // Create shop with 7-day trial
    const trial_ends_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const shop = await Shop.create({
      name: shop_name || full_name || email,
      email,
      subscription_status: 'trial',
      trial_ends_at,
      plan: 'starter',
    });

    // Create admin user — beforeSave hook will hash the password
    const user = await User.create({
      email,
      password_hash: password,
      full_name,
      role: role || 'admin',
      shop_id: shop.id,
    });

    // Create default settings for this shop
    await Setting.create({ shop_id: shop.id, shop_name: shop.name });

    res.status(201).json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      shop_id: shop.id,
      shop_name: shop.name,
      subscription_status: shop.subscription_status,
      trial_ends_at: shop.trial_ends_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Re-export authenticate from middlewares for backward compatibility
export function authenticate(req, res, next) {
  return _authenticate(req, res, next);
}

export default router;
