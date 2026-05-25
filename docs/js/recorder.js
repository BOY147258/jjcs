export class VideoRecorder {
  constructor() {
    this._stream        = null;
    this._recorder      = null;
    this._chunks        = [];
    this._blob          = null;
    this._recording     = false;
    this.hasVideo       = false;
    this._stopComposite = null;
  }

  initFromStream(stream) {
    this._stream  = stream;
    this.hasVideo = stream.getVideoTracks().length > 0;
  }

  // Record raw camera stream (solo/start device)
  start() {
    if (!this._stream || this._recording) return;
    this._chunks = []; this._blob = null;
    this._startRecorder(this._stream);
  }

  // Record composite canvas (video + finish-line overlay) — finish device
  startComposite(videoEl, overlayCanvas, fps = 25) {
    if (this._recording) return;
    this._chunks = []; this._blob = null;

    const W = videoEl.videoWidth  || 1280;
    const H = videoEl.videoHeight || 720;
    const composite = document.createElement('canvas');
    composite.width = W; composite.height = H;
    const ctx = composite.getContext('2d', { alpha: false });

    let rafId;
    const draw = () => {
      if (!this._recording) return;
      try {
        ctx.drawImage(videoEl, 0, 0, W, H);
        if (overlayCanvas) ctx.drawImage(overlayCanvas, 0, 0, W, H);
      } catch {}
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);
    this._stopComposite = () => cancelAnimationFrame(rafId);

    const stream = composite.captureStream(fps);
    this._startRecorder(stream);
  }

  _startRecorder(stream) {
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    const mime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';
    try {
      this._recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    } catch {
      this._recorder = new MediaRecorder(stream);
    }
    this._recorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) this._chunks.push(e.data);
    };
    this._recorder.start(200);
    this._recording = true;
  }

  stop() {
    if (this._stopComposite) { this._stopComposite(); this._stopComposite = null; }
    if (!this._recorder || !this._recording) return Promise.resolve(null);
    return new Promise(resolve => {
      this._recorder.onstop = () => {
        const type = this._recorder.mimeType || 'video/webm';
        this._blob = new Blob(this._chunks, { type });
        this._recording = false;
        resolve(this._blob);
      };
      this._recorder.stop();
    });
  }

  clearBlob() {
    this._blob   = null;
    this._chunks = [];
  }

  getObjectURL() {
    if (!this._blob) return null;
    return URL.createObjectURL(this._blob);
  }

  download(filename) {
    if (!this._blob) return;
    const ext  = this._blob.type.includes('mp4') ? 'mp4' : 'webm';
    const url  = URL.createObjectURL(this._blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename ? `${filename}.${ext}` : `race-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  get recording() { return this._recording; }
  get hasBlob()   { return !!this._blob; }
}
