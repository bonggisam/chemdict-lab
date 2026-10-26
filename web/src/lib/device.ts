// 2.0: 이 기기(태블릿·휴대폰·노트북)의 내장 센서를 '보드'처럼 다룹니다.
// 보드·시뮬레이터와 같은 줄(hello·d·ack·cal)을 만들어 보내므로 그래프·분석·저장은 그대로 씁니다.
// 센서 종류는 protocol/sensors.json의 src "device", 카드는 protocol/device_sensors.json.
import raw from '../../../protocol/device_sensors.json';
import { c, t } from './i18n';
import type { Part } from './guide';
import type { Transport, TransportKind } from './transports';

export interface DeviceKit {
  id: string;
  name: string;
  category: string;
  provides: string[];
  platforms: string[];
  how: string[];
  cautions: string[];
  ideas: string[];
}

const baseKits: DeviceKit[] = (raw as { kits: DeviceKit[] }).kits;
export const deviceKits: DeviceKit[] = JSON.parse(JSON.stringify(baseKits));

/** 언어가 바뀌면 카드 문구를 바꿈 (lib/l10n.ts relocalize에서 부름) */
export function relocalizeDevice() {
  const list = (key: string, arr: string[]) => arr.map((s, i) => c(`${key}.${i}`, s));
  baseKits.forEach((k, i) => {
    const key = `device.${k.id}`, o = deviceKits[i];
    o.name = c(`${key}.name`, k.name); o.how = list(`${key}.how`, k.how);
    o.cautions = list(`${key}.cautions`, k.cautions); o.ideas = list(`${key}.ideas`, k.ideas);
  });
}

export const MOTION = ['DACC', 'DAX', 'DAY', 'DAZ'];
export const COLOR = ['DCR', 'DCG', 'DCB', 'DAR', 'DAG', 'DAB'];
export const ABSORB = ['DAR', 'DAG', 'DAB'];
export const SOUND = ['DSND', 'DFRQ'];
export const DEVICE_TYPES = [...MOTION, 'DGYR', 'DMAG', 'DBAR', ...SOUND, ...COLOR];

const isIOS = () => typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1));
const hasMedia = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && (typeof window === 'undefined' || window.isSecureContext);
/** 움직임 센서: 터치 기기(태블릿·휴대폰)에서만 (노트북은 이벤트가 오지 않음) */
const hasMotion = () => typeof window !== 'undefined' && 'DeviceMotionEvent' in window && navigator.maxTouchPoints > 0;

/** 이 브라우저에서 쓸 수 있는 센서 종류 (자기장·기압은 웹에서 못 읽음) */
export function deviceTypes(): string[] {
  const out: string[] = [];
  if (hasMotion()) out.push(...MOTION, 'DGYR');
  if (hasMedia()) out.push(...SOUND, ...COLOR);
  return out;
}

export function availableKits(): DeviceKit[] {
  const have = new Set(deviceTypes());
  return deviceKits.filter((k) => k.platforms.includes('web') && k.provides.every((p) => have.has(p)));
}

export const kitUsesCamera = (k: { provides: string[] }) => k.provides.some((p) => COLOR.includes(p));
export const kitUsesMic = (k: { provides: string[] }) => k.provides.some((p) => SOUND.includes(p));
export const kitInterval = (k: DeviceKit) =>
  k.provides.some((p) => MOTION.includes(p) || p === 'DGYR') ? 100 : kitUsesCamera(k) || kitUsesMic(k) ? 200 : 1000;
/** 실험이 기기 센서만으로 되는지 */
export const isDeviceExperiment = (sensors: string[]) => sensors.length > 0 && sensors.every((s) => DEVICE_TYPES.includes(s));
export const canUseDevice = (sensors: string[]) => isDeviceExperiment(sensors) && sensors.every((s) => deviceTypes().includes(s));

