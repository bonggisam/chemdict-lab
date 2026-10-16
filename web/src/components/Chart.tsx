import { useEffect, useRef } from 'react';
import type { Marker, Row } from '../lib/csv';

interface Props {
  rows: Row[];
  sensor: string;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  markers: Marker[];
  height?: number;
}

/** 센서 하나 = 그래프 하나 (축이 두 개인 그래프는 만들지 않음) */
export function Chart({ rows, sensor, label, unit, min, max, markers, height = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = wrap.clientWidth;
      const H = height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const css = getComputedStyle(document.documentElement);
      const cInk = css.getPropertyValue('--muted').trim() || '#5a6876';
      const cGrid = css.getPropertyValue('--line').trim() || '#d9e0e7';
      const cLine = css.getPropertyValue('--accent').trim() || '#1d5fa8';
      const cMark = css.getPropertyValue('--mark').trim() || '#b45309';

      const L = 48, R = 14, T = 12, B = 28;
      const pw = W - L - R, ph = H - T - B;
      ctx.clearRect(0, 0, W, H);

      const pts = rows.filter((r) => typeof r.v[sensor] === 'number');
      const tMax = Math.max(10, pts.length ? pts[pts.length - 1].t : 0);
      let yMin = min ?? Infinity;
      let yMax = max ?? -Infinity;
      if (min === undefined || max === undefined) {
        for (const p of pts) {
          const v = p.v[sensor];
          if (min === undefined) yMin = Math.min(yMin, v);
          if (max === undefined) yMax = Math.max(yMax, v);
        }
        if (!isFinite(yMin) || !isFinite(yMax)) { yMin = 0; yMax = 1; }
        if (yMax - yMin < 1e-6) { yMin -= 0.5; yMax += 0.5; }
        const pad = (yMax - yMin) * 0.08;
        if (min === undefined) yMin -= pad;
        if (max === undefined) yMax += pad;
      }
      const x = (t: number) => L + (t / tMax) * pw;
      const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * ph;

      // 격자와 눈금
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.fillStyle = cInk;
      ctx.strokeStyle = cGrid;
      ctx.lineWidth = 1;
      const yTicks = niceTicks(yMin, yMax, 5);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (const v of yTicks) {
        const yy = Math.round(y(v)) + 0.5;
        ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(W - R, yy); ctx.stroke();
        ctx.fillText(fmt(v), L - 6, yy);
      }
      const xTicks = niceTicks(0, tMax, 6);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (const t of xTicks) ctx.fillText(fmt(t), x(t), H - B + 8);

      // 표시(marker)
      ctx.strokeStyle = cMark;
      ctx.setLineDash([4, 4]);
      for (const m of markers) {
        const xx = Math.round(x(m.t)) + 0.5;
        ctx.beginPath(); ctx.moveTo(xx, T); ctx.lineTo(xx, T + ph); ctx.stroke();
      }
      ctx.setLineDash([]);

      // 데이터 선
      if (pts.length) {
        ctx.strokeStyle = cLine;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach((p, i) => {
          const xx = x(p.t), yy = y(p.v[sensor]);
          if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
        });
        ctx.stroke();
        const last = pts[pts.length - 1];
        ctx.fillStyle = cLine;
        ctx.beginPath(); ctx.arc(x(last.t), y(last.v[sensor]), 4, 0, Math.PI * 2); ctx.fill();
      }
    };

    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', schedule);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mq.removeEventListener('change', schedule); };
  }, [rows, sensor, min, max, markers, height]);

  const last = [...rows].reverse().find((r) => typeof r.v[sensor] === 'number');
  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-label">{label}{unit ? ` (${unit})` : ''}</span>
        <span className="chart-value">{last ? last.v[sensor] : '—'}</span>
      </figcaption>
      <div ref={wrapRef} className="chart-canvas">
        <canvas ref={canvasRef} role="img" aria-label={`${label} 시간 그래프`} />
      </div>
      <div className="chart-x">시간 (s)</div>
    </figure>
  );
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

function fmt(v: number) {
  return Math.abs(v) >= 100 ? v.toFixed(0) : Number(v.toFixed(2)).toString();
}
