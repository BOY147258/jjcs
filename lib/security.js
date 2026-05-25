import path from 'node:path';

export function normalizeAllowedOrigins(value = '') {
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin, allowlist = []) {
  if (!allowlist.length) return true;
  if (!origin) return true;
  return allowlist.includes(origin);
}

export function applyCorsHeaders(req, res, allowlist = []) {
  const origin = req.headers.origin;
  const allowedOrigin = isOriginAllowed(origin, allowlist) ? (origin || '*') : 'null';

  res.setHeader('Access-Control-Allow-Origin', allowlist.length ? allowedOrigin : '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token');
}

export function isAuthorizedRequest(req, adminToken = '') {
  if (!adminToken) return true;

  const auth = req.headers.authorization || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '';
  const headerToken = req.headers['x-admin-token'] || '';

  return bearer === adminToken || headerToken === adminToken;
}

export function isMutatingMethod(method = '') {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

export function isSafeStaticPath(rootDir, candidatePath) {
  const root = path.resolve(rootDir);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);

  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function isValidRoomCode(room) {
  return typeof room === 'string' && /^[A-Za-z0-9_-]{3,32}$/.test(room);
}

export function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
