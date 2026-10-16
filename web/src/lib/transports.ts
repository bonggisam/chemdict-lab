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
// 펌웨어 데모 모드와 같은 데이터를 브라우저 안에서 만듭니다.
export class SimTransport implements Transport {
  kind: TransportKind = 'sim';
  label = '시뮬레이터';
  onLine: (line: string) => void = noop;
  onClose: () => void = noop;
  private timer: number | null = null;
  private start = 0;
  private interval = 1000;
  private slope = -5.7;
  private offset = 21.34;
  private calP1: { v: number; ref: number } | null = null;

  async connect() {
    setTimeout(() => this.hello(), 150);
  }

  private emit(obj: unknown) {
    this.onLine(JSON.stringify(obj));
  }

  private hello() {
    this.emit({
      type: 'hello', fw: 'sim', board: '시뮬레이터', station: 0, demo: true, interval: this.interval,
      running: this.timer !== null,
      sensors: [
        { id: 'pH', name: 'pH', unit: '', src: 'A0', cal: false },
        { id: 'L', name: '빛', unit: '%', src: 'A1', cal: false },
        { id: 'EC', name: '전도도', unit: 'V', src: 'A2', cal: false },
        { id: 'V', name: '전압', unit: 'V', src: 'A3', cal: false },
        { id: 'T', name: '온도', unit: '°C', src: 'demo', cal: false },
      ],
    });
  }

  private noise(a: number) {
    return (Math.random() * 2 - 1) * a;
  }

  /** 시뮬레이터의 pH 전극 '전압' (보정 체험용): 적정 곡선을 전압으로 거꾸로 환산 */
  private phVolt(t: number) {
    const ph = 2.8 + 8.4 / (1 + Math.exp(-(t - 60) / 4)) + this.noise(0.03);
    return (ph - 21.34) / -5.7;
  }

  private temp(t: number) {
    let T = t < 140 ? 22 - 22 * (t / 140) : t < 220 ? 0 : -0.06 * (t - 220);
    if (T < -10) T = -10;
    return T + this.noise(0.05);
  }

  private tick() {
    const t = (performance.now() - this.start) / 1000;
    const r = (x: number, d: number) => Number(x.toFixed(d));
    this.emit({
      type: 'd', t: r(t, 2),
      v: {
        pH: r(this.slope * this.phVolt(t) + this.offset, 2),
        L: r(50 + 10 * Math.sin(t / 10) + this.noise(0.5), 1),
        EC: r(1.2 + 0.002 * t + this.noise(0.01), 3),
        V: r(1.1 + this.noise(0.005), 3),
        T: r(this.temp(t), 2),
      },
    });
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
    } else if (C === 'CAL' && args[0] === 'pH') {
      const t = (performance.now() - this.start) / 1000;
      const v = this.phVolt(this.timer !== null ? t : 0);
      if (args[1]?.toUpperCase() === 'CLEAR') {
        this.slope = -5.7; this.offset = 21.34; this.emit({ type: 'ack', cmd: 'CAL' });
      } else if (args[1] === '1') {
        this.calP1 = { v, ref: Number(args[2]) }; this.emit({ type: 'ack', cmd: 'CAL' });
      } else if (args[1] === '2' && this.calP1) {
        // 시뮬레이터는 실제 용액이 없으므로 이상적인 전극 값으로 보정된 것처럼 응답
        this.slope = -5.7;
        this.offset = 21.34;
        this.calP1 = null;
        this.emit({ type: 'cal', id: 'pH', slope: r4(this.slope), offset: r4(this.offset), points: 2 });
      } else this.emit({ type: 'err', cmd: 'CAL', msg: 'record point 1 first' });
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
