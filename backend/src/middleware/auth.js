const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fixit-secret-change-in-production';

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }
  const token = auth.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 'admin' legacy → traité comme 'superadmin'
function effectiveRole(role) {
  return role === 'admin' ? 'superadmin' : role;
}

function requireRole(...roles) {
  return (req, res, next) => {
    const er = effectiveRole(req.user?.role);
    if (!roles.includes(er)) {
      return res.status(403).json({ error: 'Accès refusé — droits insuffisants' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, signToken, JWT_SECRET, effectiveRole };
