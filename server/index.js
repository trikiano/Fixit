import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import { sequelize, User, Shop, Setting } from './models/index.js';
import bcrypt from 'bcryptjs';
import authRouter, { authenticate } from './routes/auth.js';
import entitiesRouter from './routes/entities.js';
import functionsRouter from './routes/functions.js';
import uploadRouter from './routes/upload.js';
import adminRouter from './routes/admin.js';
import { requireSuperAdmin } from './middlewares/auth.js';


const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// --- Routes ---
app.use('/api/auth', authRouter);
app.use('/api/entities', authenticate, entitiesRouter);
app.use('/api/functions', authenticate, functionsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/admin', authenticate, requireSuperAdmin, adminRouter);

// --- Static files (images) ---
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Debug login (temporary)
app.post('/debug-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.json({ step: 'user_not_found', email });
    const bcrypt = (await import('bcryptjs')).default;
    const valid = await bcrypt.compare(password, user.password_hash);
    res.json({ step: valid ? 'password_ok' : 'password_wrong', email, role: user.role, is_active: user.is_active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Setup route (one-time init)
app.get('/setup', async (req, res) => {
  try {
    // Disable FK checks to allow dropping tables in any order
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await sequelize.sync({ force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    // Create super_admin only (no shop)
    await User.create({
      email: 'superadmin@fixit.local',
      password_hash: await bcrypt.hash('superadmin123', 10),
      full_name: 'Super Administrateur',
      role: 'super_admin',
      shop_id: null,
    });

    res.json({
      success: true,
      message: 'Base initialisée ✅\nSuper Admin: superadmin@fixit.local / superadmin123\nLes boutiques s\'inscrivent via /register'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Serve React frontend (AFTER API routes) ---
app.use(express.static(join(__dirname, '../dist')));
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../dist/index.html'));
});

// --- Start server ---
async function start() {
  // Start HTTP server immediately so requests are never refused
  app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  });

  // Connect to DB after server is up
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion MySQL réussie');
  } catch (err) {
    console.error('❌ Connexion MySQL échouée:', err.message);
    return; // Keep server running but don't sync
  }

  try {
    await sequelize.sync({ alter: true });
    console.log('✅ Base de données synchronisée');
  } catch (err) {
    console.error('❌ Sync DB échouée (tables existantes utilisées):', err.message);
    // Continue anyway — tables may already be correct
  }
}

start();
