import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

import { sequelize, User, Shop, Setting } from '../models/index.js';

async function init() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connexion MySQL réussie');

    await sequelize.sync({ force: true });
    console.log('✅ Tables créées (force: true — données existantes effacées)');

    // Create super_admin user (no shop)
    const superAdminHash = await bcrypt.hash('superadmin123', 10);
    await User.create({
      email: 'superadmin@fixit.local',
      password_hash: superAdminHash,
      full_name: 'Super Administrateur',
      role: 'super_admin',
      shop_id: null,
    });
    console.log('✅ Super admin créé : superadmin@fixit.local / superadmin123');

    // Create demo shop
    const demoShop = await Shop.create({
      name: 'Fixit Demo',
      email: 'admin@fixit.local',
      subscription_status: 'demo',
      plan: 'pro',
    });
    console.log(`✅ Boutique démo créée : ${demoShop.name} (id: ${demoShop.id})`);

    // Create admin user for demo shop
    const adminHash = await bcrypt.hash('admin123', 10);
    await User.create({
      email: 'admin@fixit.local',
      password_hash: adminHash,
      full_name: 'Administrateur',
      role: 'admin',
      shop_id: demoShop.id,
    });
    console.log('✅ Admin démo créé : admin@fixit.local / admin123');

    // Create default settings for demo shop
    await Setting.create({
      shop_id: demoShop.id,
      shop_name: 'Fixit Demo',
      currency: 'MAD',
      currency_symbol: 'DH',
    });
    console.log('✅ Paramètres par défaut créés pour la boutique démo');

    console.log('\n🎉 Base de données initialisée avec succès !');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

init();
