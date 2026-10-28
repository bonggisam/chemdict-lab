// 저장: 그래프 그림(PNG) · PDF 보고서 · 엑셀/Numbers(.xlsx) · CSV
import { t } from './i18n';
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
  info: [string, string][]; // 실험 정보 (모둠·이름·날짜 등)
  xTitle: string;
  logX?: boolean;
  charts: ReportChart[];
  summary: { head: string[]; rows: string[][] };
  notes: string[];          // 맞춘 식, 접선·넓이 등
  runs: ReportRun[];
  worksheet?: ReportWorksheet; // 활동지 (예측·결론 질문)
}

export interface ReportWorksheet { prediction: string; answers: { q: string; a: string }[] }

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

const INFO_COLS = 2, INFO_ROW = 22;
export const infoHeight = (r: Report) => (r.info.length ? Math.ceil(r.info.length / INFO_COLS) * INFO_ROW + 16 : 0);

function header(ctx: CanvasRenderingContext2D, r: Report, W: number, M: number): number {
  ctx.fillStyle = LIGHT['--accent']; ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = LIGHT['--ink']; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.font = `700 22px ${FONT}`; ctx.fillText(r.title, M, M);
  ctx.font = `13px ${FONT}`; ctx.fillStyle = LIGHT['--muted'];
  ctx.fillText(r.meta.join('  ·  '), M, M + 32);
  let y = M + 60;
  if (r.info.length) {
    // 실험 정보 상자 (두 칸씩)
    const h = infoHeight(r) - 6, cw = (W - 2 * M) / INFO_COLS;
    ctx.fillStyle = LIGHT['--tint']; ctx.fillRect(M, y - 6, W - 2 * M, h);
    r.info.forEach(([k, v], i) => {
      const x = M + 12 + (i % INFO_COLS) * cw, yy = y + Math.floor(i / INFO_COLS) * INFO_ROW;
      ctx.font = `600 12px ${FONT}`; ctx.fillStyle = LIGHT['--muted']; ctx.fillText(k, x, yy);
      ctx.font = `13px ${FONT}`; ctx.fillStyle = LIGHT['--ink']; ctx.fillText(textFit(ctx, v, cw - 120), x + 96, yy - 1);
    });
    y += h + 10;
  }
  return y;
}

function notesBlock(ctx: CanvasRenderingContext2D, notes: string[], x: number, y: number, width: number): number {
  ctx.font = `13px ${FONT}`; ctx.fillStyle = LIGHT['--ink']; ctx.textBaseline = 'top';
  for (const n of notes) { ctx.fillText(textFit(ctx, '• ' + n, width), x, y); y += 20; }
  return y;
}

// ---------------------------------------------------------------- 활동지 (예측 · 결론)
/** 글을 폭에 맞게 줄 나눔 (띄어쓰기 기준, 너무 긴 낱말은 글자 단위) */
function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      const tryLine = line + word;
      if (ctx.measureText(tryLine).width <= width) { line = tryLine; continue; }
      if (line.trim()) { out.push(line.trimEnd()); line = ''; }
      let w = word.trimStart();
      while (ctx.measureText(w).width > width && w.length > 1) {
        let k = w.length;
        while (k > 1 && ctx.measureText(w.slice(0, k)).width > width) k--;
        out.push(w.slice(0, k)); w = w.slice(k);
      }
      line = w;
    }
    out.push(line.trimEnd());
  }
  return out;
}

const WS_LINE = 20, WS_BLANK = 3, WS_RULE = 28;
interface WsBlock { title: string[]; lines: string[]; blank: boolean }
function worksheetBlocks(ctx: CanvasRenderingContext2D, ws: ReportWorksheet, width: number): { head: string; blocks: WsBlock[] }[] {
  const body = (txt: string) => { ctx.font = `14px ${FONT}`; return txt.trim() ? wrapText(ctx, txt.trim(), width) : []; };
  const title = (txt: string) => { ctx.font = `600 14px ${FONT}`; return wrapText(ctx, txt, width + 12); };
  return [
    { head: t('1. 예측'), blocks: [{ title: [], lines: body(ws.prediction), blank: !ws.prediction.trim() }] },
    { head: t('3. 결론'), blocks: ws.answers.map(({ q, a }, i) => ({ title: title(`${i + 1}) ${q}`), lines: body(a), blank: !a.trim() })) },
  ];
}
const blockH = (b: WsBlock) => (b.title.length ? b.title.length * WS_LINE + 4 : 0) + (b.blank ? WS_BLANK * WS_RULE : b.lines.length * WS_LINE) + 14;
function worksheetHeight(ctx: CanvasRenderingContext2D, ws: ReportWorksheet, width: number) {
  return 36 + worksheetBlocks(ctx, ws, width).reduce((h, s) => h + 30 + s.blocks.reduce((k, b) => k + blockH(b), 0), 0);
}

