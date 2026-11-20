import { useEffect, useRef, useState } from 'react';
import { t } from '../lib/i18n';
import type { Pt } from '../lib/analysis';
import { PAD, drawChart, fmt, renderChartImage, type ChartView, type DrawOpts, type Overlays, type Scale, type Series } from '../lib/chartDraw';
import { tangentAt } from '../lib/fit';
import { saveFile } from '../lib/runs';

export { fmt };
export type { Overlays, Series, ChartView };

export type ChartTool = 'select' | 'tangent' | 'read';

interface Props {
  title: string;
  unit?: string;
  value?: string;
  stable?: boolean | null;
  series: Series[];
  xLabel: string;
  xUnit?: string;
  yLabel?: string;         // 세로축 이름 (단위는 unit)
  view?: ChartView;        // 격자·시간 표기 설정
  startedAt?: string;      // 시각 표시용
  xLog?: boolean;
  timeAxis?: boolean;
  yMin?: number;
  yMax?: number;
  xRange?: [number, number] | null;
  markers?: number[];
  selection: [number, number] | null;
  onSelect: (r: [number, number] | null) => void;
  overlays?: Overlays;
  prediction?: Pt[];
  drawing?: boolean;
  onDrawEnd?: (pts: Pt[]) => void;
  tool?: ChartTool;
  tangentPts?: Pt[];       // 접선 도구가 쓸 데이터 (지금 고른 측정)
  height?: number;
  exportName: string;
}

const { L, R, T, B } = PAD;

