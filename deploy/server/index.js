import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import { sequelize } from './models/index.js';
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


// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

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
