import { useEffect, useRef, useState } from 'react';
import type { Pt } from '../lib/analysis';
import { saveFile } from '../lib/runs';

export interface Series {
  id: string;
  name: string;
  color: string;    // CSS 변수 이름 (예: --s1)
  pts: Pt[];
  points: boolean;  // 이벤트 모드: 점 표시
}

export interface Overlays {
  fit?: { m: number; b: number; x0: number; x1: number; logX?: boolean } | null;
  vlines?: { x: number; label: string }[];
  hband?: { x0: number; x1: number; y: number; label: string } | null;
}

interface Props {
  title: string;
  unit?: string;
  value?: string;
  stable?: boolean | null;
  series: Series[];
  xLabel: string;
  xLog?: boolean;
  timeAxis?: boolean;
  yMin?: number;
  yMax?: number;
  markers?: number[];
  selection: [number, number] | null;
  onSelect: (r: [number, number] | null) => void;
  overlays?: Overlays;
  prediction?: Pt[];
  drawing?: boolean;
  onDrawEnd?: (pts: Pt[]) => void;
  height?: number;
  exportName: string;
}

const L = 52, R = 16, T = 14, B = 34;

/** 센서 하나 = 그래프 하나 (축이 두 개인 그래프는 만들지 않음). 여러 측정은 같은 축에 겹쳐 그림 */
export function Chart(props: Props) {
  const { title, unit, value, stable, series, xLabel, xLog, timeAxis, yMin, yMax, markers = [], selection, onSelect,
    overlays, prediction = [], drawing, onDrawEnd, height = 260, exportName } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<{ x: (v: number) => number; y: (v: number) => number; ix: (px: number) => number; iy: (px: number) => number; W: number; H: number } | null>(null);
  const dragRef = useRef<{ kind: 'sel' | 'draw'; x0: number; pts: Pt[]; moved: boolean } | null>(null);
  const [hover, setHover] = useState<{ px: number; py: number } | null>(null);
  const [tick, setTick] = useState(0);

  // ---- 그리기
  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = wrap.clientWidth, H = height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(ctx, W, H);
    };
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', schedule);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mq.removeEventListener('change', schedule); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, selection, overlays, prediction, markers, hover, tick, height, yMin, yMax, xLog, drawing]);

  function css(name: string, fallback: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  }

  function paint(ctx: CanvasRenderingContext2D, W: number, H: number, forExport = false) {
    const cInk = css('--muted', '#5a6876'), cGrid = css('--line', '#d9e0e7'), cText = css('--ink', '#14212e');
    const cMark = css('--mark', '#b45309'), cSel = css('--tint', 'rgba(29,95,168,.08)'), cPred = css('--muted', '#5a6876');
    if (forExport) { ctx.fillStyle = css('--surface', '#ffffff'); ctx.fillRect(0, 0, W, H); }
    const pw = W - L - R, ph = H - T - B;

    // 범위
    const allX: number[] = [], allY: number[] = [];
    for (const s of series) for (const [x, y] of s.pts) { allX.push(x); allY.push(y); }
    for (const [x, y] of prediction) { allX.push(x); allY.push(y); }
    const fx = (v: number) => (xLog ? Math.log10(Math.max(v, 1e-9)) : v);
    let x0: number, x1: number;
    if (timeAxis) {
      x0 = 0; x1 = Math.max(10, ...allX);
    } else if (allX.length) {
      x0 = Math.min(...allX.map(fx)); x1 = Math.max(...allX.map(fx));
      const pad = Math.max((x1 - x0) * 0.06, xLog ? 0.3 : 0.5);
      x0 -= pad; x1 += pad;
      if (!xLog && Math.min(...allX) >= 0) x0 = Math.max(x0, Math.min(0, Math.min(...allX)));
    } else { x0 = xLog ? 0 : 0; x1 = xLog ? 3 : 10; }
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
    if (!forExport) scaleRef.current = { x: X, y: Y, ix: IX, iy: IY, W, H };

    ctx.clearRect(0, 0, forExport ? 0 : W, forExport ? 0 : H);
    ctx.font = `12px ${css('--font', '"Pretendard Variable", system-ui, sans-serif')}`;

    // 선택 구간
    if (selection) {
      const a = X(Math.min(...selection)), b = X(Math.max(...selection));
      ctx.fillStyle = cSel;
      ctx.fillRect(a, T, b - a, ph);
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

    // 평탄 구간
    if (overlays?.hband) {
      const hb = overlays.hband;
      ctx.strokeStyle = cMark; ctx.lineWidth = 2; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(X(hb.x0), Y(hb.y)); ctx.lineTo(X(hb.x1), Y(hb.y)); ctx.stroke();
      label(ctx, hb.label, (X(hb.x0) + X(hb.x1)) / 2, Y(hb.y) - 8, cMark, 'center', W);
    }

    // 표시(marker)
    ctx.strokeStyle = cMark; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    for (const m of markers) { const xx = Math.round(X(m)) + 0.5; ctx.beginPath(); ctx.moveTo(xx, T); ctx.lineTo(xx, T + ph); ctx.stroke(); }
    ctx.setLineDash([]);

    // 예측선
    if (prediction.length > 1) {
      ctx.strokeStyle = cPred; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath();
      prediction.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.stroke(); ctx.setLineDash([]);
    }

    // 측정 데이터
    ctx.save();
    ctx.beginPath(); ctx.rect(L, T, pw, ph); ctx.clip();
    for (const s of series) {
      const col = css(s.color, '#2a78d6');
      if (s.pts.length) {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        ctx.beginPath();
        s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
        ctx.stroke();
        if (s.points) {
          ctx.fillStyle = col;
          ctx.strokeStyle = css('--surface', '#fff'); ctx.lineWidth = 2;
          for (const [x, y] of s.pts) { ctx.beginPath(); ctx.arc(X(x), Y(y), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        } else {
          const [lx, ly] = s.pts[s.pts.length - 1];
          ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(lx), Y(ly), 4, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    // 직선 맞춤
    if (overlays?.fit) {
      const f = overlays.fit;
      ctx.strokeStyle = cText; ctx.lineWidth = 1.5; ctx.setLineDash([2, 3]);
      const fy = (x: number) => f.m * (f.logX ? Math.log10(x) : x) + f.b;
      ctx.beginPath(); ctx.moveTo(X(f.x0), Y(fy(f.x0))); ctx.lineTo(X(f.x1), Y(fy(f.x1))); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // 세로 기준선 (당량점 등)
    for (const v of overlays?.vlines ?? []) {
      const xx = Math.round(X(v.x)) + 0.5;
      ctx.strokeStyle = cText; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(xx, T); ctx.lineTo(xx, T + ph); ctx.stroke();
      label(ctx, v.label, xx + 6, T + 12, cText, 'left', W);
    }

    // 그리는 중인 예측선
    const d = dragRef.current;
    if (!forExport && d?.kind === 'draw' && d.pts.length > 1) {
      ctx.strokeStyle = cPred; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); d.pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke();
      ctx.setLineDash([]);
    }

    // 마우스 위치 값 읽기
    if (!forExport && hover && !drawing) {
      let best: { x: number; y: number; name: string; color: string } | null = null, bd = Infinity;
      for (const s of series) for (const [x, y] of s.pts) {
        const dd = Math.abs(X(x) - hover.px) + Math.abs(Y(y) - hover.py) * 0.3;
        if (dd < bd) { bd = dd; best = { x, y, name: s.name, color: s.color }; }
      }
      if (best && bd < 60) {
        const bx = X(best.x), by = Y(best.y);
        ctx.strokeStyle = cInk; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx + 0.5, T); ctx.lineTo(bx + 0.5, T + ph); ctx.stroke();
        ctx.fillStyle = css(best.color, '#2a78d6'); ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.fill();
        const txt = `${series.length > 1 ? best.name + ' · ' : ''}${fmt(best.x)} → ${fmt(best.y)}${unit ? ' ' + unit : ''}`;
        label(ctx, txt, bx + 8, by - 12, cText, 'left', W, true);
      }
    }
  }

  // ---- 포인터 (구간 선택, 예측 그리기, 값 읽기)
  const toLocal = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { px: e.clientX - r.left, py: e.clientY - r.top };
  };
  const inPlot = (px: number, py: number) => {
    const s = scaleRef.current;
    return !!s && px >= L && px <= s.W - R && py >= T && py <= s.H - B;
  };

  const onDown = (e: React.PointerEvent) => {
    const { px, py } = toLocal(e);
    const s = scaleRef.current;
    if (!s || !inPlot(px, py)) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    if (drawing) dragRef.current = { kind: 'draw', x0: s.ix(px), pts: [[s.ix(px), s.iy(py)]], moved: false };
    else dragRef.current = { kind: 'sel', x0: s.ix(px), pts: [], moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const { px, py } = toLocal(e);
    const s = scaleRef.current, d = dragRef.current;
    if (!s) return;
    if (d) {
      const x = s.ix(Math.max(L, Math.min(px, s.W - R)));
      if (d.kind === 'draw') {
        const last = d.pts[d.pts.length - 1];
        if (x > last[0]) d.pts.push([x, s.iy(Math.max(T, Math.min(py, s.H - B)))]);
        setTick((t) => t + 1);
      } else {
        if (Math.abs(s.x(x) - s.x(d.x0)) > 6) { d.moved = true; onSelect([d.x0, x]); }
      }
    } else if (e.pointerType === 'mouse') {
      setHover(inPlot(px, py) ? { px, py } : null);
    }
  };
  const onUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.kind === 'draw') { if (d.pts.length > 1) onDrawEnd?.(d.pts); }
    else if (!d.moved) onSelect(null);
    setTick((t) => t + 1);
  };

  const exportPNG = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const W = wrap.clientWidth, H = height, scale = 2;
    const c = document.createElement('canvas');
    c.width = W * scale; c.height = (H + 28) * scale;
    const ctx = c.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = css('--surface', '#fff'); ctx.fillRect(0, 0, W, H + 28);
    ctx.fillStyle = css('--ink', '#14212e'); ctx.font = '600 14px "Pretendard Variable", system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`${title}${unit ? ` (${unit})` : ''}`, 12, 8);
    ctx.translate(0, 28);
    paint(ctx, W, H, true);
    c.toBlob((b) => b && saveFile(b, `${exportName}.png`), 'image/png');
  };

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-label">{title}{unit ? ` (${unit})` : ''}</span>
        <span className="chart-right">
          {stable !== undefined && stable !== null && (
            <span className={`stable ${stable ? 'on' : ''}`}>{stable ? '✓ 안정' : '〰 변하는 중'}</span>
          )}
          <span className="chart-value">{value ?? '—'}</span>
        </span>
      </figcaption>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.id}><i style={{ background: `var(${s.color})` }} />{s.name}</span>
          ))}
          {prediction.length > 1 && <span><i className="pred" />예측</span>}
        </div>
      )}
      <div ref={wrapRef} className={`chart-canvas ${drawing ? 'drawing' : ''}`}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${title} 그래프`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={() => setHover(null)}
        />
      </div>
      <div className="chart-foot">
        <span className="hint">{drawing ? '그래프 위에 예측선을 그리세요' : '드래그해서 구간 선택 · 클릭하면 해제'}</span>
        <button className="link" onClick={exportPNG}>이미지 저장</button>
      </div>
    </figure>
  );
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, align: CanvasTextAlign, W: number, boxed = false) {
  ctx.font = '13px "Pretendard Variable", system-ui, sans-serif';
  const w = ctx.measureText(text).width;
  let lx = align === 'center' ? x - w / 2 : x;
  if (lx + w > W - 4) lx = W - 4 - w;
  if (lx < 4) lx = 4;
  if (boxed) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff';
    ctx.globalAlpha = 0.92; ctx.fillRect(lx - 4, y - 9, w + 8, 18); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, lx, y);
}

function niceTicks(lo: number, hi: number, n: number): number[] {
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
  return Number(v.toFixed(2)).toString();
}
