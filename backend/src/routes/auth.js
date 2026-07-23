const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../db');
const { requireAuth, requireRole, signToken } = require('../middleware/auth');

const VALID_ROLES = ['superadmin', 'responsable', 'vendeur'];

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants incorrects' });

    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ error: 'Paramètres manquants' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(old_password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Ancien mot de passe incorrect' });

    const hash = await bcrypt.hash(new_password, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { password_hash: hash } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Gestion des utilisateurs (superadmin seulement) ──

// GET /api/auth/lock-screen-users — tout user authentifié (pour l'écran de verrouillage)
router.get('/lock-screen-users', requireAuth, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users
router.get('/users', requireAuth, requireRole('superadmin'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { created_date: 'asc' } });
    res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_date: u.created_date })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users
router.post('/users', requireAuth, requireRole('superadmin'), async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'email, password et name sont requis' });
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  try {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: 'Email déjà utilisé' });
    const hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, password_hash: hash, name, role: role || 'vendeur' } });
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/users/:id
router.patch('/users/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  const { name, role, password } = req.body;
  if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Rôle invalide' });
  try {
    const data = {};
    if (name) data.name = name;
    if (role) data.role = role;
    if (password) data.password_hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/users/:id
router.delete('/users/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