/** 센서 하나 = 그래프 하나. 여러 측정은 같은 축에 겹쳐 그림 */
export function Chart(props: Props) {
  const { title, unit, value, stable, series, xLabel, xUnit = '', yLabel, view, startedAt, xLog, timeAxis, yMin, yMax, xRange, markers = [], selection, onSelect,
    overlays, prediction = [], drawing, onDrawEnd, tool = 'select', tangentPts, height = 260, exportName } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<Scale | null>(null);
  const dragRef = useRef<{ kind: 'sel' | 'draw' | 'probe'; x0: number; pts: Pt[]; moved: boolean } | null>(null);
  const [hover, setHover] = useState<{ px: number; py: number } | null>(null);
  const [pin, setPin] = useState<number | null>(null);  // 접선: 마지막으로 짚은 x (터치에서도 남게)
  const [tick, setTick] = useState(0);

  useEffect(() => { if (tool !== 'tangent') setPin(null); }, [tool]);

  // ---- 2.2 키보드로 점 하나씩 (화면 읽기 프로그램·스위치·키보드만 쓰는 사람): ←→ 이동 · Home/End · PageUp 최댓값 · PageDown 최솟값 · [ ] 구간
  const [kbd, setKbd] = useState<number | null>(null);
  const [liveText, setLiveText] = useState('');
  const kpts = ((tool === 'tangent' && tangentPts ? tangentPts : series[0]?.pts) ?? []).filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
  const moveTo = (i: number) => {
    const sc = scaleRef.current;
    if (!sc || !kpts.length) return;
    const k = Math.max(0, Math.min(kpts.length - 1, i));
    const [x, y] = kpts[k];
    setKbd(k);
    setHover({ px: sc.x(x), py: sc.y(y) });
    if (tool === 'tangent') setPin(x);
    const tan2 = tool === 'tangent' && tangentPts ? tangentAt(tangentPts, x) : null;
    setLiveText(`${fmt(x)} ${xUnit}, ${fmt(y)} ${unit ?? ''}${tan2 ? ` · ${t('기울기')} ${fmt(tan2.slope)}` : ''} (${k + 1}/${kpts.length})`);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!kpts.length || drawing) return;
    const step = e.altKey ? 1 : Math.max(1, Math.round(kpts.length / 40));
    const cur = kbd;
    const ys = kpts.map((q) => q[1]);
    switch (e.key) {
      case 'ArrowRight': moveTo(cur === null ? 0 : cur + step); break;
      case 'ArrowLeft': moveTo(cur === null ? kpts.length - 1 : cur - step); break;
      case 'Home': moveTo(0); break;
      case 'End': moveTo(kpts.length - 1); break;
      case 'PageUp': moveTo(ys.indexOf(Math.max(...ys))); break;
      case 'PageDown': moveTo(ys.indexOf(Math.min(...ys))); break;
      case '[': case ']': {
        if (cur === null || tool !== 'select') return;
        const x = kpts[cur][0];
        const lo = selection ? Math.min(...selection) : kpts[0][0], hi = selection ? Math.max(...selection) : kpts[kpts.length - 1][0];
        const r: [number, number] = e.key === '[' ? [x, Math.max(x, hi)] : [Math.min(lo, x), x];
        onSelect(r);
        setLiveText(t('구간 {a}~{b}', { a: fmt(r[0]), b: fmt(r[1]) }));
        break;
      }
      case 'Escape': setKbd(null); setHover(null); setLiveText(''); break;
      default: return;
    }
    e.preventDefault();
  };

  // 접선 (마우스 위치 또는 짚은 곳)
  const tx = tool === 'tangent' ? (hover && scaleRef.current ? scaleRef.current.ix(hover.px) : pin) : null;
  const tan = tx !== null && tangentPts ? tangentAt(tangentPts, tx) : null;
  const ov: Overlays | undefined = tan
    ? { ...overlays, tangent: { ...tan, label: t('기울기 {v} {unit} (x = {x})', { v: fmt(tan.slope), unit: `${unit ?? ''}/${xUnit || 'x'}`, x: fmt(tan.x) }) } }
    : overlays;

  const opts = (): DrawOpts => ({
    series, xLabel, yLabel: yLabel ?? title, view, startedAt, unit, xLog, timeAxis, yMin, yMax, xRange, markers, selection, overlays: ov, prediction,
    drawingPts: dragRef.current?.kind === 'draw' ? dragRef.current.pts : undefined,
    hover: drawing ? null : hover, hoverLabel: tool !== 'tangent',
  });

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
      scaleRef.current = drawChart(ctx, W, H, opts());
    };
    const schedule = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(wrap);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', schedule);
    window.addEventListener('chemdict-theme', schedule);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mq.removeEventListener('change', schedule); window.removeEventListener('chemdict-theme', schedule); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, selection, overlays, prediction, markers, hover, pin, tick, height, yMin, yMax, xLog, xRange, drawing, tool, tangentPts, view, startedAt]);

  // ---- 포인터 (구간 선택, 예측 그리기, 접선·값 읽기)
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
    else if (tool !== 'select') { dragRef.current = { kind: 'probe', x0: 0, pts: [], moved: false }; setHover({ px, py }); }
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
      } else if (d.kind === 'probe') {
        setHover({ px: Math.max(L, Math.min(px, s.W - R)), py });
      } else if (Math.abs(s.x(x) - s.x(d.x0)) > 6) { d.moved = true; onSelect([d.x0, x]); }
    } else if (e.pointerType === 'mouse') {
      setHover(inPlot(px, py) ? { px, py } : null);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (d.kind === 'draw') { if (d.pts.length > 1) onDrawEnd?.(d.pts); }
    else if (d.kind === 'probe') {
      if (tool === 'tangent' && hover && scaleRef.current) setPin(scaleRef.current.ix(hover.px));
      if (e.pointerType !== 'mouse') { /* 터치: 값 읽기는 남겨 둠 */ }
    } else if (!d.moved) onSelect(null);
    setTick((t) => t + 1);
  };

  const exportPNG = () => {
    const c = renderChartImage(`${title}${unit ? ` (${unit})` : ''}`, { ...opts(), overlays: ov });
    c.toBlob((b) => b && saveFile(b, `${exportName}.png`), 'image/png');
  };

  const hint = drawing ? t('그래프 위에 예측선을 그리세요')
    : tool === 'tangent' ? t('그래프 위를 움직이거나 누르면 그 점의 기울기(접선)를 보여 줍니다')
    : tool === 'read' ? t('그래프 위를 누르면 가장 가까운 점의 값을 읽습니다')
    : t('드래그해서 구간 선택 · 클릭하면 해제');

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-label">{title}{unit ? ` (${unit})` : ''}</span>
        <span className="chart-right">
          {stable !== undefined && stable !== null && (
            <span className={`stable ${stable ? 'on' : ''}`}>{stable ? t('✓ 안정') : t('〰 변하는 중')}</span>
          )}
          {value !== undefined && <span className="chart-value">{value}</span>}
        </span>
      </figcaption>
      {series.length > 1 && (
        <div className="legend">
          {series.map((s) => (
            <span key={s.id}><i style={{ background: `var(${s.color})` }} />{s.name}</span>
          ))}
          {prediction.length > 1 && <span><i className="pred" />{t('예측')}</span>}
        </div>
      )}
      <div ref={wrapRef} className={`chart-canvas ${drawing ? 'drawing' : ''} tool-${tool}`}>
        <canvas
          ref={canvasRef}
          role="img"
          tabIndex={0}
          aria-label={t('{title} 그래프', { title })}
          aria-description={`${summarize(series, unit)}. ${t('←→로 점을 하나씩 듣고, Home·End는 처음·끝, PageUp·PageDown은 최댓값·최솟값, [ ]로 구간을 고릅니다.')}`}
          onKeyDown={onKey}
          onBlur={() => { if (kbd !== null) { setKbd(null); setHover(null); } }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null); }}
        />
      </div>
      <span className="sr-only" aria-live="polite">{liveText}</span>
      <div className="chart-foot">
        <span className="hint">{hint}</span>
        <button className="link" onClick={exportPNG}>{t('그림 저장')}</button>
      </div>
    </figure>
  );
}

/** 화면 읽기 프로그램용 그래프 요약: 점 개수 · 처음 · 마지막 · 최솟값 · 최댓값 */
function summarize(series: Series[], unit = ''): string {
  const ys = (series[0]?.pts ?? []).map((p) => p[1]).filter((v) => Number.isFinite(v));
  if (!ys.length) return t('데이터 없음');
  const f = (v: number) => `${fmt(v)} ${unit}`.trim();
  return t('점 {n}개, 처음 {a}, 마지막 {b}, 최솟값 {lo}, 최댓값 {hi}', { n: ys.length, a: f(ys[0]), b: f(ys[ys.length - 1]), lo: f(Math.min(...ys)), hi: f(Math.max(...ys)) });
}
