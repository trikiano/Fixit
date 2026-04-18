import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Non authentifié' });
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

export function requireSuperAdmin(req, res, next) {
  if (req.user?.role !== 'super_admin')
    return res.status(403).json({ error: 'Super admin requis' });
  next();
}

export function requireShopAdmin(req, res, next) {
  if (!['admin', 'super_admin'].includes(req.user?.role))
    return res.status(403).json({ error: 'Admin boutique requis' });
  next();
}

export function checkSubscription(req, res, next) {
  if (req.user?.role === 'super_admin') return next();
  const status = req.user?.subscription_status;
  if (status === 'active' || status === 'demo') return next();
  if (status === 'trial') {
    if (req.user?.trial_ends_at && new Date(req.user.trial_ends_at) > new Date()) return next();
    return res.status(402).json({ error: 'Période d\'essai expirée. Veuillez souscrire un abonnement.' });
  }
  return res.status(402).json({ error: 'Abonnement requis' });
}
