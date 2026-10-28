// 부품 도우미: 부품 찾기(모델명) · 저항 계산 · 센서 함께 쓰기 검사
// 애플 앱 PartsHelper.swift와 같은 규칙 (PROTOCOL.md 11장)
import { connectors, hasQwiic, partSupported, parts, type Board, type Part } from './guide';
import { E12, nearestE } from './resistor';
import { tk } from './i18n';

// ---------- 부품 찾기 ----------
/** 이름에서 모델명 낱말 (숫자가 들어간 영문 낱말): 'HC-SR04', 'MQ-135', 'DS18B20' … */
export function modelTokens(name: string): string[] {
  const out: string[] = [];
  for (const m of name.matchAll(/[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*/g)) {
    const w = m[0];
    if (w.length >= 3 && /\d/.test(w)) out.push(norm(w));
  }
  return out;
}
/** 대문자로, 글자·숫자만 */
export function norm(s: string) { return s.toUpperCase().replace(/[^A-Z0-9]/g, ''); }

// 이름에 없는 흔한 다른 이름
const ALIASES: Record<string, string[]> = {
  dht: ['AM2302', 'DHT11', 'DHT22'],
  hcsr04: ['HCSR04', 'SR04'],
};

/** 글(사진에서 읽은 글자나 직접 쓴 모델명) → 맞는 부품 (잘 맞는 순, 최대 5개) */
export function findParts(text: string, list: Part[] = parts): Part[] {
  const words = text.split(/[\s,;:|/()[\]{}]+/).map(norm).filter((w) => w.length >= 2);
  const all = norm(text);
  if (!words.length) return [];
  const scored: { p: Part; s: number; n: number }[] = [];
  for (const p of list) {
    const toks = [...modelTokens(p.name), ...(ALIASES[p.id] ?? [])];
    let s = 0;
    for (const tk of new Set(toks)) {
      if (words.includes(tk)) s += 10;                       // 낱말이 그대로 맞음
      else if (tk.length >= 5 && all.includes(tk)) s += 6;   // 붙어 쓴 글 안에 있음 (HCSR04ULTRASONIC)
      else if (tk.length >= 4 && words.some((w) => w.length >= 4 && (w.startsWith(tk) || tk.startsWith(w)))) s += 3;
    }
    if (s > 0) scored.push({ p, s, n: toks.length });
  }
  // 점수 높은 순, 같으면 모델명이 적은(더 구체적인) 부품 먼저
  return scored.sort((a, b) => b.s - a.s || a.n - b.n).slice(0, 5).map((x) => x.p);
}

// ---------- 저항 계산 ----------
export const LED_VF: Record<string, number> = { red: 2.0, yellow: 2.1, green: 2.2, blue: 3.0, white: 3.0 };

export function ledResistor(vs: number, vf: number, mA: number) {
  const r = (vs - vf) / (mA / 1000);
  if (!(r > 0) || !isFinite(r)) return null;
  const std = nearestE(r, E12, true);
  const actual = ((vs - vf) / std) * 1000;
  const mw = ((vs - vf) ** 2 / std) * 1000;
  return { r, std, actualMa: actual, mw };
}

export function dividerOut(vin: number, r1: number, r2: number) {
  return r1 + r2 > 0 ? (vin * r2) / (r1 + r2) : NaN;
}

/** vin → vout이 되게 E12 저항 두 개 고르기 (합 10 kΩ~200 kΩ, vout을 넘지 않게) */
export function bestDivider(vin: number, vout: number) {
  if (!(vin > 0) || !(vout > 0) || vout >= vin) return null;
  const vals: number[] = [];
  for (const k of [100, 1000, 10000]) for (const e of E12) vals.push((e * k) / 10);
  let best: { r1: number; r2: number; vout: number; err: number } | null = null;
  for (const r1 of vals) for (const r2 of vals) {
    const sum = r1 + r2;
    if (sum < 10000 || sum > 200000) continue;
    const v = dividerOut(vin, r1, r2);
    if (v > vout * 1.005) continue;                 // 넘으면 센서·보드가 위험할 수 있음
    const err = Math.abs(v - vout) + (r1 + r2 === 20000 ? -1e-4 : 0);
    if (!best || err < best.err - 1e-9) best = { r1, r2, vout: v, err };
  }
  return best && { r1: best.r1, r2: best.r2, vout: best.vout };
}

// ---------- 센서 함께 쓰기 검사 ----------
export type Msg = { key: string; p?: Record<string, string | number> };
export interface TogetherCheck { errors: Msg[]; warns: Msg[]; ports: Record<string, string> }

/** 같은 선을 여러 센서가 나눠 써도 되는 핀 (애플 앱 MultiPlan.sharable과 같음) */
const SHARABLE = new Set(['PWR', 'PWR5', 'PWR3', 'GND', 'SDA', 'SCL', 'ONEWIRE', 'TC_SCK', 'TC_SO', 'SPI_SDI']);
const ANALOG = ['A0', 'A1', 'A2', 'A3'];
export const USB_BUDGET_MA = 400;

export function short(name: string) { return name.replace(/ \(.*\)$/, '').replace(/ \/ .*$/, ''); }
export function addrList(a?: string) { return (a ?? '').split('/').map((x) => x.trim().toLowerCase()).filter(Boolean); }

export function checkTogether(board: Board, list: Part[], label: (p: Part) => string = (p) => short(p.name)): TogetherCheck {
  const errors: Msg[] = [], warns: Msg[] = [];
  const ports: Record<string, string> = {};
  const free = [...ANALOG];
  const pinOwner: Record<string, string> = {};
  const seen = new Set<string>();
  let ma = 0;
  for (const p of list) {
    const c = connectors[p.connector];
    if (!c) continue;
    const name = label(p);
    if (!partSupported(board, p)) errors.push({ key: tk('{a}: {board}의 측정 프로그램이 읽지 못하는 센서입니다.'), p: { a: name, board: board.name } });
    if (seen.has(p.id) && p.connector !== 'onewire') errors.push({ key: tk('{a}은(는) 한 개만 쓸 수 있습니다.'), p: { a: name } });
    seen.add(p.id);
    ma += p.currentMa ?? 0;
    if (p.analogType) {
      if (p.connector === 'pulse') ports[p.id] = 'D3';
      else if (free.length) ports[p.id] = free.shift()!;
      else errors.push({ key: tk('{a}: 아날로그 포트(A0~A3) 4개를 모두 썼습니다.'), p: { a: name } });
    }
    const qwiic = c.cable === true && hasQwiic(board);
    if (!qwiic) {
      for (const w of c.wires) {
        if (SHARABLE.has(w.pin) || w.pin === 'A') continue;
        const pin = board.pins?.[w.pin] ?? w.pin;
        if (pinOwner[pin] && pinOwner[pin] !== name) errors.push({ key: tk('{a}와(과) {b}가 같은 핀({pin})을 씁니다. 둘 중 하나만 고르세요.'), p: { a: pinOwner[pin], b: name, pin } });
        else pinOwner[pin] = name;
      }
    }
  }
  // I2C 주소: 주소 후보가 하나라도 겹치면 함께 쓸 수 없음 (측정 프로그램이 같은 종류를 하나만 찾음)
  const i2c = list.filter((p) => addrList(p.addr).length);
  for (let i = 0; i < i2c.length; i++) for (let j = i + 1; j < i2c.length; j++) {
    if (i2c[i].id === i2c[j].id) continue;   // 같은 부품 두 개는 위에서 처리
    const shared = addrList(i2c[i].addr).filter((a) => addrList(i2c[j].addr).includes(a));
    if (shared.length) errors.push({ key: tk('{a}와(과) {b}는 I2C 주소({addr})가 겹쳐 함께 쓸 수 없습니다.'), p: { a: label(i2c[i]), b: label(i2c[j]), addr: shared.join('·') } });
  }
  if (ma >= USB_BUDGET_MA) warns.push({ key: tk('전류가 많이 듭니다 (약 {ma} mA). 컴퓨터 USB 대신 DC 잭(7~12 V)이나 충전기 전원을 쓰세요.'), p: { ma } });
  return { errors, warns, ports };
}
