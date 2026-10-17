// 그래프 그리기 (화면 · 그림 저장 · PDF가 같은 함수를 씀)
import type { Pt } from './analysis';

export interface Series {
  id: string;
  name: string;
  color: string;    // CSS 변수 이름 (예: --s1)
  pts: Pt[];
  points: boolean;  // 점 표시
  line?: boolean;   // 선 표시 (기본 true)
}

export interface Overlays {
  curve?: { f: (x: number) => number; x0: number; x1: number; label?: string } | null;
  vlines?: { x: number; label: string }[];
  hband?: { x0: number; x1: number; y: number; label: string } | null;
  area?: { pts: Pt[]; color: string; label: string } | null;
  tangent?: { x: number; y: number; slope: number; label: string } | null;
}

export interface DrawOpts {
  series: Series[];
  xLabel: string;
  unit?: string;
  xLog?: boolean;
  timeAxis?: boolean;
  yMin?: number;
  yMax?: number;
  xRange?: [number, number] | null;   // 확대
  markers?: number[];
  selection?: [number, number] | null;
  overlays?: Overlays;
  prediction?: Pt[];
  drawingPts?: Pt[];
  hover?: { px: number; py: number } | null;
  hoverLabel?: boolean;
}

export interface Scale { x: (v: number) => number; y: (v: number) => number; ix: (px: number) => number; iy: (px: number) => number; W: number; H: number }

export const PAD = { L: 56, R: 16, T: 14, B: 34 };

/** 저장(그림·PDF·엑셀)은 어두운 화면에서도 밝은 색으로 (styles.css :root 밝은 값과 같게) */
export const LIGHT: Record<string, string> = {
  '--surface': '#ffffff', '--ink': '#10222b', '--muted': '#56687a', '--line': '#d5dee2', '--tint': 'rgba(11, 110, 121, 0.08)',
  '--mark': '#b45309', '--accent': '#0b6e79',
  '--s1': '#2a78d6', '--s2': '#eb6834', '--s3': '#1baf7a', '--s4': '#eda100', '--s5': '#e87ba4',
};
let override: Record<string, string> | null = null;
export function withLight<T>(fn: () => T): T {
  override = LIGHT;
  try { return fn(); } finally { override = null; }
}

