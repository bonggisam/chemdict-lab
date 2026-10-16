import { LineAssembler } from './protocol';

export type TransportKind = 'serial' | 'ble' | 'sim';

export interface Transport {
  kind: TransportKind;
  label: string;
  connect(): Promise<void>;
  send(cmd: string): Promise<void>;
  disconnect(): Promise<void>;
  onLine: (line: string) => void;
  onClose: () => void;
}

export const NUS_SERVICE = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const NUS_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // 앱 → 보드
export const NUS_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // 보드 → 앱

export const hasSerial = () => typeof navigator !== 'undefined' && 'serial' in navigator;
export const hasBluetooth = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator;

const noop = () => {};

// ---------------------------------------------------------------- USB (Web Serial)
export class SerialTransport implements Transport {
  kind: TransportKind = 'serial';
  label = 'USB';
  onLine: (line: string) => void = noop;
  onClose: () => void = noop;
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private closing = false;

  async connect() {
    // 아두이노 공식 보드(VID 0x2341)를 먼저 보여 주되, 다른 보드도 고를 수 있게 필터 없이 요청
    this.port = await navigator.serial.requestPort();
    await this.port.open({ baudRate: 115200 });
    const info = this.port.getInfo();
    this.label = info.usbVendorId === 0x2341 ? 'USB · Arduino' : 'USB';
    this.readLoop();
  }

  private async readLoop() {
    const port = this.port;
    if (!port?.readable) return;
    const decoder = new TextDecoder();
    const asm = new LineAssembler((l) => this.onLine(l));
    try {
      this.reader = port.readable.getReader();
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) asm.push(decoder.decode(value, { stream: true }));
      }
    } catch {
      /* 케이블 분리 등 */
    } finally {
      this.reader?.releaseLock();
      this.reader = null;
      if (!this.closing) this.onClose();
    }
  }

  async send(cmd: string) {
    if (!this.port?.writable) return;
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(cmd + '\n'));
    } finally {
      writer.releaseLock();
    }
  }

  async disconnect() {
    this.closing = true;
    try {
      await this.reader?.cancel();
    } catch { /* noop */ }
    try {
      await this.port?.close();
    } catch { /* noop */ }
    this.port = null;
    this.onClose();
  }
}

// ---------------------------------------------------------------- Bluetooth (Web Bluetooth)
export class BleTransport implements Transport {
  kind: TransportKind = 'ble';
  label = '블루투스';
  onLine: (line: string) => void = noop;
  onClose: () => void = noop;
  private device: BluetoothDevice | null = null;
  private rx: BluetoothRemoteGATTCharacteristic | null = null;
  private queue: Promise<void> = Promise.resolve();

  async connect() {
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'ChemDict' }, { services: [NUS_SERVICE] }],
      optionalServices: [NUS_SERVICE],
    });
    this.label = this.device.name ?? '블루투스';
    this.device.addEventListener('gattserverdisconnected', () => this.onClose());
    const server = await this.device.gatt!.connect();
    const service = await server.getPrimaryService(NUS_SERVICE);
    this.rx = await service.getCharacteristic(NUS_RX);
    const tx = await service.getCharacteristic(NUS_TX);
    const decoder = new TextDecoder();
    const asm = new LineAssembler((l) => this.onLine(l));
    tx.addEventListener('characteristicvaluechanged', (e) => {
      const v = (e.target as BluetoothRemoteGATTCharacteristic).value;
      if (v) asm.push(decoder.decode(v, { stream: true }));
    });
    await tx.startNotifications();
  }

  send(cmd: string) {
    // 20바이트 이하 조각으로 순서대로 전송
    const bytes = new TextEncoder().encode(cmd + '\n');
    this.queue = this.queue.then(async () => {
      if (!this.rx) return;
      for (let i = 0; i < bytes.length; i += 20) {
        await this.rx.writeValueWithoutResponse(bytes.slice(i, i + 20));
      }
    }).catch(() => {});
    return this.queue;
  }

  async disconnect() {
    this.device?.gatt?.disconnect();
  }
}

// ---------------------------------------------------------------- 시뮬레이터 (보드 없이 체험)
// 펌웨어 데모 모드와 같은 데이터를 브라우저 안에서 만듭니다. PORT·CAL 명령도 흉내 냅니다.
interface SimPort { type: string; cal: boolean; offsetAdj: number }

export class SimTransport implements Transport {
  kind: TransportKind = 'sim';
  label = '시뮬레이터';
  onLine: (line: string) => void = noop;
  onClose: () => void = noop;
  private timer: number | null = null;
  private start = 0;
  private interval = 1000;
  private ports: SimPort[] = [
    { type: 'pH', cal: false, offsetAdj: 0 },
    { type: 'L', cal: false, offsetAdj: 0 },
    { type: 'EC', cal: false, offsetAdj: 0 },
    { type: 'V', cal: false, offsetAdj: 0 },
  ];
  private calStep1 = new Set<string>();
  private simX: number | null = null; // 값 입력 모드 체험: 앱이 알려 준 '다음 부피'

  async connect() {
    setTimeout(() => this.hello(), 150);
  }

  private emit(obj: unknown) {
    this.onLine(JSON.stringify(obj));
  }