/** 활동지 그리기. newPage가 있으면 쪽이 넘칠 때 새 쪽으로 (PDF), 없으면 이어서 (PNG) */
function drawWorksheet(ctx: CanvasRenderingContext2D, ws: ReportWorksheet, x: number, y: number, width: number,
  bottom = Infinity, newPage?: () => CanvasRenderingContext2D, top = 0): { ctx: CanvasRenderingContext2D; y: number } {
  const room = (h: number) => { if (newPage && y + h > bottom) { ctx = newPage(); y = top; } };
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  room(60);
  ctx.fillStyle = LIGHT['--ink']; ctx.font = `700 18px ${FONT}`; ctx.fillText(t('📝 활동지'), x, y); y += 36;
  for (const sec of worksheetBlocks(ctx, ws, width - 12)) {
    room(30 + (sec.blocks[0] ? blockH(sec.blocks[0]) : 0));
    ctx.fillStyle = LIGHT['--accent']; ctx.font = `700 16px ${FONT}`; ctx.fillText(sec.head, x, y); y += 30;
    for (const b of sec.blocks) {
      room(blockH(b));
      if (b.title.length) {
        ctx.fillStyle = LIGHT['--ink']; ctx.font = `600 14px ${FONT}`;
        for (const ln of b.title) { ctx.fillText(ln, x, y); y += WS_LINE; }
        y += 4;
      }
      if (b.blank) {
        // 비어 있으면 손으로 쓸 줄
        ctx.strokeStyle = LIGHT['--line']; ctx.lineWidth = 1;
        for (let k = 1; k <= WS_BLANK; k++) { ctx.beginPath(); ctx.moveTo(x + 6, y + k * WS_RULE - 0.5); ctx.lineTo(x + width, y + k * WS_RULE - 0.5); ctx.stroke(); }
        y += WS_BLANK * WS_RULE;
      } else {
        ctx.fillStyle = LIGHT['--ink']; ctx.font = `14px ${FONT}`;
        for (const ln of b.lines) {
          room(WS_LINE);
          ctx.fillText(ln, x + 12, y); y += WS_LINE;
        }
      }
      y += 14;
    }
  }
  return { ctx, y };
}

// ---------------------------------------------------------------- PNG: 모든 그래프 + 해석 한 장
export function reportImage(r: Report): HTMLCanvasElement {
  return withLight(() => {
    const W = 1000, M = 28, CH = 380, scale = 2;
    const sumH = r.summary.rows.length ? 24 * (r.summary.rows.length + 1) + 20 : 0;
    let wsH = 0;
    if (r.worksheet) { const m = document.createElement('canvas').getContext('2d')!; wsH = worksheetHeight(m, r.worksheet, W - 2 * M - 12) + 20; }
    const H = M + 60 + infoHeight(r) + 10 + r.charts.length * (CH + 40) + sumH + r.notes.length * 20 + wsH + M;
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
    y = notesBlock(ctx, r.notes, M, y, W - 2 * M);
    if (r.worksheet) drawWorksheet(ctx, r.worksheet, M, y + 20, W - 2 * M);
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
      ctx.fillText(t('데이터 해석'), M, y); y += 28;
      y = drawTable(ctx, M, y, W - 2 * M, r.summary.head, r.summary.rows) + 14;
      y = notesBlock(ctx, r.notes, M, y, W - 2 * M) + 10;
    }
    // 활동지 (그래프·해석 다음, 데이터 표 앞) — 새 쪽에서 시작
    if (r.worksheet) {
      ctx = page(); y = M;
      ({ ctx, y } = drawWorksheet(ctx, r.worksheet, M, y, W - 2 * M, H - M - 20, page, M));
      if (r.runs.some((run) => run.rows.length)) { ctx = page(); y = M; }
    }
    // 데이터 표
    for (const run of r.runs) {
      const rows = run.rows.map((row) => row.map((v) => (v === null || v === undefined ? '' : String(v))));
      let i = 0;
      while (i < rows.length) {
        if (y + 24 * 3 + 30 > H - M) { ctx = page(); y = M; }
        ctx.fillStyle = LIGHT['--ink']; ctx.font = `700 15px ${FONT}`; ctx.textBaseline = 'top';
        ctx.fillText(i ? t('{name} 데이터 (이어서)', { name: run.name }) : t('{name} 데이터', { name: run.name }), M, y); y += 26;
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
    name: t('해석'),
    rows: [[r.title], r.meta, ...r.info, [], r.summary.head, ...r.summary.rows.map((row) => row.map(numOrText)), [], ...r.notes.map((n) => [n])],
    boldRows: [0, 3 + r.info.length],
    widths: [22, ...r.summary.head.slice(1).map(() => 16)],
  };
  const graph: XSheet = { name: t('그래프'), rows: [[r.title], [r.meta.join(' · ')], ...r.info], boldRows: [0], charts, widths: [16, 28] };
  return buildXlsx([graph, summary, ...runSheets]);
}

function uniqueName(name: string, i: number, runs: ReportRun[]) {
  return runs.findIndex((x) => x.name === name) === i ? name : `${name} (${i + 1})`;
}
function numOrText(s: string): Cell {
  const n = Number(s);
  return s.trim() !== '' && isFinite(n) && /^-?[\d.]+(e-?\d+)?$/i.test(s.trim()) ? n : s;
}