export function cssVar(name: string, fallback: string) {
  if (override?.[name]) return override[name];
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function drawChart(ctx: CanvasRenderingContext2D, W: number, H: number, o: DrawOpts, forExport = false): Scale {
  const { L, R, T, B } = PAD;
  const { series, xLabel, unit, xLog, timeAxis, yMin, yMax, xRange, markers = [], selection, overlays, prediction = [], drawingPts, hover, hoverLabel = true } = o;
  const cInk = cssVar('--muted', '#5a6876'), cGrid = cssVar('--line', '#d9e0e7'), cText = cssVar('--ink', '#14212e');
  const cMark = cssVar('--mark', '#b45309'), cSel = cssVar('--tint', 'rgba(29,95,168,.08)'), cPred = cssVar('--muted', '#5a6876');
  const font = cssVar('--font', '"Pretendard Variable", Pretendard, system-ui, sans-serif');
  if (forExport) { ctx.fillStyle = cssVar('--surface', '#ffffff'); ctx.fillRect(0, 0, W, H); }
  else ctx.clearRect(0, 0, W, H);
  const pw = W - L - R, ph = H - T - B;

  // ---- 범위
  const fx = (v: number) => (xLog ? Math.log10(Math.max(v, 1e-9)) : v);
  const inX = (x: number) => !xRange || (x >= xRange[0] && x <= xRange[1]);
  const allX: number[] = [], allY: number[] = [];
  for (const s of series) for (const [x, y] of s.pts) if (inX(x)) { allX.push(x); allY.push(y); }
  for (const [x, y] of prediction) if (inX(x)) { allX.push(x); allY.push(y); }
  let x0: number, x1: number;
  if (xRange) {
    x0 = fx(Math.min(...xRange)); x1 = fx(Math.max(...xRange));
  } else if (timeAxis) {
    x0 = 0; x1 = Math.max(10, ...allX);
  } else if (allX.length) {
    x0 = Math.min(...allX.map(fx)); x1 = Math.max(...allX.map(fx));
    const pad = Math.max((x1 - x0) * 0.06, xLog ? 0.3 : 0.5);
    x0 -= pad; x1 += pad;
    if (!xLog && Math.min(...allX) >= 0) x0 = Math.max(x0, Math.min(0, Math.min(...allX)));
  } else { x0 = 0; x1 = xLog ? 3 : 10; }
  if (x1 - x0 < 1e-9) { x0 -= 0.5; x1 += 0.5; }
  let y0 = yMin ?? Infinity, y1 = yMax ?? -Infinity;
  if (yMin === undefined || yMax === undefined) {
    for (const y of allY) { if (yMin === undefined) y0 = Math.min(y0, y); if (yMax === undefined) y1 = Math.max(y1, y); }
    if (!isFinite(y0) || !isFinite(y1)) { y0 = 0; y1 = 1; }
    if (y1 - y0 < 1e-6) { y0 -= 0.5; y1 += 0.5; }
    const pad = (y1 - y0) * 0.08;
    if (yMin === undefined) y0 -= pad;
    if (yMax === undefined) y1 += pad;
  }
  const X = (v: number) => L + ((fx(v) - x0) / (x1 - x0)) * pw;
  const Y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * ph;
  const IX = (px: number) => { const u = x0 + ((px - L) / pw) * (x1 - x0); return xLog ? 10 ** u : u; };
  const IY = (py: number) => y0 + (1 - (py - T) / ph) * (y1 - y0);

  ctx.font = `12px ${font}`;

  // 선택 구간
  if (selection) {
    const a = X(Math.min(...selection)), b = X(Math.max(...selection));
    ctx.fillStyle = cSel;
    ctx.fillRect(Math.max(L, a), T, Math.min(L + pw, b) - Math.max(L, a), ph);
  }

  // 격자
  ctx.strokeStyle = cGrid; ctx.fillStyle = cInk; ctx.lineWidth = 1;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const v of niceTicks(y0, y1, 5)) {
    const yy = Math.round(Y(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(W - R, yy); ctx.stroke();
    ctx.fillText(fmt(v), L - 6, yy);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  if (xLog) {
    for (let e = Math.ceil(x0); e <= Math.floor(x1); e++) ctx.fillText(fmt(10 ** e), X(10 ** e), H - B + 8);
  } else {
    for (const v of niceTicks(x0, x1, 6)) ctx.fillText(fmt(v), X(v), H - B + 8);
  }
  ctx.textAlign = 'right'; ctx.fillText(xLabel, W - R, H - 13);

  ctx.save();
  ctx.beginPath(); ctx.rect(L, T, pw, ph); ctx.clip();

  // 넓이 (곡선 아래)
  if (overlays?.area && overlays.area.pts.length > 1) {
    const a = overlays.area;
    const base = Y(Math.max(y0, Math.min(y1, 0)));
    ctx.fillStyle = cssVar(a.color, '#2a78d6'); ctx.globalAlpha = 0.18;
    ctx.beginPath(); ctx.moveTo(X(a.pts[0][0]), base);
    for (const [x, y] of a.pts) ctx.lineTo(X(x), Y(y));
    ctx.lineTo(X(a.pts[a.pts.length - 1][0]), base); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 평탄 구간
  if (overlays?.hband) {
    const hb = overlays.hband;
    ctx.strokeStyle = cMark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(hb.x0), Y(hb.y)); ctx.lineTo(X(hb.x1), Y(hb.y)); ctx.stroke();
  }

  // 표시(marker)
  ctx.strokeStyle = cMark; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  for (const m of markers) { const xx = Math.round(X(m)) + 0.5; ctx.beginPath(); ctx.moveTo(xx, T); ctx.lineTo(xx, T + ph); ctx.stroke(); }
  ctx.setLineDash([]);

  // 예측선
  const dashed = (pts: Pt[]) => {
    ctx.strokeStyle = cPred; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke();
    ctx.setLineDash([]);
  };
  if (prediction.length > 1) dashed(prediction);

  // 측정 데이터
  for (const s of series) {
    const col = cssVar(s.color, '#2a78d6');
    if (!s.pts.length) continue;
    if (s.line !== false) {
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.stroke();
    }
    if (s.points) {
      ctx.fillStyle = col;
      ctx.strokeStyle = cssVar('--surface', '#fff'); ctx.lineWidth = 1.5;
      const r = s.pts.length > 150 ? 2.5 : 4;
      for (const [x, y] of s.pts) { ctx.beginPath(); ctx.arc(X(x), Y(y), r, 0, Math.PI * 2); ctx.fill(); if (r > 3) ctx.stroke(); }
    } else if (!forExport) {
      const [lx, ly] = s.pts[s.pts.length - 1];
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(lx), Y(ly), 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // 맞춘 함수 곡선
  if (overlays?.curve) {
    const c = overlays.curve;
    ctx.strokeStyle = cText; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    const N = 120;
    let started = false;
    for (let i = 0; i <= N; i++) {
      const u = fx(c.x0) + ((fx(c.x1) - fx(c.x0)) * i) / N;
      const x = xLog ? 10 ** u : u;
      const y = c.f(x);
      if (!isFinite(y)) { started = false; continue; }
      if (started) ctx.lineTo(X(x), Y(y)); else { ctx.moveTo(X(x), Y(y)); started = true; }
    }
    ctx.stroke(); ctx.setLineDash([]);
  }

  // 접선
  if (overlays?.tangent) {
    const t = overlays.tangent;
    const dx = (x1 - x0) * 0.18;
    ctx.strokeStyle = cMark; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(X(t.x - dx), Y(t.y - t.slope * dx)); ctx.lineTo(X(t.x + dx), Y(t.y + t.slope * dx)); ctx.stroke();
    ctx.fillStyle = cMark; ctx.beginPath(); ctx.arc(X(t.x), Y(t.y), 5, 0, Math.PI * 2); ctx.fill();
  }

  if (drawingPts && drawingPts.length > 1) dashed(drawingPts);
  ctx.restore();

  // 글자 표시는 잘리지 않게 바깥에서
  if (overlays?.hband) { const hb = overlays.hband; label(ctx, hb.label, (X(hb.x0) + X(hb.x1)) / 2, Y(hb.y) - 10, cMark, 'center', W, true); }
  for (const v of overlays?.vlines ?? []) {
    const xx = Math.round(X(v.x)) + 0.5;
    ctx.strokeStyle = cText; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(xx, T); ctx.lineTo(xx, T + ph); ctx.stroke();
    label(ctx, v.label, xx + 6, T + 12, cText, 'left', W, true);
  }
  let ly = T + 12;
  if (overlays?.curve?.label) { label(ctx, overlays.curve.label, L + 8, ly, cText, 'left', W, true); ly += 20; }
  if (overlays?.area) { label(ctx, overlays.area.label, L + 8, ly, cText, 'left', W, true); ly += 20; }
  if (overlays?.tangent) { const t = overlays.tangent; label(ctx, t.label, X(t.x) + 10, Y(t.y) + 16, cMark, 'left', W, true); }

  // 값 읽기
  if (!forExport && hover && hoverLabel) {
    let best: { x: number; y: number; name: string; color: string } | null = null, bd = Infinity;
    for (const s of series) for (const [x, y] of s.pts) {
      const dd = Math.abs(X(x) - hover.px) + Math.abs(Y(y) - hover.py) * 0.3;
      if (dd < bd) { bd = dd; best = { x, y, name: s.name, color: s.color }; }
    }
    if (best && bd < 60) {
      const bx = X(best.x), by = Y(best.y);
      ctx.strokeStyle = cInk; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx + 0.5, T); ctx.lineTo(bx + 0.5, T + ph); ctx.stroke();
      ctx.fillStyle = cssVar(best.color, '#2a78d6'); ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
      const txt = `${series.length > 1 ? best.name + ' · ' : ''}${fmt(best.x)} → ${fmt(best.y)}${unit ? ' ' + unit : ''}`;
      label(ctx, txt, bx + 8, by - 12, cText, 'left', W, true);
    }
  }
  return { x: X, y: Y, ix: IX, iy: IY, W, H };
}

export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, align: CanvasTextAlign, W: number, boxed = false) {
  ctx.font = `13px ${cssVar('--font', '"Pretendard Variable", Pretendard, system-ui, sans-serif')}`;
  const w = ctx.measureText(text).width;
  let lx = align === 'center' ? x - w / 2 : x;
  if (lx + w > W - 4) lx = W - 4 - w;
  if (lx < 4) lx = 4;
  if (boxed) {
    ctx.fillStyle = cssVar('--surface', '#fff');
    ctx.globalAlpha = 0.9; ctx.fillRect(lx - 4, y - 9, w + 8, 18); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, lx, y);
}

export function niceTicks(lo: number, hi: number, n: number): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(6)));
  return out;
}

