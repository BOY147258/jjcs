export class VideoRecorder {
  constructor() {
    this._stream        = null;
    this._recorder      = null;
    this._chunks        = [];
    this._blob          = null;
    this._recording     = false;
    this.hasVideo       = false;
  }

  initFromStream(stream) {
    this._stream  = stream;
    this.hasVideo = stream.getVideoTracks().length > 0;
  }

  start() {
    if (!this._stream || this._recording) return;
    this._chunks = [];
    this._blob   = null;

    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4',
    ];
    const mime = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';

    try {
      this._recorder = new MediaRecorder(this._stream, mime ? { mimeType: mime } : {});
    } catch {
      this._recorder = new MediaRecorder(this._stream);
    }

    this._recorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) this._chunks.push(e.data);
    };
    this._recorder.start(200);
    this._recording = true;
  }

  stop() {
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
