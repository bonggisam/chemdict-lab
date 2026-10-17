// 저장: 그래프 그림(PNG) · PDF 보고서 · 엑셀/Numbers(.xlsx) · CSV
import { LIGHT, cssVar, drawChart, renderChartImage, withLight, type DrawOpts } from './chartDraw';
import { canvasesToPdf } from './pdf';
import { buildXlsx, safeSheetName, type Cell, type XChart, type XSeries, type XSheet } from './xlsx';

export interface ReportChart {
  title: string;          // "온도 (°C)"
  yTitle: string;
  sensorCol: number;      // runs[].rows 안의 열 번호 (y)
  xCol?: number;          // 가로축 열 (기본 0 = 시간·입력값)
  opts: DrawOpts;
  trend?: XSeries['trend'];
}

export interface ReportRun { name: string; colorIndex: number; head: string[]; rows: Cell[][] } // rows[0]열 = x

export interface Report {
  title: string;
  meta: string[];           // 날짜 · 모둠 · 방식 · 간격
  xTitle: string;
  logX?: boolean;
  charts: ReportChart[];
  summary: { head: string[]; rows: string[][] };
  notes: string[];          // 맞춘 식, 접선·넓이 등
  runs: ReportRun[];
}

const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

// ---------------------------------------------------------------- 캔버스 표
function textFit(ctx: CanvasRenderingContext2D, t: string, w: number) {
  if (ctx.measureText(t).width <= w) return t;
  let s = t;
  while (s.length > 1 && ctx.measureText(s + '…').width > w) s = s.slice(0, -1);
  return s + '…';
}
function drawTable(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, head: string[], rows: string[][], rowH = 24): number {
  const n = head.length;
  const first = Math.min(width * 0.28, 170);
  const w = n > 1 ? (width - first) / (n - 1) : width;
  const cx = (i: number) => (i === 0 ? x : x + first + (i - 1) * w);
  const cw = (i: number) => (i === 0 ? first : w);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = LIGHT['--tint']; ctx.fillRect(x, y, width, rowH);
  ctx.font = `600 12px ${FONT}`; ctx.fillStyle = LIGHT['--ink'];
  head.forEach((h, i) => ctx.fillText(textFit(ctx, h, cw(i) - 10), cx(i) + 5, y + rowH / 2));
  y += rowH;
  ctx.font = `12px ${FONT}`;
  for (const r of rows) {
    ctx.strokeStyle = LIGHT['--line']; ctx.beginPath(); ctx.moveTo(x, y + 0.5); ctx.lineTo(x + width, y + 0.5); ctx.stroke();
    ctx.fillStyle = LIGHT['--ink'];
    r.forEach((c, i) => ctx.fillText(textFit(ctx, c, cw(i) - 10), cx(i) + 5, y + rowH / 2));
    y += rowH;
  }
  return y;
}

function header(ctx: CanvasRenderingContext2D, r: Report, W: number, M: number): number {
  ctx.fillStyle = LIGHT['--accent']; ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = LIGHT['--ink']; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.font = `700 22px ${FONT}`; ctx.fillText(r.title, M, M);
  ctx.font = `13px ${FONT}`; ctx.fillStyle = LIGHT['--muted'];
  ctx.fillText(r.meta.join('  ·  '), M, M + 32);
  return M + 60;
}

function notesBlock(ctx: CanvasRenderingContext2D, notes: string[], x: number, y: number, width: number): number {
  ctx.font = `13px ${FONT}`; ctx.fillStyle = LIGHT['--ink']; ctx.textBaseline = 'top';
  for (const n of notes) { ctx.fillText(textFit(ctx, '• ' + n, width), x, y); y += 20; }
  return y;
}

// ---------------------------------------------------------------- PNG: 모든 그래프 + 해석 한 장
export function reportImage(r: Report): HTMLCanvasElement {
  return withLight(() => {
    const W = 1000, M = 28, CH = 380, scale = 2;
    const sumH = r.summary.rows.length ? 24 * (r.summary.rows.length + 1) + 20 : 0;
    const H = M + 60 + r.charts.length * (CH + 40) + sumH + r.notes.length * 20 + M;
    const c = document.createElement('canvas');
    c.width = W * scale; c.height = H * scale;
    const ctx = c.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    let y = header(ctx, r, W, M);
    for (const ch of r.charts) {
      const img = renderChartImage(ch.title, ch.opts, W - 2 * M, CH, 1);
      ctx.drawImage(img, M, y);
      y += CH + 40;
    }
    if (r.summary.rows.length) y = drawTable(ctx, M, y, W - 2 * M, r.summary.head, r.summary.rows) + 20;
    notesBlock(ctx, r.notes, M, y, W - 2 * M);
    return c;
  });
}