export function fmt(v: number) {
  if (!isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1000) return v.toFixed(0);
  if (a >= 100) return v.toFixed(1).replace(/\.0$/, '');
  if (a > 0 && a < 0.01) return v.toExponential(1);
  return Number(v.toFixed(2)).toString();
}

/** 그래프 하나를 PNG용 캔버스로 (제목 포함) */
export function renderChartImage(title: string, o: DrawOpts, W = 900, H = 380, scale = 2): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const head = 30;
  c.width = W * scale; c.height = (H + head) * scale;
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = cssVar('--surface', '#fff'); ctx.fillRect(0, 0, W, H + head);
  ctx.fillStyle = cssVar('--ink', '#14212e');
  ctx.font = `600 15px ${cssVar('--font', 'system-ui, sans-serif')}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(title, 12, 9);
  // 범례
  if (o.series.length > 1) {
    let x = W - 12;
    ctx.font = `12px ${cssVar('--font', 'system-ui, sans-serif')}`;
    for (const s of [...o.series].reverse()) {
      const w = ctx.measureText(s.name).width;
      x -= w; ctx.fillStyle = cssVar('--muted', '#555'); ctx.fillText(s.name, x, 11);
      x -= 16; ctx.fillStyle = cssVar(s.color, '#2a78d6'); ctx.fillRect(x, 13, 11, 11);
      x -= 12;
    }
  }
  ctx.translate(0, head);
  drawChart(ctx, W, H, { ...o, hover: null, drawingPts: undefined }, true);
  return c;
}
