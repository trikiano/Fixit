require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./db');

async function seed() {
  console.log('🌱 Démarrage du seeding...');

  // --- Utilisateur admin ---
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@fixit.local' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@fixit.local',
      password_hash: hash,
      name: 'Administrateur',
      role: 'admin',
    },
  });
  console.log(`✅ Admin créé: ${admin.email}`);

  const existingClients = await prisma.client.count();
  if (existingClients > 0) {
    console.log('ℹ️  Données de démonstration déjà présentes, seeding ignoré.');
    return;
  }

  // --- Clients ---
  const clients = [
    { full_name: 'Mohamed Benali', phone: '+213661234567', email: 'mbenali@gmail.com', segment: 'particulier', address: '12 Rue Didouche Mourad, Alger', credit_balance: 0 },
    { full_name: 'Fatima Zahra Touati', phone: '+213770987654', email: 'fztouati@yahoo.fr', segment: 'particulier', address: '5 Cité des Orangers, Oran', credit_balance: 2500 },
    { full_name: 'SARL TechnoPlus', phone: '+213555111222', email: 'contact@technoplusalger.dz', segment: 'professionnel', address: 'Zone Industrielle Rouïba, Alger', credit_balance: 15000 },
    { full_name: 'Karim Meziane', phone: '+213699445566', email: 'kmeziane@hotmail.com', segment: 'particulier', address: '8 Boulevard Krim Belkacem, Constantine', credit_balance: 0 },
    { full_name: 'Amina Ouali', phone: '+213779332211', email: 'aouali@gmail.com', segment: 'particulier', address: '22 Rue Ibn Badis, Sétif', credit_balance: 500 },
    { full_name: 'EURL InfoNet Services', phone: '+213556778899', email: 'info@infonetservices.dz', segment: 'professionnel', address: '3 Rue des Frères Bouadou, Blida', credit_balance: 8000 },
    { full_name: 'Yacine Rahmani', phone: '+213661002233', email: null, segment: 'particulier', address: '', credit_balance: 0 },
    { full_name: 'Nadia Bensalem', phone: '+213770556677', email: 'nbensalem@outlook.fr', segment: 'particulier', address: '14 Cité El Harrach, Alger', credit_balance: 1200 },
  ];

  const createdClients = [];
  for (const c of clients) {
    const cl = await prisma.client.create({ data: c });
    createdClients.push(cl);
  }
  console.log(`✅ ${createdClients.length} clients créés`);

  // --- Fournisseurs ---
  const suppliers = [
    { name: 'Samsung Electronics DZ', contact_name: 'Rachid Boulahia', phone: '+213555100200', email: 'bdz@samsung.com', address: 'Centre Commercial Bab Ezzouar, Alger', payment_terms: '30j' },
    { name: 'Apple Premium Reseller', contact_name: 'Sofiane Aït Ahmed', phone: '+213556300400', email: 'sait@applereseller.dz', address: '9 Rue Hassiba Benbouali, Alger', payment_terms: '15j' },
    { name: 'Xiaomi Distribution Maghreb', contact_name: 'Walid Djaouadi', phone: '+213699500600', email: 'wdjaouadi@xiaomi-maghreb.com', address: 'Zone Industrielle Bousmail, Tipaza', payment_terms: '30j' },
    { name: 'PiecesPhone Pro', contact_name: 'Hamza Chérif', phone: '+213770700800', email: 'hcherif@piecesphonepro.dz', address: '47 Rue Larbi Tébessi, Alger', payment_terms: 'comptant' },
    { name: 'Algérie Telecom Entreprises', contact_name: 'Souad Merad', phone: '+213555900100', email: 'smerad@algerietelecom.dz', address: '1 Boulevard Ben Boulaid, Alger', payment_terms: '60j' },
  ];

  const createdSuppliers = [];
  for (const s of suppliers) {
    const sup = await prisma.supplier.create({ data: s });
    createdSuppliers.push(sup);
  }
  console.log(`✅ ${createdSuppliers.length} fournisseurs créés`);

  // --- Produits ---
  const products = [
    { name: 'Samsung Galaxy A54 5G', sku: 'SAM-A54-128', category: 'telephone', brand: 'Samsung', model: 'Galaxy A54 5G', buy_price: 42000, sell_price: 52000, quantity: 5, min_stock: 2, condition: 'neuf' },
    { name: 'iPhone 14 128Go Minuit', sku: 'APP-IP14-128', category: 'telephone', brand: 'Apple', model: 'iPhone 14', buy_price: 95000, sell_price: 118000, quantity: 3, min_stock: 1, condition: 'neuf', imei: '356789012345678' },
    { name: 'Xiaomi Redmi Note 13', sku: 'XIA-RN13-256', category: 'telephone', brand: 'Xiaomi', model: 'Redmi Note 13', buy_price: 28000, sell_price: 35000, quantity: 8, min_stock: 3, condition: 'neuf' },
    { name: 'Samsung Galaxy A54 (Reconditionné)', sku: 'SAM-A54-R', category: 'telephone', brand: 'Samsung', model: 'Galaxy A54', buy_price: 22000, sell_price: 30000, quantity: 2, min_stock: 1, condition: 'reconditionne' },
    { name: 'iPad Air 5ème génération', sku: 'APP-IPA5-64', category: 'tablette', brand: 'Apple', model: 'iPad Air 5', buy_price: 68000, sell_price: 85000, quantity: 2, min_stock: 1, condition: 'neuf' },
    { name: 'PC Portable HP Pavilion 15', sku: 'HP-PAV15-512', category: 'ordinateur', brand: 'HP', model: 'Pavilion 15-eh3', buy_price: 78000, sell_price: 98000, quantity: 4, min_stock: 2, condition: 'neuf' },
    { name: 'Lenovo IdeaPad 3 (Occasion)', sku: 'LEN-IP3-OCC', category: 'ordinateur', brand: 'Lenovo', model: 'IdeaPad 3', buy_price: 35000, sell_price: 48000, quantity: 1, min_stock: 1, condition: 'occasion' },
    { name: 'Chargeur USB-C 65W', sku: 'CHG-65W-USBC', category: 'chargeur', brand: 'Générique', model: '65W PD', buy_price: 1200, sell_price: 2500, quantity: 15, min_stock: 5, condition: 'neuf' },
    { name: 'Câble Lightning 2m', sku: 'CBL-LGT-2M', category: 'cable', brand: 'Apple', model: 'Lightning USB', buy_price: 800, sell_price: 1800, quantity: 20, min_stock: 5, condition: 'neuf' },
    { name: 'Écran Samsung Galaxy A52', sku: 'PIE-SCR-A52', category: 'piece_detachee', brand: 'Samsung', model: 'Galaxy A52 Screen', buy_price: 5500, sell_price: 8000, quantity: 3, min_stock: 2, condition: 'neuf' },
    { name: 'Batterie iPhone 13', sku: 'PIE-BAT-IP13', category: 'piece_detachee', brand: 'Apple', model: 'iPhone 13 Battery', buy_price: 2800, sell_price: 4500, quantity: 6, min_stock: 3, condition: 'neuf' },
    { name: 'Coque Silicone Samsung S23', sku: 'ACC-COQ-S23', category: 'accessoire', brand: 'Générique', model: 'S23 Case', buy_price: 300, sell_price: 800, quantity: 25, min_stock: 5, condition: 'neuf' },
    { name: 'Verre Trempé iPhone 14', sku: 'ACC-VTR-IP14', category: 'accessoire', brand: 'Générique', model: 'iPhone 14 Tempered', buy_price: 200, sell_price: 700, quantity: 30, min_stock: 10, condition: 'neuf' },
    { name: 'Clé USB 64Go', sku: 'ACC-USB-64', category: 'accessoire', brand: 'SanDisk', model: 'Ultra 64Go', buy_price: 900, sell_price: 1600, quantity: 0, min_stock: 3, condition: 'neuf' },
  ];

  const createdProducts = [];
  for (const p of products) {
    const prod = await prisma.product.create({ data: p });
    createdProducts.push(prod);
  }
  console.log(`✅ ${createdProducts.length} produits créés`);

  // --- Réparations ---
  const repairData = [
    {
      ticket_number: 'REP-ABC001',
      client_name: 'Mohamed Benali',
      client_phone: '+213661234567',
      device_type: 'smartphone',
      device_brand: 'Samsung',
      device_model: 'Galaxy A52',
      device_imei: '356789012300001',
      problem_description: 'Écran fissuré suite à chute, tactile ne répond plus correctement',
      diagnosis: 'Dalle LCD + vitre à remplacer',
      status: 'en_reparation',
      priority: 'haute',
      technician: 'Administrateur',
      estimated_cost: 9000,
      final_cost: 8500,
      deposit_amount: 3000,
      warranty_days: 90,
      parts_used: [{ product_id: createdProducts[9].id, product_name: 'Écran Samsung Galaxy A52', quantity: 1, unit_price: 5500, total: 5500 }],
      payments: [{ amount: 3000, method: 'especes', date: new Date(Date.now() - 2*86400000).toISOString(), notes: 'Acompte réception' }],
    },
    {
      ticket_number: 'REP-ABC002',
      client_name: 'Fatima Zahra Touati',
      client_phone: '+213770987654',
      device_type: 'smartphone',
      device_brand: 'Apple',
      device_model: 'iPhone 13',
      problem_description: 'Batterie se décharge en moins de 4 heures',
      diagnosis: 'Batterie dégradée, remplacement nécessaire',
      status: 'pret',
      priority: 'normale',
      technician: 'Administrateur',
      estimated_cost: 5000,
      final_cost: 4500,
      deposit_amount: 0,
      warranty_days: 90,
      parts_used: [{ product_id: createdProducts[10].id, product_name: 'Batterie iPhone 13', quantity: 1, unit_price: 2800, total: 2800 }],
      payments: [],
    },
    {
      ticket_number: 'REP-ABC003',
      client_name: 'Yacine Rahmani',
      client_phone: '+213661002233',
      device_type: 'ordinateur_portable',
      device_brand: 'HP',
      device_model: 'Laptop 15s',
      problem_description: 'Ne démarre plus, voyant power clignote',
      diagnosis: 'En cours de diagnostic',
      status: 'diagnostic',
      priority: 'normale',
      technician: 'Administrateur',
      estimated_cost: 0,
      final_cost: 0,
      deposit_amount: 0,
      warranty_days: 90,
      parts_used: [],
      payments: [],
    },
    {
      ticket_number: 'REP-ABC004',
      client_name: 'Karim Meziane',
      client_phone: '+213699445566',
      device_type: 'smartphone',
      device_brand: 'Xiaomi',
      device_model: 'Redmi Note 10',
      problem_description: 'Haut-parleur grésille, son très faible',
      diagnosis: null,
      status: 'reception',
      priority: 'basse',
      technician: null,
      estimated_cost: 2500,
      final_cost: 0,
      deposit_amount: 1000,
      warranty_days: 90,
      parts_used: [],
      payments: [{ amount: 1000, method: 'especes', date: new Date().toISOString(), notes: 'Acompte' }],
    },
    {
      ticket_number: 'REP-ABC005',
      client_name: 'Nadia Bensalem',
      client_phone: '+213770556677',
      device_type: 'smartphone',
      device_brand: 'Apple',
      device_model: 'iPhone 11',
      problem_description: 'Port lightning endommagé, charge intermittente',
      diagnosis: 'Connecteur de charge à remplacer',
      status: 'en_attente_pieces',
      priority: 'haute',
      technician: 'Administrateur',
      estimated_cost: 6000,
      final_cost: 5800,
      deposit_amount: 2000,
      warranty_days: 90,
      parts_used: [],
      payments: [{ amount: 2000, method: 'virement', date: new Date(Date.now() - 86400000).toISOString(), notes: 'Acompte virement' }],
    },
    {
      ticket_number: 'REP-ABC006',
      client_name: 'Amina Ouali',
      client_phone: '+213779332211',
      device_type: 'tablette',
      device_brand: 'Samsung',
      device_model: 'Galaxy Tab A8',
      problem_description: 'Écran qui clignote, lignes horizontales',
      diagnosis: 'Connecteur nappe défaillant ou LCD endommagé',
      status: 'livre',
      priority: 'normale',
      technician: 'Administrateur',
      estimated_cost: 7000,
      final_cost: 7000,
      deposit_amount: 7000,
      warranty_days: 90,
      parts_used: [],
      payments: [{ amount: 7000, method: 'especes', date: new Date(Date.now() - 5*86400000).toISOString(), notes: 'Paiement complet à la livraison' }],
    },
  ];

  for (const r of repairData) {
    await prisma.repair.create({ data: r });
  }
  console.log(`✅ ${repairData.length} réparations créées`);

  // --- Ventes ---
  const salesData = [
    {
      sale_number: 'VNT-X1A001',
      ticket_number: 'VNT-X1A001',
      type: 'vente',
      client_name: 'Mohamed Benali',
      items: [{ product_id: createdProducts[8].id, product_name: 'Câble Lightning 2m', quantity: 2, unit_price: 1800, total: 3600 }, { product_id: createdProducts[12].id, product_name: 'Verre Trempé iPhone 14', quantity: 1, unit_price: 700, total: 700 }],
      subtotal: 4300,
      total: 4300,
      tax_amount: 0,
      discount: 0,
      payment_method: 'especes',
      status: 'completee',
    },
    {
      sale_number: 'VNT-X1A002',
      ticket_number: 'VNT-X1A002',
      type: 'vente',
      client_name: 'SARL TechnoPlus',
      items: [{ product_id: createdProducts[5].id, product_name: 'PC Portable HP Pavilion 15', quantity: 2, unit_price: 98000, total: 196000 }],
      subtotal: 196000,
      total: 196000,
      tax_amount: 0,
      discount: 5000,
      payment_method: 'virement',
      status: 'completee',
    },
    {
      sale_number: 'VNT-X1A003',
      ticket_number: 'VNT-X1A003',
      type: 'vente',
      client_name: 'Passager',
      items: [{ product_id: createdProducts[0].id, product_name: 'Samsung Galaxy A54 5G', quantity: 1, unit_price: 52000, total: 52000 }],
      subtotal: 52000,
      total: 52000,
      tax_amount: 0,
      discount: 0,
      payment_method: 'especes',
      status: 'completee',
    },
    {
      sale_number: 'VNT-X1A004',
      ticket_number: 'VNT-X1A004',
      type: 'vente',
      client_name: 'Amina Ouali',
      items: [{ product_id: createdProducts[11].id, product_name: 'Coque Silicone Samsung S23', quantity: 1, unit_price: 800, total: 800 }, { product_id: createdProducts[7].id, product_name: 'Chargeur USB-C 65W', quantity: 1, unit_price: 2500, total: 2500 }],
      subtotal: 3300,
      total: 3300,
      tax_amount: 0,
      discount: 0,
      payment_method: 'cb',
      status: 'completee',
    },
  ];

  for (const s of salesData) {
    await prisma.sale.create({ data: s });
  }
  console.log(`✅ ${salesData.length} ventes créées`);

  // --- Dépenses ---
  const today = new Date().toISOString().slice(0, 10);
  const expenses = [
    { description: 'Loyer boutique mois de juin', amount: 45000, category: 'loyer', payment_method: 'virement', date: today },
    { description: 'Achat outillage réparation (tournevis spéciaux iPhone)', amount: 8500, category: 'fournitures', payment_method: 'especes', date: today },
    { description: 'Facture électricité', amount: 12000, category: 'electricite', payment_method: 'especes', date: today },
    { description: 'Abonnement internet fibre professionnelle', amount: 4500, category: 'internet', payment_method: 'carte', date: today },
    { description: 'Salaire technicien mai', amount: 65000, category: 'salaire', payment_method: 'virement', date: today },
    { description: 'Achat emballages et accessoires vitrine', amount: 3200, category: 'fournitures', payment_method: 'especes', date: today },
  ];

  for (const e of expenses) {
    await prisma.expense.create({ data: e });
  }
  console.log(`✅ ${expenses.length} dépenses créées`);

  // --- Commandes fournisseur ---
  await prisma.purchaseOrder.create({
    data: {
      order_number: 'CMD-2024-001',
      supplier_id: createdSuppliers[0].id,
      supplier_name: createdSuppliers[0].name,
      items: [
        { product_id: createdProducts[0].id, product_name: 'Samsung Galaxy A54 5G', quantity_ordered: 10, quantity_received: 5, unit_price: 42000 },
        { product_id: createdProducts[9].id, product_name: 'Écran Samsung Galaxy A52', quantity_ordered: 5, quantity_received: 5, unit_price: 5500 },
      ],
      total_amount: 10 * 42000 + 5 * 5500,
      status: 'partielle',
      expected_date: new Date(Date.now() + 7*86400000).toISOString().slice(0, 10),
      notes: 'Commande urgente, écrans épuisés',
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      order_number: 'CMD-2024-002',
      supplier_id: createdSuppliers[3].id,
      supplier_name: createdSuppliers[3].name,
      items: [
        { product_id: createdProducts[10].id, product_name: 'Batterie iPhone 13', quantity_ordered: 10, quantity_received: 0, unit_price: 2800 },
      ],
      total_amount: 10 * 2800,
      status: 'brouillon',
      expected_date: new Date(Date.now() + 14*86400000).toISOString().slice(0, 10),
      notes: 'En attente de validation',
    },
  });
  console.log('✅ 2 commandes fournisseur créées');

  // --- Garanties ---
  await prisma.warranty.create({
    data: {
      type: 'reparation',
      reference_number: 'REP-ABC002',
      client_name: 'Fatima Zahra Touati',
      product_name: 'iPhone 13 — Remplacement batterie',
      start_date: today,
      end_date: new Date(Date.now() + 90*86400000).toISOString().slice(0, 10),
      status: 'active',
    },
  });
  await prisma.warranty.create({
    data: {
      type: 'vente',
      reference_number: 'VNT-X1A003',
      client_name: 'Passager',
      product_name: 'Samsung Galaxy A54 5G',
      start_date: today,
      end_date: new Date(Date.now() + 365*86400000).toISOString().slice(0, 10),
      status: 'active',
    },
  });
  console.log('✅ 2 garanties créées');

  // --- Caisse du jour ---
  await prisma.cashRegister.create({
    data: {
      date: today,
      opening_balance: 50000,
      status: 'ouverte',
    },
  });
  console.log('✅ Caisse du jour créée');

  // --- Promotions ---
  await prisma.promotion.createMany({
    data: [
      { name: 'Soldes été 10%', code: 'ETE10', type: 'pourcentage', value: 10, min_purchase: 5000, applicable_to: 'tous', is_active: true },
      { name: 'Réduction Pro 500 DA', code: 'PRO500', type: 'montant', value: 500, min_purchase: 20000, applicable_to: 'tous', is_active: true },
      { name: 'Fidélité 5%', code: 'FIDELITE5', type: 'pourcentage', value: 5, min_purchase: 0, applicable_to: 'tous', is_active: false },
    ],
  });
  console.log('✅ 3 promotions créées');

  // --- Factures fournisseurs ---
  await prisma.supplierInvoice.create({
    data: {
      invoice_number: 'FACT-2024-001',
      supplier_id: createdSuppliers[0].id,
      supplier_name: createdSuppliers[0].name,
      description: 'Livraison Samsung Galaxy A54 5G x10',
      invoice_date: today,
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      total_amount: 420000,
      amount_paid: 200000,
      remaining_debt: 220000,
      status: 'partielle',
      payments: [{ date: today, amount: 200000, method: 'virement', notes: 'Premier versement' }],
    },
  });
  console.log('✅ 1 facture fournisseur créée');

  // --- Mouvements de stock ---
  for (const prod of createdProducts.slice(0, 3)) {
    await prisma.stockMovement.create({
      data: {
        product_id: prod.id,
        product_name: prod.name,
        type: 'entree',
        quantity: prod.quantity,
        previous_stock: 0,
        new_stock: prod.quantity,
        reason: 'Stock initial',
        reference_type: 'initialisation',
      },
    });
  }
  console.log('✅ Mouvements de stock initiaux créés');

  // --- Services ---
  const cat = await prisma.serviceCategory.create({
    data: { name: 'Diagnostic', description: 'Services de diagnostic matériel', color: '#3b82f6', is_active: true },
  });
  const catRecharge = await prisma.serviceCategory.create({
    data: { name: 'Recharge & Forfaits', description: 'Vente de crédit et forfaits via cartes prépayées', color: '#22c55e', is_active: true },
  });

  const serviceItemsData = [
    { name: 'Diagnostic standard', category_id: cat.id, category_name: cat.name, price: 500, cost_price: 0, sell_price: 500, duration: 30, is_active: true },
    { name: 'Récupération de données', category_id: cat.id, category_name: cat.name, price: 3500, cost_price: 0, sell_price: 3500, duration: 120, is_active: true },
    { name: 'Nettoyage interne PC', category_id: cat.id, category_name: cat.name, price: 1500, cost_price: 0, sell_price: 1500, duration: 45, is_active: true },
    { name: 'Recharge Ooredoo 10 DT', category_id: catRecharge.id, category_name: catRecharge.name, price: 10, cost_price: 9, sell_price: 10, is_active: true },
    { name: 'Recharge Orange 20 DT', category_id: catRecharge.id, category_name: catRecharge.name, price: 20, cost_price: 18, sell_price: 20, is_active: true },
  ];
  const createdServices = [];
  for (const s of serviceItemsData) {
    const item = await prisma.serviceItem.create({ data: s });
    createdServices.push(item);
  }
  console.log(`✅ ${createdServices.length} services créés`);

  // --- Cartes prépayées ---
  const prepaidCardsData = [
    { name: 'Carte Ooredoo Recharge', card_number: 'OOR-001', provider: 'Ooredoo', currency: 'TND', current_balance: 850, total_loaded: 2000, total_spent: 1150, is_active: true },
    { name: 'Carte Orange Tunisie', card_number: 'ORA-002', provider: 'Orange Tunisie', currency: 'TND', current_balance: 1200, total_loaded: 1500, total_spent: 300, is_active: true },
    { name: 'Carte Topnet ADSL', card_number: 'TOP-003', provider: 'Topnet', currency: 'TND', current_balance: 400, total_loaded: 1000, total_spent: 600, is_active: true },
  ];
  const createdCards = [];
  for (const c of prepaidCardsData) {
    const card = await prisma.prepaidCard.create({ data: c });
    createdCards.push(card);
  }
  console.log(`✅ ${createdCards.length} cartes prépayées créées`);

  // --- Recharges de cartes ---
  const topupsData = [
    { card_id: createdCards[0].id, card_name: createdCards[0].name, amount: 1000, old_balance: 0, new_balance: 1000, payment_method: 'especes', date: new Date(Date.now() - 5*86400000).toISOString(), notes: 'Recharge initiale' },
    { card_id: createdCards[1].id, card_name: createdCards[1].name, amount: 1500, old_balance: 0, new_balance: 1500, payment_method: 'especes', date: new Date(Date.now() - 3*86400000).toISOString(), notes: 'Recharge initiale' },
  ];
  for (const t of topupsData) {
    await prisma.cardTopup.create({ data: t });
  }
  console.log(`✅ ${topupsData.length} recharges de cartes créées`);

  // --- Ventes de services ---
  const serviceSalesData = [
    { service_id: createdServices[3].id, service_name: createdServices[3].name, category_id: catRecharge.id, category_name: catRecharge.name, client_name: 'Hichem Trabelsi', client_phone: '+21698123456', card_id: createdCards[0].id, card_name: createdCards[0].name, cost_price: 9, sell_price: 10, payment_method: 'especes', sale_date: new Date(Date.now() - 86400000).toISOString() },
    { service_id: createdServices[4].id, service_name: createdServices[4].name, category_id: catRecharge.id, category_name: catRecharge.name, client_name: 'Salma Gharbi', client_phone: '+21697456789', card_id: createdCards[1].id, card_name: createdCards[1].name, cost_price: 18, sell_price: 20, payment_method: 'carte', sale_date: new Date().toISOString() },
  ];
  for (const s of serviceSalesData) {
    await prisma.serviceSale.create({ data: s });
  }
  console.log(`✅ ${serviceSalesData.length} ventes de services créées`);

  // --- Forfaits internet ---
  const internetPackagesData = [
    { name: 'Forfait 20GB - 30 jours', price: 25, data_amount: '20GB', validity_days: 30, sell_price: 25, cost_price: 18, description: 'Forfait data Ooredoo', supplier_id: createdSuppliers[4].id, supplier_name: createdSuppliers[4].name, is_active: true },
    { name: 'Forfait 50GB - 30 jours', price: 45, data_amount: '50GB', validity_days: 30, sell_price: 45, cost_price: 32, description: 'Forfait data Orange', is_active: true },
  ];
  const createdPackages = [];
  for (const p of internetPackagesData) {
    const pkg = await prisma.internetPackage.create({ data: p });
    createdPackages.push(pkg);
  }
  console.log(`✅ ${createdPackages.length} forfaits internet créés`);

  // --- Ventes de forfaits internet ---
  const internetSalesData = [
    { package_id: createdPackages[0].id, package_name: createdPackages[0].name, client_name: 'Walid Ben Salah', client_phone: '+21622334455', sell_price: 25, cost_price: 18, account_used: 'Compte Principal', data_amount: '20GB', validity_days: 30, payment_method: 'especes', sale_date: new Date(Date.now() - 2*86400000).toISOString() },
    { package_id: createdPackages[1].id, package_name: createdPackages[1].name, client_name: 'Ines Mejri', client_phone: '+21655667788', sell_price: 45, cost_price: 32, account_used: 'Compte 2', data_amount: '50GB', validity_days: 30, payment_method: 'carte', sale_date: new Date().toISOString() },
  ];
  for (const s of internetSalesData) {
    await prisma.internetSale.create({ data: s });
  }
  console.log(`✅ ${internetSalesData.length} ventes de forfaits internet créées`);

  // --- Paiement fournisseur (forfaits internet) ---
  await prisma.supplierPayment.create({
    data: {
      account_name: 'Compte Principal',
      amount_given: 20,
      payment_date: new Date(Date.now() - 86400000).toISOString(),
      sales_count: 1,
      total_sales_amount: 25,
      notes: 'Paiement hebdomadaire fournisseur',
    },
  });
  console.log('✅ 1 paiement fournisseur créé');

  console.log('\n🎉 Seeding terminé avec succès !');
  console.log(`\n📋 Accès admin:`);
  console.log(`   Email    : ${process.env.ADMIN_EMAIL || 'admin@fixit.local'}`);
  console.log(`   Mot de passe : ${process.env.ADMIN_PASSWORD || 'Admin1234!'}`);
}

seed()
  .catch((e) => { console.error('❌ Erreur seeding:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
