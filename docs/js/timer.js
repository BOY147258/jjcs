export class PrecisionTimer {
  constructor() {
    this._startTime  = 0;
    this._pausedAt   = 0;
    this._running    = false;
    this._rafId      = null;
    this._listeners  = new Set();
  }

  get elapsed() {
    return this._running
      ? performance.now() - this._startTime
      : this._pausedAt;
  }

  get running() { return this._running; }

  start() {
    if (this._running) return;
    this._startTime = performance.now() - this._pausedAt;
    this._running   = true;
    this._tick();
  }

  stop() {
    if (!this._running) return;
    this._pausedAt = this.elapsed;
    this._running  = false;
    cancelAnimationFrame(this._rafId);
    this._emit();
  }

  reset() {
    this.stop();
    this._pausedAt  = 0;
    this._startTime = 0;
    this._emit();
  }

  lap() {
    return this.elapsed;
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _tick() {
    this._emit();
    if (this._running) {
      this._rafId = requestAnimationFrame(() => this._tick());
    }
  }

  _emit() {
    const ms = this.elapsed;
    this._listeners.forEach(fn => fn(ms));
  }

  static format(ms) {
    const t  = Math.max(0, Math.round(ms));
    const mi = Math.floor(t / 60000);
    const se = Math.floor((t % 60000) / 1000);
    const cs = Math.floor((t % 1000) / 10);
    return `${String(mi).padStart(2,'0')}:${String(se).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  }

  static formatFull(ms) {
    const t   = Math.max(0, Math.round(ms));
    const mi  = Math.floor(t / 60000);
    const se  = Math.floor((t % 60000) / 1000);
    const ms2 = t % 1000;
    return `${String(mi).padStart(2,'0')}:${String(se).padStart(2,'0')}.${String(ms2).padStart(3,'0')}`;
  }
}
