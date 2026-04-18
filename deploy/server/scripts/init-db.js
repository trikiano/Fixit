import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

import { sequelize, User, Setting } from '../models/index.js';

async function init() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion MySQL réussie');

    await sequelize.sync({ force: true });
    console.log('✅ Tables créées (force: true — données existantes effacées)');

    // Create default admin user
    const password_hash = await bcrypt.hash('admin123', 10);
    await User.create({
      email: 'admin@fixit.local',
      password_hash,
      full_name: 'Administrateur',
      role: 'admin',
    });
    console.log('✅ Utilisateur admin créé : admin@fixit.local / admin123');

    // Create default settings
    await Setting.create({ shop_name: 'Fixit', currency: 'MAD', currency_symbol: 'DH' });
    console.log('✅ Paramètres par défaut créés');

    console.log('\n🎉 Base de données initialisée avec succès !');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

init();