/** 센서 카드처럼 쓰는 부품 (바로 측정 실험을 만들 때) */
export function kitPart(k: DeviceKit): Part {
  return {
    id: k.id, name: k.name, category: k.category, connector: 'device', provides: k.provides,
    minSet: 'mini', support: 'verified', items: [], cautions: k.cautions,
  };
}

const noop = () => {};

// ---------------------------------------------------------------- 가상 보드
export class DeviceTransport implements Transport {
  kind: TransportKind = 'device';
  label = t('이 기기');
  onLine: (line: string) => void = noop;
  onClose: () => void = noop;
  /** 지금 실험이 쓰는 센서 종류 (그 장치만 켬 — 권한 창을 필요할 때만) */
  wanted = new Set<string>();
  /** 카메라 미리보기용 (화면이 <video>에 붙임) */
  videoStream: MediaStream | null = null;
  onVideo: (s: MediaStream | null) => void = noop;

  private timer: number | null = null;
  private start = 0;
  private latest: Record<string, number> = {};
  private rgb: { r: number; g: number; b: number } | null = null;
  private blank: { r: number; g: number; b: number } | null = null;
  private motionOn = false;
  private audio: { ctx: AudioContext; stream: MediaStream; an: AnalyserNode; td: Float32Array; fd: Float32Array; raf: number } | null = null;
  private video: { el: HTMLVideoElement; canvas: HTMLCanvasElement; timer: number } | null = null;
  private readonly flip = isIOS() ? -1 : 1;   // iOS Safari는 중력 방향 부호가 반대
  private gen = 0;                               // START·STOP 차례 (권한 창을 기다리는 사이 STOP이 오면 무시)
  private camP: Promise<void> | null = null;     // 카메라 켜는 중 (두 번 켜지 않게)
  private micP: Promise<void> | null = null;

  async connect() {
    // iOS: 움직임 센서 허락은 누른 순간(연결 버튼)에만 물을 수 있음
    const DM = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
    if (hasMotion() && DM?.requestPermission) {
      try { await DM.requestPermission(); } catch { /* 거절해도 소리·카메라는 씀 */ }
    }
    setTimeout(() => this.hello(), 50);
  }

  private emit(obj: unknown) { this.onLine(JSON.stringify(obj)); }

  private hello() {
    const sensors = deviceTypes().map((ty) => ({ id: ty, type: ty, name: ty, unit: '', src: 'device', cal: ABSORB.includes(ty) && !!this.blank }));
    this.emit({ type: 'hello', fw: 'device', board: t('이 기기'), station: 0, demo: false, running: this.timer !== null, sensors });
  }

  get color() { return this.rgb; }
  get hasBlank() { return !!this.blank; }
  /** 흡광도 0 맞추기: 지금 색을 기준(I₀)으로 */
  setBlank(): boolean {
    if (!this.rgb) return false;
    this.blank = { ...this.rgb };
    this.hello();
    return true;
  }

  private absorbance(k: 'r' | 'g' | 'b') {
    if (!this.rgb) return undefined;
    const i0 = this.blank?.[k] ?? 255;
    return -Math.log10(Math.max(this.rgb[k], 0.5) / Math.max(i0, 0.5));
  }

  private value(ty: string): number | undefined {
    switch (ty) {
      case 'DCR': return this.rgb?.r;
      case 'DCG': return this.rgb?.g;
      case 'DCB': return this.rgb?.b;
      case 'DAR': return this.absorbance('r');
      case 'DAG': return this.absorbance('g');
      case 'DAB': return this.absorbance('b');
      default: return this.latest[ty];
    }
  }

  private want(): Set<string> {
    // 실험이 정하지 않았으면 권한을 묻지 않는 움직임만
    return this.wanted.size ? this.wanted : new Set([...MOTION, 'DGYR']);
  }

  private tick() {
    if (this.timer === null) return;
    const tt = (performance.now() - this.start) / 1000;
    const v: Record<string, number> = {};
    const w = this.want();
    for (const ty of deviceTypes()) {
      if (!w.has(ty)) continue;
      const x = this.value(ty);
      if (typeof x === 'number' && Number.isFinite(x)) v[ty] = Number(x.toFixed(4));
    }
    if (Object.keys(v).length) this.emit({ type: 'd', t: Number(tt.toFixed(3)), v });
  }

