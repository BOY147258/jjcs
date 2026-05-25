export class AudioDetector {
  constructor() {
    this._ctx       = null;
    this._analyser  = null;
    this._source    = null;
    this._running   = false;
    this._rafId     = null;
    this._cooldown  = false;
    this._threshold = 0.75;   // 0–1
    this._onDetect  = null;
    this._onLevel   = null;
    this._data      = null;
    this.ready      = false;
  }

  get threshold()    { return this._threshold; }
  set threshold(v)   { this._threshold = Math.max(0.01, Math.min(0.99, v)); }

  async initFromStream(stream) {
    this._ctx      = new (window.AudioContext || window.webkitAudioContext)();
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize        = 512;
    this._analyser.smoothingTimeConstant = 0.1;
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) throw new Error('No audio track');
    const audioOnly = new MediaStream([audioTracks[0]]);
    this._source = this._ctx.createMediaStreamSource(audioOnly);
    this._source.connect(this._analyser);
    this._data  = new Uint8Array(this._analyser.frequencyBinCount);
    this.ready  = true;
  }

  /* Returns { level:0-1, waveform: Uint8Array } */
  sample() {
    if (!this._analyser) return null;
    this._analyser.getByteTimeDomainData(this._data);
    let peak = 0;
    for (let i = 0; i < this._data.length; i++) {
      const v = Math.abs(this._data[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    return { level: peak, waveform: this._data };
  }

  startMonitor(onDetect, onLevel) {
    this._onDetect = onDetect;
    this._onLevel  = onLevel;
    this._running  = true;
    this._loop();
  }

  stopMonitor() {
    this._running = false;
    cancelAnimationFrame(this._rafId);
  }

  _loop() {
    if (!this._running) return;
    const s = this.sample();
    if (s) {
      this._onLevel?.(s.level, s.waveform);
      if (s.level >= this._threshold && !this._cooldown) {
        this._cooldown = true;
        this._onDetect?.();
        setTimeout(() => { this._cooldown = false; }, 2500);
      }
    }
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  resume() {
    if (this._ctx?.state === 'suspended') this._ctx.resume();
  }

  destroy() {
    this.stopMonitor();
    this._ctx?.close();
  }
}
