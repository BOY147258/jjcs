import http    from 'http';
import https   from 'https';
import fs      from 'fs';
import path    from 'path';
import os      from 'os';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { handleAPI } from './api.js';
import { buildLiveRoomSnapshot } from './lib/live-rooms.js';
import {
  applyCorsHeaders,
  isAuthorizedRequest,
  isValidDeviceRole,
  isSafeStaticPath,
  isValidRoomCode,
  normalizeAllowedOrigins,
  parsePositiveInt,
} from './lib/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = process.env.PORT || 8080;
const HTTPS_PORT= process.env.HTTPS_PORT || 8443;
const DIR       = __dirname;
const ALLOWED_ORIGINS = normalizeAllowedOrigins(process.env.ALLOWED_ORIGINS || '');
const MAX_WS_MESSAGE_BYTES = parsePositiveInt(process.env.MAX_WS_MESSAGE_BYTES, 64 * 1024);

// Try to load self-signed certs for HTTPS (local network camera access)
let tlsOptions = null;
try {
  tlsOptions = {
    key:  fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem')),
  };
} catch { /* no certs — HTTP only */ }

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.webm': 'video/webm',
  '.mp4':  'video/mp4',
  '.ico':  'image/x-icon',
};

// ── WebSocket room management ───────────────────────────────────────────────
const rooms = new Map(); // roomCode → [{ws, role, id}]
let   _nextId = 1;

function broadcast(roomCode, event, excludeId = null) {
  const clients = rooms.get(roomCode) || [];
  const msg     = JSON.stringify(event);
  for (const c of clients) {
    if (c.id !== excludeId && c.ws.readyState === 1 /* OPEN */) {
      try { c.ws.send(msg); } catch {}
    }
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  const urlObj = new URL(req.url, 'http://x');
  const room   = urlObj.searchParams.get('room');
  const role   = urlObj.searchParams.get('role') || 'unknown';
  const latencyMs = Number(urlObj.searchParams.get('latencyMs'));

  if (!isValidRoomCode(room)) { ws.close(1008, 'valid room required'); return; }
  if (!isValidDeviceRole(role)) { ws.close(1008, 'valid role required'); return; }

  const id = _nextId++;
  const joinedAt = Date.now();
  if (!rooms.has(room)) rooms.set(room, []);
  const client = {
    ws,
    role,
    id,
    joinedAt,
    lastSeenAt: joinedAt,
    messages: 0,
    latencyMs: Number.isFinite(latencyMs) && latencyMs >= 0 ? Math.round(latencyMs) : null,
    remoteAddress: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '',
    userAgent: req.headers['user-agent'] || '',
  };
  rooms.get(room).push(client);

  const peers = rooms.get(room).filter(c => c.id !== id).map(c => c.role);
  ws.send(JSON.stringify({ type: 'JOINED', clientId: id, role, room, peers }));
  broadcast(room, { type: 'PEER_JOINED', role, clientId: id }, id);

  ws.on('message', data => {
    client.lastSeenAt = Date.now();
    client.messages += 1;
    if (data.length > MAX_WS_MESSAGE_BYTES) {
      ws.close(1009, 'message too large');
      return;
    }
    try { broadcast(room, JSON.parse(data.toString()), id); } catch {}
  });

  ws.on('close', () => {
    const arr = rooms.get(room);
    if (arr) {
      const idx = arr.findIndex(c => c.id === id);
      if (idx >= 0) arr.splice(idx, 1);
      if (arr.length === 0) rooms.delete(room);
    }
    broadcast(room, { type: 'PEER_LEFT', role, clientId: id });
  });

  console.log(`  [WS] ${role}(${id}) joined room ${room}`);
});

function attachWss(server) {
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://x').pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    } else {
      socket.destroy();
    }
  });
}

// ── Request handler (shared by HTTP and HTTPS) ──────────────────────────────
async function handleRequest(req, res) {
  const urlObj  = new URL(req.url, 'http://x');
  const urlPath = urlObj.pathname;

  // CORS
  applyCorsHeaders(req, res, ALLOWED_ORIGINS);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // ── API ─────────────────────────────────────────────────────────────────
  if (urlPath.startsWith('/api/')) {
    if (urlPath === '/api/live-rooms') {
      return json(res, {
        serverTime: Date.now(),
        rooms: buildLiveRoomSnapshot(rooms),
      });
    }
    return handleAPI(req, res);
  }

  // ── Clock sync ──────────────────────────────────────────────────────────
  if (urlPath === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ serverTime: Date.now() }));
    return;
  }

  // ── Admin SPA fallback ──────────────────────────────────────────────────
  if (urlPath.startsWith('/admin') && !path.extname(urlPath)) {
    fs.readFile(path.join(DIR, 'admin.html'), (e, d) => {
      if (e) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(d);
    });
    return;
  }

  // ── Static files ────────────────────────────────────────────────────────
  let filePath;
  try {
    const requestPath = urlPath === '/' ? '/index.html' : decodeURIComponent(urlPath);
    filePath = path.resolve(DIR, `.${requestPath}`);
  } catch {
    res.writeHead(400); res.end('Bad request'); return;
  }
  if (!isSafeStaticPath(DIR, filePath)) { res.writeHead(403); res.end('Forbidden'); return; }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (readErr, data) => {
    if (readErr) {
      if (ext) { res.writeHead(404); res.end('Not found'); return; }
      fs.readFile(path.join(DIR, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(d2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache, no-store' });
    res.end(data);
  });
}

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const ip = getLocalIP();

if (tlsOptions) {
  // HTTPS server — camera/mic works on all browsers
  const httpsServer = https.createServer(tlsOptions, handleRequest);
  httpsServer.listen(HTTPS_PORT, () => {
    console.log('='.repeat(60));
    console.log('  jjcs 竞迹 — 训练与轻量赛事计时系统');
    console.log('='.repeat(60));
    console.log(`  手机访问 (HTTPS): https://${ip}:${HTTPS_PORT}`);
    console.log(`  管理后台:         https://${ip}:${HTTPS_PORT}/admin`);
    console.log('');
    console.log('  首次访问提示"不安全" → 点"高级"→"继续访问"即可');
    console.log('  之后摄像头麦克风均正常可用');
    console.log('='.repeat(60));
  });
  attachWss(httpsServer);

  // HTTP — if behind a reverse proxy (Cloudflare, Render, nginx) serve directly;
  // if accessed locally, redirect to HTTPS
  const httpRedirect = http.createServer((req, res) => {
    const proto = req.headers['x-forwarded-proto'] || req.headers['cf-visitor'];
    if (proto) return handleRequest(req, res); // behind proxy, already HTTPS externally
    res.writeHead(301, { Location: `https://${ip}:${HTTPS_PORT}${req.url}` });
    res.end();
  });
  httpRedirect.listen(PORT);
  attachWss(httpRedirect);

} else {
  // No certs — HTTP fallback
  const httpServer = http.createServer(handleRequest);
  httpServer.listen(PORT, () => {
    console.log('='.repeat(56));
    console.log('  jjcs 竞迹 (HTTP模式 — 摄像头不可用)');
    console.log('='.repeat(56));
    console.log(`  移动端:   http://${ip}:${PORT}`);
    console.log(`  管理后台: http://${ip}:${PORT}/admin`);
    console.log('='.repeat(56));
  });
  attachWss(httpServer);
}