  private portId(i: number) {
    const t = this.ports[i].type;
    const dup = this.ports.slice(0, i).some((p) => p.type === t);
    return dup ? `${t}_A${i}` : t;
  }

  private hello() {
    const sensors = this.ports
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.type !== 'OFF')
      .map(({ p, i }) => ({ id: this.portId(i), type: p.type, name: p.type, unit: '', src: `A${i}`, cal: p.cal }));
    sensors.push({ id: 'T', type: 'T', name: 'T', unit: '', src: 'demo', cal: false });
    this.emit({ type: 'hello', fw: 'sim', board: '시뮬레이터', station: 0, demo: true, interval: this.interval, running: this.timer !== null, sensors });
  }

  private noise(a: number) {
    return (Math.random() * 2 - 1) * a;
  }

  private t() {
    return this.timer !== null ? (performance.now() - this.start) / 1000 : 0;
  }

  private value(type: string, t: number): number {
    switch (type) {
      case 'pH':
        // 값 입력 모드에서는 넣은 NaOH 부피(당량점 10 mL)에 따라, 아니면 시간에 따라 변함
        if (this.simX !== null) return 2.9 + 8.6 / (1 + Math.exp(-(this.simX - 10) / 0.5)) - 1.1 / (1 + this.simX) + this.noise(0.02);
        return 2.8 + 8.4 / (1 + Math.exp(-(t - 60) / 4)) + this.noise(0.02);
      case 'L': return 50 + 10 * Math.sin(t / 10) + this.noise(0.3);
      case 'EC': return 1200 + 2 * t + this.noise(4);
      case 'V': return 1.1 + this.noise(0.004);
      case 'TL':
      case 'T': {
        let T = t < 140 ? 22 - 22 * (t / 140) : t < 220 ? 0 : -0.06 * (t - 220);
        if (T < -10) T = -10;
        return T + this.noise(0.04);
      }
      case 'P': return 101.3 + 0.5 * t + this.noise(0.3);
      default: return 2.5 + this.noise(0.01);
    }
  }

  private tick() {
    const t = this.t();
    const v: Record<string, number> = {};
    this.ports.forEach((p, i) => {
      if (p.type !== 'OFF') v[this.portId(i)] = Number((this.value(p.type, t) + p.offsetAdj).toFixed(3));
    });
    v.T = Number(this.value('T', t).toFixed(2));
    this.emit({ type: 'd', t: Number(t.toFixed(2)), v });
  }

  async send(cmd: string) {
    const [c, ...args] = cmd.trim().split(/\s+/);
    const C = c.toUpperCase();
    if (C === 'HELLO') this.hello();
    else if (C === 'START') {
      this.interval = Math.max(100, Number(args[0]) || 1000);
      if (this.timer !== null) clearInterval(this.timer);
      this.start = performance.now();
      this.timer = window.setInterval(() => this.tick(), this.interval);
      this.emit({ type: 'ack', cmd: 'START' });
      this.tick();
    } else if (C === 'STOP') {
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      this.emit({ type: 'ack', cmd: 'STOP' });
    } else if (C === 'DEMO') {
      this.emit({ type: 'ack', cmd: 'DEMO' });
    } else if (C === 'SIMX') {
      this.simX = args[0] === undefined ? null : Number(args[0]);
    } else if (C === 'PORT') {
      const i = ['A0', 'A1', 'A2', 'A3'].indexOf((args[0] ?? '').toUpperCase());
      if (i < 0 || !args[1]) return this.emit({ type: 'err', cmd: 'PORT', msg: 'port must be A0-A3' });
      this.ports[i] = { type: args[1], cal: false, offsetAdj: 0 };
      this.emit({ type: 'ack', cmd: 'PORT' });
      this.hello();
    } else if (C === 'CAL') {
      const [id, step, ref] = args;
      const i = this.ports.findIndex((_, k) => this.portId(k) === id);
      const port = i >= 0 ? this.ports[i] : null;
      const S = (step ?? '').toUpperCase();
      if (!port && id !== 'T') return this.emit({ type: 'err', cmd: 'CAL', msg: 'unknown sensor' });
      if (S === 'CLEAR') {
        if (port) { port.cal = false; port.offsetAdj = 0; }
        this.emit({ type: 'ack', cmd: 'CAL' });
      } else if (S === 'OFS') {
        if (port) { port.offsetAdj += Number(ref) - (this.value(port.type, this.t()) + port.offsetAdj); port.cal = true; }
        this.emit({ type: 'cal', id, slope: 1, offset: r4(port?.offsetAdj ?? 0), points: 1 });
      } else if (S === '1') {
        this.calStep1.add(id);
        this.emit({ type: 'ack', cmd: 'CAL' });
      } else if (S === '2') {
        if (!this.calStep1.has(id)) return this.emit({ type: 'err', cmd: 'CAL', msg: 'record point 1 first' });
        this.calStep1.delete(id);
        if (port) port.cal = true;
        // 시뮬레이터는 실제 용액이 없으므로 이상적인 전극으로 보정된 것처럼 응답
        this.emit({ type: 'cal', id, slope: -5.7, offset: 21.34, points: 2 });
      }
    } else this.emit({ type: 'err', cmd: C, msg: 'unknown command' });
  }

  async disconnect() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.onClose();
  }
}

function r4(x: number) {
  return Number(x.toFixed(4));
}
