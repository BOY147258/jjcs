// 竞迹 WebSocket 同步服务器 — 专为云端部署设计（Render / Railway）
// 只负责 /ping（时钟同步）和 /ws（WebSocket 房间管理），静态文件由 GitHub Pages 托管
import http from 'http';
import { WebSocketServer } from 'ws';
import {
  applyCorsHeaders,
  isValidDeviceRole,
  isValidRoomCode,
  normalizeAllowedOrigins,
  parsePositiveInt,
} from './lib/security.js';

const PORT = process.env.PORT || 8080;
const ALLOWED_ORIGINS = normalizeAllowedOrigins(process.env.ALLOWED_ORIGINS || '');
const MAX_WS_MESSAGE_BYTES = parsePositiveInt(process.env.MAX_WS_MESSAGE_BYTES, 64 * 1024);

// ── WebSocket 房间管理 ──────────────────────────────────────────────────────
const rooms = new Map(); // roomCode → [{ws, role, id}]
let _nextId = 1;

function broadcast(roomCode, event, excludeId = null) {
  const clients = rooms.get(roomCode) || [];
  const msg = JSON.stringify(event);
  for (const c of clients) {
    if (c.id !== excludeId && c.ws.readyState === 1) {
      try { c.ws.send(msg); } catch {}
    }
  }
}

const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws, req) => {
  const url  = new URL(req.url, 'http://x');
  const room = url.searchParams.get('room');
  const role = url.searchParams.get('role') || 'unknown';
  if (!isValidRoomCode(room)) { ws.close(1008, 'valid room required'); return; }
  if (!isValidDeviceRole(role)) { ws.close(1008, 'valid role required'); return; }

  const id = _nextId++;
  if (!rooms.has(room)) rooms.set(room, []);
  rooms.get(room).push({ ws, role, id });

  const peers = rooms.get(room).filter(c => c.id !== id).map(c => c.role);
  ws.send(JSON.stringify({ type: 'JOINED', clientId: id, role, room, peers }));
  broadcast(room, { type: 'PEER_JOINED', role, clientId: id }, id);

  ws.on('message', data => {
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

  console.log(`[WS] ${role}(${id}) joined room "${room}"  | rooms: ${rooms.size}`);
});

// ── HTTP 请求处理 ──────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS — 允许来自 GitHub Pages 的跨域请求
  applyCorsHeaders(req, res, ALLOWED_ORIGINS);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const urlPath = new URL(req.url, 'http://x').pathname;

  if (urlPath === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ serverTime: Date.now(), ok: true }));
    return;
  }

  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`ok rooms:${rooms.size}`);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('竞迹 WS Server — OK');
});

server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`竞迹 WebSocket 服务器已启动 → port ${PORT}`);
});