  async send(cmd: string) {
    const [c0, ...args] = cmd.trim().split(/\s+/);
    const C = c0.toUpperCase();
    if (C === 'HELLO') this.hello();
    else if (C === 'START') {
      const ms = Math.max(20, Number(args[0]) || 1000);
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      const g = ++this.gen;
      this.latest = {};
      await this.startSources();
      if (g !== this.gen) return;   // 기다리는 사이 STOP이나 다른 START가 옴
      this.start = performance.now();
      this.timer = window.setInterval(() => this.tick(), ms);
      this.emit({ type: 'ack', cmd: 'START' });
      setTimeout(() => this.tick(), 150);
    } else if (C === 'STOP') {
      this.gen++;
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      this.stopSources(true);
      this.emit({ type: 'ack', cmd: 'STOP' });
    } else if (C === 'CAL') {
      const id = args[0], what = (args[1] ?? '').toUpperCase();
      if (COLOR.includes(id) && ['OFS', '1', '2'].includes(what) && this.setBlank()) {
        this.emit({ type: 'cal', id, slope: 1, offset: 0, points: 1 });
      } else if (what === 'CLEAR') {
        this.blank = null;
        this.emit({ type: 'ack', cmd: 'CAL' });
        this.hello();
      } else this.emit({ type: 'ack', cmd: 'CAL' });
    } else this.emit({ type: 'ack', cmd: C });
  }

  get running() { return this.timer !== null; }

  async disconnect() {
    this.gen++;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.stopSources(false);
  }

  // ---- 장치 켜고 끄기
  private async startSources() {
    const w = this.want();
    if ([...w].some((x) => MOTION.includes(x) || x === 'DGYR')) this.startMotion();
    if ([...w].some((x) => SOUND.includes(x))) await this.startMic();
    if ([...w].some((x) => COLOR.includes(x))) await this.startCamera();
  }

  private stopSources(keepCamera: boolean) {
    if (this.motionOn) { window.removeEventListener('devicemotion', this.onMotion); this.motionOn = false; }
    this.stopMic();
    if (!keepCamera) this.stopCamera();
  }

