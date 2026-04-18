import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import { sequelize, User, Setting } from './models/index.js';
import bcrypt from 'bcryptjs';
import authRouter, { authenticate } from './routes/auth.js';
import entitiesRouter from './routes/entities.js';
import functionsRouter from './routes/functions.js';
import uploadRouter from './routes/upload.js';


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

// --- Static files (images) ---
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// --- Serve React frontend ---
app.use(express.static(join(__dirname, '../dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
  res.sendFile(join(__dirname, '../dist/index.html'));
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Setup route (one-time init)
app.get('/setup', async (req, res) => {
  try {
    await sequelize.sync({ force: true });
    const password_hash = await bcrypt.hash('admin123', 10);
    await User.create({ email: 'admin@fixit.local', password_hash, full_name: 'Administrateur', role: 'admin' });
    await Setting.create({ shop_name: 'Fixit', currency: 'MAD', currency_symbol: 'DH' });
    res.json({ success: true, message: 'Base initialisée ✅ — admin@fixit.local / admin123' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Start server ---
async function start() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion MySQL réussie');

    // sync: alter updates tables without dropping data
    await sequelize.sync({ alter: true });
    console.log('✅ Base de données synchronisée');

    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Erreur de démarrage:', err.message);
    process.exit(1);
  }
}

start();