// ---------------------------------------------------------------- PDF: A4 보고서 (그래프 → 해석 → 데이터 표)
export async function reportPdf(r: Report): Promise<Blob> {
  const pages = withLight(() => {
    const W = 794, H = 1123, M = 48, scale = 2;
    const out: HTMLCanvasElement[] = [];
    const page = () => {
      const c = document.createElement('canvas');
      c.width = W * scale; c.height = H * scale;
      const ctx = c.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      out.push(c);
      return ctx;
    };
    let ctx = page();
    let y = header(ctx, r, W, M);
    const CH = r.charts.length > 2 ? 260 : 320;
    for (const ch of r.charts) {
      if (y + CH + 40 > H - M) { ctx = page(); y = M; }
      ctx.save(); ctx.translate(M, y);
      ctx.fillStyle = LIGHT['--ink']; ctx.font = `600 14px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      ctx.fillText(ch.title, 0, 0);
      ctx.translate(0, 24);
      drawChart(ctx, W - 2 * M, CH, { ...ch.opts, hover: null }, true);
      ctx.restore();
      y += CH + 40;
    }
    // 범례
    if (r.runs.length > 1) {
      ctx.font = `12px ${FONT}`; ctx.textBaseline = 'middle';
      let x = M;
      for (const run of r.runs) {
        ctx.fillStyle = cssVar(`--s${run.colorIndex + 1}`, '#2a78d6'); ctx.fillRect(x, y - 24, 11, 11);
        ctx.fillStyle = LIGHT['--muted']; ctx.fillText(run.name, x + 16, y - 18);
        x += ctx.measureText(run.name).width + 34;
      }
    }
    if (r.summary.rows.length) {
      const need = 24 * (r.summary.rows.length + 1) + 50 + r.notes.length * 20;
      if (y + need > H - M) { ctx = page(); y = M; }
      ctx.fillStyle = LIGHT['--ink']; ctx.font = `700 16px ${FONT}`; ctx.textBaseline = 'top';
      ctx.fillText('데이터 해석', M, y); y += 28;
      y = drawTable(ctx, M, y, W - 2 * M, r.summary.head, r.summary.rows) + 14;
      y = notesBlock(ctx, r.notes, M, y, W - 2 * M) + 10;
    }
    // 데이터 표
    for (const run of r.runs) {
      const rows = run.rows.map((row) => row.map((v) => (v === null || v === undefined ? '' : String(v))));
      let i = 0;
      while (i < rows.length) {
        if (y + 24 * 3 + 30 > H - M) { ctx = page(); y = M; }
        ctx.fillStyle = LIGHT['--ink']; ctx.font = `700 15px ${FONT}`; ctx.textBaseline = 'top';
        ctx.fillText(`${run.name} 데이터${i ? ' (이어서)' : ''}`, M, y); y += 26;
        const fit = Math.max(1, Math.floor((H - M - y - 24) / 20));
        y = drawTable(ctx, M, y, W - 2 * M, run.head, rows.slice(i, i + fit), 20) + 20;
        i += fit;
      }
    }
    // 쪽 번호
    out.forEach((c, k) => {
      const g = c.getContext('2d')!;
      g.fillStyle = LIGHT['--muted']; g.font = `11px ${FONT}`; g.textAlign = 'right'; g.textBaseline = 'bottom';
      g.fillText(`ChemDict Lab · ${k + 1} / ${out.length}`, W - M, H - 20);
    });
    return out;
  });
  return canvasesToPdf(pages);
}

// ---------------------------------------------------------------- 엑셀 · Numbers
export function reportXlsx(r: Report): Blob {
  const runSheets: XSheet[] = r.runs.map((run, i) => ({
    name: safeSheetName(uniqueName(run.name, i, r.runs)),
    rows: [run.head, ...run.rows],
    widths: run.head.map((h) => Math.max(10, Math.min(28, h.length * 2 + 2))),
  }));
  const charts: XChart[] = r.charts.map((ch) => ({
    title: ch.title,
    xTitle: r.xTitle,
    yTitle: ch.yTitle,
    logX: r.logX,
    series: r.runs.map((run, i) => ({
      name: run.name,
      sheet: runSheets[i].name,
      xCol: ch.xCol ?? 0,
      yCol: ch.sensorCol,
      r0: 1,
      r1: Math.max(1, run.rows.length),
      color: LIGHT[`--s${run.colorIndex + 1}`].slice(1).toUpperCase(),
      line: !ch.opts.series[i] || ch.opts.series[i].line !== false,
      markers: !!ch.opts.series[i]?.points,
      trend: ch.trend,
    })).filter((_, i) => r.runs[i].rows.length > 0),
  }));
  const summary: XSheet = {
    name: '해석',
    rows: [[r.title], r.meta, [], r.summary.head, ...r.summary.rows.map((row) => row.map(numOrText)), [], ...r.notes.map((n) => [n])],
    boldRows: [0, 3],
    widths: [22, ...r.summary.head.slice(1).map(() => 16)],
  };
  const graph: XSheet = { name: '그래프', rows: [[r.title], [r.meta.join(' · ')]], boldRows: [0], charts, widths: [20] };
  return buildXlsx([graph, summary, ...runSheets]);
}

function uniqueName(name: string, i: number, runs: ReportRun[]) {
  return runs.findIndex((x) => x.name === name) === i ? name : `${name} (${i + 1})`;
}
function numOrText(s: string): Cell {
  const n = Number(s);
  return s.trim() !== '' && isFinite(n) && /^-?[\d.]+(e-?\d+)?$/i.test(s.trim()) ? n : s;
}