  private onMotion = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (a && a.x != null && a.y != null && a.z != null) {
      const x = a.x * this.flip, y = a.y * this.flip, z = a.z * this.flip;
      this.latest.DAX = x; this.latest.DAY = y; this.latest.DAZ = z;
      this.latest.DACC = Math.hypot(x, y, z);
    }
    const r = e.rotationRate;
    if (r && r.alpha != null && r.beta != null && r.gamma != null) {
      this.latest.DGYR = Math.hypot(r.alpha, r.beta, r.gamma) * Math.PI / 180;   // °/s → rad/s
    }
  };

  private startMotion() {
    if (this.motionOn || !hasMotion()) return;
    window.addEventListener('devicemotion', this.onMotion);
    this.motionOn = true;
  }

  private startMic(): Promise<void> {
    if (this.audio) return Promise.resolve();
    return (this.micP ??= this.openMic().finally(() => { this.micP = null; }));
  }

  private async openMic() {
    const g = this.gen;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 4096;
      an.smoothingTimeConstant = 0;
      src.connect(an);
      if (g !== this.gen) { stream.getTracks().forEach((tr) => tr.stop()); ctx.close().catch(noop); return; }   // 그 사이 STOP
      const td = new Float32Array(an.fftSize), fd = new Float32Array(an.frequencyBinCount);
      const loop = () => {
        if (!this.audio) return;
        an.getFloatTimeDomainData(td);
        let sum = 0;
        for (let i = 0; i < td.length; i++) sum += td[i] * td[i];
        const db = Math.max(0, 20 * Math.log10(Math.max(Math.sqrt(sum / td.length), 1e-9)) + 100);
        this.latest.DSND = db;
        this.latest.DFRQ = db < 40 ? 0 : this.peak(an, fd, ctx.sampleRate);
        this.audio.raf = window.setTimeout(loop, 100);
      };
      this.audio = { ctx, stream, an, td, fd, raf: 0 };
      loop();
    } catch {
      this.emit({ type: 'err', cmd: 'MIC', msg: t('마이크 사용을 허용해야 소리를 잴 수 있습니다. 브라우저 주소창의 권한에서 마이크를 켜세요.') });
    }
  }

  /** 가장 센 진동수 (50 Hz 아래는 빼고, 포물선 보간) */
  private peak(an: AnalyserNode, fd: Float32Array, sr: number) {
    an.getFloatFrequencyData(fd);
    const n = an.fftSize, lo = Math.max(1, Math.floor(50 * n / sr));
    let best = lo;
    for (let k = lo; k < fd.length - 1; k++) if (fd[k] > fd[best]) best = k;
    const a = fd[best - 1], b = fd[best], cc = fd[best + 1];
    const den = a - 2 * b + cc;
    const shift = den === 0 || !Number.isFinite(den) ? 0 : 0.5 * (a - cc) / den;
    return (best + shift) * sr / n;
  }

  private stopMic() {
    if (!this.audio) return;
    clearTimeout(this.audio.raf);
    this.audio.stream.getTracks().forEach((tr) => tr.stop());
    this.audio.ctx.close().catch(noop);
    this.audio = null;
  }

  /** 카메라 켜기 (미리보기 창에서도 부름) — 켜는 중이면 같은 약속을 돌려줌 */
  startCamera(): Promise<void> {
    if (this.video) return Promise.resolve();
    return (this.camP ??= this.openCamera().finally(() => { this.camP = null; }));
  }

  private async openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } } });
      const el = document.createElement('video');
      el.muted = true; el.playsInline = true; el.srcObject = stream;
      await el.play().catch(noop);
      const canvas = document.createElement('canvas');
      const timer = window.setInterval(() => this.sample(), 100);
      this.video = { el, canvas, timer };
      this.videoStream = stream;
      this.onVideo(stream);
    } catch {
      this.emit({ type: 'err', cmd: 'CAMERA', msg: t('카메라 사용을 허용해야 색을 잴 수 있습니다. 브라우저 주소창의 권한에서 카메라를 켜세요.') });
    }
  }

  /** 가운데 1/5 사각형의 평균 RGB */
  private sample() {
    const v = this.video;
    if (!v || !v.el.videoWidth) return;
    const w = v.el.videoWidth, h = v.el.videoHeight, side = Math.max(4, Math.floor(Math.min(w, h) / 5));
    v.canvas.width = side; v.canvas.height = side;
    const g = v.canvas.getContext('2d', { willReadFrequently: true });
    if (!g) return;
    g.drawImage(v.el, (w - side) / 2, (h - side) / 2, side, side, 0, 0, side, side);
    const d = g.getImageData(0, 0, side, side).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 8) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    if (n) this.rgb = { r: r / n, g: gg / n, b: b / n };
  }

  stopCamera() {
    if (!this.video) return;
    clearInterval(this.video.timer);
    this.videoStream?.getTracks().forEach((tr) => tr.stop());
    this.video = null;
    this.videoStream = null;
    this.onVideo(null);
  }

  /** 노출 고정 (지원하는 브라우저만) — 0 맞춘 뒤 밝기가 저절로 바뀌지 않게 */
  lockExposure() {
    const tr = this.videoStream?.getVideoTracks()[0];
    const caps = (tr?.getCapabilities?.() ?? {}) as Record<string, unknown>;
    const adv: Record<string, string> = {};
    if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('manual')) adv.exposureMode = 'manual';
    if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('manual')) adv.whiteBalanceMode = 'manual';
    if (tr && Object.keys(adv).length) tr.applyConstraints({ advanced: [adv as MediaTrackConstraintSet] }).catch(noop);
  }
}
