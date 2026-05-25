// Cross-device synchronization via WebSocket
export class Sync {
  constructor() {
    this.room       = null;
    this.role       = null;
    this.clientId   = null;
    this._offset    = 0;   // performance.now() + offset ≈ server Date.now()
    this._ws        = null;
    this._cbs       = new Map();
    this.connected  = false;
    this.peerOnline = false;
    this.peers      = [];  // array of { role, clientId } for all current peers
  }

  get finishPeerCount() {
    return this.peers.filter(p => p.role === 'finish').length;
  }

  // Calibrate local clock against server (NTP-lite)
  async calibrate(attempts = 5) {
    const offsets = [];
    for (let i = 0; i < attempts; i++) {
      const t1 = performance.now();
      const r  = await fetch('/ping');
      const t4 = performance.now();
      const { serverTime } = await r.json();
      offsets.push(serverTime - (t1 + (t4 - t1) / 2));
      if (i < attempts - 1) await new Promise(r => setTimeout(r, 40));
    }
    offsets.sort((a, b) => a - b);
    this._offset = offsets[Math.floor(offsets.length / 2)];
  }

  // Server-synchronized "now" in ms (comparable across devices)
  serverNow() { return performance.now() + this._offset; }

  // Join a room via WebSocket
  async join(room, role) {
    this.room = room;
    this.role = role;
    await this.calibrate();

    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url   = `${proto}//${location.host}/ws?room=${encodeURIComponent(room)}&role=${encodeURIComponent(role)}`;
      this._ws    = new WebSocket(url);

      this._ws.onmessage = e => {
        try {
          const event = JSON.parse(e.data);

          if (event.type === 'JOINED') {
            this.clientId   = event.clientId;
            this.connected  = true;
            this.peers      = (event.peers || []).map(r => ({ role: r, clientId: null }));
            this.peerOnline = this.peers.length > 0;
            resolve(event);
          }

          if (event.type === 'PEER_JOINED') {
            this.peers.push({ role: event.role, clientId: event.clientId });
            this.peerOnline = true;
          }

          if (event.type === 'PEER_LEFT') {
            this.peers = this.peers.filter(p => p.clientId !== event.clientId);
            this.peerOnline = this.peers.length > 0;
          }

          const cbs = this._cbs.get(event.type) || [];
          cbs.forEach(cb => cb(event));
          const all = this._cbs.get('*') || [];
          all.forEach(cb => cb(event));
        } catch {}
      };

      this._ws.onerror = () => {
        if (!this.connected) reject(new Error('WebSocket connection failed'));
      };

      this._ws.onclose = () => {
        if (!this.connected) reject(new Error('Connection closed before joining'));
      };

      setTimeout(() => {
        if (!this.connected) reject(new Error('Connection timeout'));
      }, 8000);
    });
  }

  // Send event to all peers in room via WebSocket
  send(type, data = {}) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const event = { type, ...data, _serverTime: this.serverNow(), _role: this.role };
    this._ws.send(JSON.stringify(event));
  }

  on(type, cb) {
    if (!this._cbs.has(type)) this._cbs.set(type, []);
    this._cbs.get(type).push(cb);
  }

  disconnect() {
    this._ws?.close();
    this._ws      = null;
    this.connected = false;
    this.peers     = [];
  }
}

// Generate a random 4-digit room code (used as default suggestion)
export function generateRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
