// Cross-device synchronization via WebSocket (with auto-reconnect)
export class Sync {
  constructor() {
    this.room              = null;
    this.role              = null;
    this.clientId          = null;
    this._offset           = 0;   // performance.now() + offset ≈ server Date.now()
    this._ws               = null;
    this._cbs              = new Map();
    this.connected         = false;
    this.peerOnline        = false;
    this.peers             = [];
    this._autoReconnect    = true;
    this._reconnectCount   = 0;
    this.rtt               = null;  // median one-way latency in ms (set after calibrate)
  }

  get finishPeerCount() {
    return this.peers.filter(p => p.role === 'finish').length;
  }
  get observerCount() {
    return this.peers.filter(p => p.role === 'observer').length;
  }

  // Calibrate local clock against server (NTP-lite)
  async calibrate(attempts = 5) {
    const offsets = [];
    const rtts    = [];
    for (let i = 0; i < attempts; i++) {
      try {
        const t1    = performance.now();
        const pingUrl = this._serverHost
          ? `https://${this._serverHost}/ping`
          : '/ping';
        const r  = await fetch(pingUrl, { cache: 'no-store' });
        const t4 = performance.now();
        if (!r.ok) break;                        // no server — skip silently
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('json')) break;         // got HTML 404, not JSON
        const { serverTime } = await r.json();
        if (!serverTime) break;
        offsets.push(serverTime - (t1 + (t4 - t1) / 2));
        rtts.push(t4 - t1);
        if (i < attempts - 1) await new Promise(r => setTimeout(r, 40));
      } catch { break; }                         // network error — skip silently
    }
    if (offsets.length > 0) {
      offsets.sort((a, b) => a - b);
      this._offset = offsets[Math.floor(offsets.length / 2)];
      rtts.sort((a, b) => a - b);
      this.rtt = Math.round(rtts[Math.floor(rtts.length / 2)] / 2);
    }
    // If no server available, _offset stays 0 (use local clock)
  }

  // Server-synchronized "now" in ms (comparable across devices)
  serverNow() { return performance.now() + this._offset; }

  // Join a room via WebSocket (initial connection)
  // serverHost: optional override, e.g. 'jjcs.onrender.com'
  async join(room, role, serverHost) {
    this.room            = room;
    this.role            = role;
    this._serverHost     = serverHost || null;
    this._autoReconnect  = true;
    this._reconnectCount = 0;
    await this.calibrate();
    return this._connect(true);
  }

  // Internal: create/replace the WebSocket
  _connect(firstTime) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn, v) => { if (!settled) { settled = true; fn(v); } };

      const host  = this._serverHost || location.host;
      const proto = (this._serverHost || location.protocol === 'https:') ? 'wss:' : 'ws:';
      const url   = `${proto}//${host}/ws?room=${encodeURIComponent(this.room)}&role=${encodeURIComponent(this.role)}`;
      this._ws    = new WebSocket(url);

      this._ws.onmessage = e => {
        try {
          const event = JSON.parse(e.data);

          if (event.type === 'JOINED') {
            this.clientId        = event.clientId;
            this.connected       = true;
            this._reconnectCount = 0;
            this.peers           = (event.peers || []).map(r => ({ role: r, clientId: null }));
            this.peerOnline      = this.peers.length > 0;
            if (firstTime) {
              settle(resolve, event);
            } else {
              // Reconnected — fire RECONNECTED callbacks
              (this._cbs.get('RECONNECTED') || []).forEach(cb => cb(event));
            }
          }

          if (event.type === 'PEER_JOINED') {
            this.peers.push({ role: event.role, clientId: event.clientId });
            this.peerOnline = true;
          }
          if (event.type === 'PEER_LEFT') {
            this.peers      = this.peers.filter(p => p.clientId !== event.clientId);
            this.peerOnline = this.peers.length > 0;
          }

          const cbs = this._cbs.get(event.type) || [];
          cbs.forEach(cb => cb(event));
          const all = this._cbs.get('*') || [];
          all.forEach(cb => cb(event));
        } catch {}
      };

      this._ws.onerror = () => {
        if (firstTime) settle(reject, new Error('WebSocket connection failed'));
      };

      this._ws.onclose = () => {
        const wasConnected = this.connected;
        this.connected  = false;
        this.peerOnline = false;

        if (firstTime && !wasConnected) {
          settle(reject, new Error('Connection closed before joining'));
          return;
        }

        // Fire DISCONNECTED callbacks so UI can show reconnect indicator
        (this._cbs.get('DISCONNECTED') || []).forEach(cb => cb({}));

        // Auto-reconnect with exponential backoff (max 20s)
        if (this._autoReconnect && this.room) {
          const delay = Math.min(1200 * (1.6 ** this._reconnectCount), 20000);
          this._reconnectCount++;
          setTimeout(() => this._reconnect(), delay);
        }
      };

      if (firstTime) {
        setTimeout(() => settle(reject, new Error('Connection timeout')), 8000);
      }
    });
  }

  async _reconnect() {
    try {
      await this.calibrate(2);
      this._connect(false); // fire-and-forget; reconnect loop handled via onclose
    } catch { /* onclose will retry */ }
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
    this._autoReconnect = false;
    this._ws?.close();
    this._ws       = null;
    this.connected = false;
    this.peers     = [];
  }
}

// Generate a random 4-digit room code (used as default suggestion)
export function generateRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}
