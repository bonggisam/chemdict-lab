import { useEffect, useMemo, useState } from 'react';
import { Ico } from './Ico';
import { ICON } from '../lib/icons';
import { Chart, fmt, type ChartTool, type ChartView, type Overlays, type Series } from './Chart';
import { loadView, saveView } from '../lib/chartDraw';
import { IntervalPicker, intervalText } from './IntervalPicker';
import { ExportSheet, type ExportKind } from './ExportSheet';
import type { Experiment } from '../lib/protocol';
import type { ResolvedSensor } from '../lib/sensors';
import { fmtValue } from '../lib/sensors';
import { findEquivalence, findPlateau, isStable, stats, type Pt } from '../lib/analysis';
import { MODELS, area, autoFit, derivative, equation, fitModel, sig, smooth, type FitResult, type ModelId } from '../lib/fit';
import { CALCS, calcColumn, round, type CalcId } from '../lib/calc';
import { newRun, recentValues, runTable, runsCSV, saveFile, seriesPoints, toTSV, type Run } from '../lib/runs';
import { reportImage, reportPdf, reportXlsx, type Report } from '../lib/report';
import type { XSeries } from '../lib/xlsx';
import { breadboardFor } from '../lib/guide';
import { BreadboardNote } from './PartWiring';
import { InfoSheet } from './InfoSheet';
import { c, t, tk } from '../lib/i18n';
import { infoRows, infoSummary, type ExpInfo } from '../lib/info';
import { FORMULA_EXAMPLES, FormulaError, compile, evalColumn, type CustomCalc } from '../lib/formula';
import { R } from './Rich';
import { ReagentNotes } from './ReagentNotes';
import { SensorTips } from './SensorTips';
import { checkFor, checkKey } from '../lib/sensorChecks';
import { useExplore } from '../lib/prefs';
import { BigScreen } from './BigScreen';
import { VideoSync } from './VideoSync';
import { liveTone, playSeries, primeAudio, silence } from '../lib/sonify';
import { SOUND } from '../lib/device';

export interface Trigger { id: string; dir: 'up' | 'down'; value: number }

interface Props {
  exp: Experiment;
  sensors: ResolvedSensor[];
  runs: Run[];
  setRuns: (fn: (r: Run[]) => Run[]) => void;
  activeId: string;
  setActiveId: (id: string) => void;
  running: boolean;
  intervalMs: number;
  setIntervalMs: (ms: number) => void;
  autoStopMin: number;
  setAutoStopMin: (m: number) => void;
  onStart: (trigger?: Trigger) => void;
  connected: boolean;
  waiting: { value?: number } | null;     // 조건 시작을 기다리는 중
  custom: CustomCalc | null;
  setCustom: (c: CustomCalc | null) => void;
  onShare: () => void;
  onSaveFile: () => void;
  onStop: () => void;
  onBack: () => void;
  onOpenSetup: () => void;
  onOpenCal: (id?: string) => void;
  onOpenCheck: (id?: string) => void;
  onOpenGuide: () => void;
  say: (kind: 'ok' | 'err', text: string) => void;
  onEventX?: (nextX: number) => void;
  station?: number;
  info: ExpInfo;
  setInfo: (i: ExpInfo) => void;
}

interface ChartSpec { sensor: ResolvedSensor; label: string; unit: string; min?: number; max?: number }
type Style = 'auto' | 'line' | 'points' | 'both';

const TREND: Partial<Record<ModelId, XSeries['trend']>> = { linear: 'linear', prop: 'linear', exp: 'exp', log: 'log', power: 'power', quad: 'poly2', cubic: 'poly3' };

export function Measure(p: Props) {
  const { exp, sensors, runs, setRuns, activeId, setActiveId, running } = p;
  const mode = exp.mode ?? 'time';
  const ev = exp.event;
  const tools = exp.analysis ?? ['stats', 'fit'];
  const active = runs.find((r) => r.id === activeId) ?? runs[0];
  const logX = mode === 'event' && ev?.scale === 'log';
  const bb = breadboardFor(exp);

  // ---- 그래프 상태
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [tool, setTool] = useState<ChartTool>('select');
  const [style, setStyle] = useState<Style>('auto');
  const [xAxis, setXAxisState] = useState('');              // '' = 시간(또는 입력값), 아니면 센서 id
  const [smoothWin, setSmoothWin] = useState(1);
  const [view, setViewState] = useState<ChartView>(loadView);
  const setView = (v: Partial<ChartView>) => setViewState((cur) => { const n = { ...cur, ...v }; saveView(n); return n; });
  // ---- 해석 상태
  const [anaSensor, setAnaSensor] = useState<string>('');
  const [fitSel, setFitSel] = useState<ModelId | 'off'>('off');
  const [showArea, setShowArea] = useState(false);
  const [showDeriv, setShowDeriv] = useState(false);
  const [showEq, setShowEq] = useState(false);
  const [showPlateau, setShowPlateau] = useState(false);
  // ---- 기타
  const [drawing, setDrawing] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [calc, setCalc] = useState<CalcId>(p.custom ? 'custom' : 'none');
  const [showCalcChart, setShowCalcChart] = useState(false);
  // ---- 조건 시작
  const [trigOn, setTrigOn] = useState(false);
  const [trigId, setTrigId] = useState('');
  const [trigDir, setTrigDir] = useState<'up' | 'down'>('up');
  const [trigVal, setTrigVal] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [eventX, setEventX] = useState<string>(String(ev?.start ?? 0));
  const [markerNote, setMarkerNote] = useState('');
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  // ---- 2.0: 측정 화면 3칸 · 쉬운/탐구 화면 · 큰 화면
  const [tab, setTab] = useState<'measure' | 'analysis' | 'record'>('measure');
  const on = (...ts: (typeof tab)[]) => ts.includes(tab);
  const [explore] = useExplore();
  const [big, setBig] = useState(false);
  const [sonify, setSonify] = useState(false);   // 값을 소리로 듣기
  const [videoOpen, setVideoOpen] = useState(false);   // 영상과 맞춰 보기
  const micBusy = exp.sensors.some((s) => SOUND.includes(s)) && sensors.some((s) => s.src === 'device');

  const setXAxis = (id: string) => { setXAxisState(id); setZoom(null); setSelection(null); };

  // 그래프 목록: 템플릿의 y 축 → 센서 종류로 찾기. 자유 측정이면 연결된 모든 센서
  const allCharts: ChartSpec[] = useMemo(() => {
    if (exp.y.length) {
      // 같은 종류 센서가 여러 개면 그래프도 여러 개 (예: 온도 1·온도 2 — 열평형, 비열 비교)
      return exp.y.flatMap((y) => {
        const byId = sensors.find((x) => x.id === y.sensor);
        let list = byId ? [byId] : sensors.filter((x) => x.type === y.sensor);
        if (list.some((x) => x.src !== 'demo')) list = list.filter((x) => x.src !== 'demo');
        return list.map((s, i) => ({ sensor: s, label: list.length > 1 ? `${y.label} ${i + 1}` : y.label, unit: y.unit ?? s.displayUnit, min: y.min, max: y.max }));
      });
    }
    return sensors.map((s) => ({ sensor: s, label: s.displayName, unit: s.displayUnit, min: s.spec?.min, max: s.spec?.max }));
  }, [exp, sensors]);

  // 가로축: 시간 / 입력값 / 다른 센서
  const xSensor = mode === 'time' && xAxis ? sensors.find((s) => s.id === xAxis) : undefined;
  const xSpec = xSensor ? allCharts.find((c) => c.sensor.id === xSensor.id) : undefined;
  const charts = xSensor ? allCharts.filter((c) => c.sensor.id !== xSensor.id) : allCharts;
  const xUnit = xSensor ? (xSpec?.unit ?? xSensor.displayUnit) : mode === 'event' ? ev?.unit ?? '' : 's';
  const xName = xSensor ? (xSpec?.label ?? xSensor.displayName) : mode === 'event' && ev ? ev.label : t('시간');
  const xTitle = `${xName}(${xUnit})`;
  const xLabel = `${xName} (${xUnit})`;
  const visibleRuns = runs.filter((r) => r.visible);

  const effStyle: Exclude<Style, 'auto'> = style !== 'auto' ? style : mode === 'event' ? 'both' : xSensor ? 'points' : 'line';
  const pointsFor = (run: Run, id: string) => smooth(seriesPoints(run, id, { xId: xSensor?.id }), smoothWin);

  const anaId = anaSensor && charts.some((c) => c.sensor.id === anaSensor) ? anaSensor : charts[0]?.sensor.id ?? '';
  const anaChart = charts.find((c) => c.sensor.id === anaId);

  const inSel = (pts: Pt[]) => {
    if (!selection) return pts;
    const [a, b] = [Math.min(...selection), Math.max(...selection)];
    return pts.filter(([x]) => x >= a && x <= b);
  };
  // 로그 눈금이면 log x로 맞춤
  const toFit = (pts: Pt[]) => (logX ? pts.filter(([x]) => x > 0).map(([x, y]) => [Math.log10(x), y] as Pt) : pts);
  const doFit = (pts: Pt[]): { best: FitResult | null; cands: FitResult[] } => {
    if (fitSel === 'off' || pts.length < 2) return { best: null, cands: [] };
    if (fitSel === 'auto') { const c = autoFit(toFit(pts)); return { best: c[0] ?? null, cands: c.slice(0, 4) }; }
    return { best: fitModel(fitSel, toFit(pts)), cands: [] };
  };

  // ---- 해석
  const analysis = useMemo(() => {
    if (!anaChart) return null;
    const band = anaChart.sensor.spec?.stableBand ?? 0.05;
    return visibleRuns.map((run) => {
      const all = pointsFor(run, anaId);
      const pts = inSel(all);
      const { best, cands } = doFit(pts);
      return {
        run, pts,
        st: stats(pts),
        fit: best, cands,
        area: showArea && pts.length > 1 ? area(pts) : null,
        eq: mode === 'event' ? findEquivalence(all) : null,
        plateau: mode === 'time' && !xSensor ? findPlateau(pts, band * 4, 15) : null,
      };
    });
  }, [visibleRuns, anaId, anaChart, selection, mode, ev, fitSel, showArea, xSensor, smoothWin]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeAna = analysis?.find((a) => a.run.id === active?.id) ?? analysis?.[0];
  const fitName = (r: FitResult) => t(MODELS.find((m) => m.id === r.model)!.name);
  const fitFn = (r: FitResult) => (logX ? (x: number) => r.f(Math.log10(x)) : r.f);

  const overlaysFor = (sensorId: string): Overlays | undefined => {
    if (sensorId !== anaId || !activeAna) return undefined;
    const o: Overlays = {};
    const pts = activeAna.pts;
    if (activeAna.fit && pts.length > 1) {
      const xs = pts.map(([x]) => x);
      o.curve = { f: fitFn(activeAna.fit), x0: Math.min(...xs), x1: Math.max(...xs), label: `${equation(activeAna.fit)}  (R² ${activeAna.fit.r2.toFixed(3)})` };
    }
    if (activeAna.area !== null && pts.length > 1) {
      o.area = { pts, color: `--s${activeAna.run.colorIndex + 1}`, label: t('넓이 {v}', { v: `${sig(activeAna.area)} ${anaChart?.unit ?? ''}·${xUnit}` }) };
    }
    if (showEq && activeAna.eq) {
      o.vlines = [{ x: activeAna.eq.x, label: t('당량점 {v}', { v: `${fmt(activeAna.eq.x)} ${ev?.unit ?? ''}` }) }];
      if (activeAna.eq.halfY !== null) o.vlines.push({ x: activeAna.eq.halfX, label: t('반당량점 pH {v}', { v: fmt(activeAna.eq.halfY) }) });
    }
    if (showPlateau && activeAna.plateau) {
      const pl = activeAna.plateau;
      o.hband = { x0: pl.x0, x1: pl.x1, y: pl.mean, label: t('평탄 구간 평균 {v}', { v: `${fmt(pl.mean)} ${anaChart?.unit ?? ''}` }) };
    }
    return o;
  };

  const seriesFor = (c: ChartSpec): Series[] => visibleRuns.map((r) => ({
    id: r.id, name: r.name, color: `--s${r.colorIndex + 1}`,
    pts: pointsFor(r, c.sensor.id),
    points: effStyle !== 'line',
    line: effStyle !== 'points',
  }));

  // ---- 현재 값·안정
  const latest = (id: string) => {
    const r = active?.rows;
    if (!r?.length) return undefined;
    for (let i = r.length - 1; i >= 0 && i > r.length - 5; i--) if (typeof r[i].v[id] === 'number') return r[i].v[id];
    return undefined;
  };
  const stableOf = (s: ResolvedSensor) => {
    if (!running || !active) return null;
    return isStable(recentValues(active, s.id, 3), s.spec?.stableBand ?? 0.05);
  };

  // ---- 값을 소리로 듣기 (실시간)
  const firstId = charts[0]?.sensor.id;
  const rowCount = active?.rows.length ?? 0;
  useEffect(() => {
    if (!sonify || !firstId || !active) return;
    const vals = active.rows.slice(-300).map((r) => r.v[firstId]).filter((v): v is number => typeof v === 'number');
    const v = vals[vals.length - 1];
    if (v === undefined) return;
    liveTone(v, charts[0].min ?? Math.min(...vals), charts[0].max ?? Math.max(...vals));
  }, [sonify, rowCount]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!sonify) silence(); }, [sonify]);
  useEffect(() => () => silence(), []);

  // ---- 이벤트 기록 (최근 1초 평균)
  const recordEvent = () => {
    if (!active) return;
    const x = Number(eventX);
    if (!isFinite(x)) { p.say('err', t('{label}을(를) 숫자로 입력하세요.', { label: ev?.label ?? t('값') })); return; }
    if (ev?.scale === 'log' && x <= 0) { p.say('err', t('로그 눈금에서는 0보다 큰 값만 쓸 수 있습니다.')); return; }
    const v: Record<string, number> = {};
    for (const s of sensors) {
      const vals = recentValues(active, s.id, 1.0);
      if (vals.length) v[s.id] = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(s.decimals + 1));
    }
    if (!Object.keys(v).length) { p.say('err', t('아직 받은 값이 없습니다. 측정을 시작했는지 확인하세요.')); return; }
    const tNow = active.rows[active.rows.length - 1]?.t ?? 0;
    setRuns((rs) => rs.map((r) => (r.id === active.id ? { ...r, events: [...r.events, { x, v, t: tNow }] } : r)));
    const next = ev?.scale === 'log' ? x * (ev?.step ?? 10) : x + (ev?.step ?? 1);
    setEventX(String(Number(next.toFixed(4))));
    p.onEventX?.(next);
  };

  const deleteEvent = (idx: number) => {
    setRuns((rs) => rs.map((r) => (r.id === active?.id
      ? { ...r, events: r.events.filter((_, i) => i !== idx), excluded: (r.excluded ?? []).filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)) }
      : r)));
  };
  const toggleExclude = (idx: number) => {
    if (!active) return;
    const ex = new Set(active.excluded ?? []);
    if (ex.has(idx)) ex.delete(idx); else ex.add(idx);
    patchRun(active.id, { excluded: [...ex] });
  };

  const addMarker = () => {
    if (!active) return;
    const tNow = active.rows[active.rows.length - 1]?.t ?? 0;
    const note = markerNote.trim() || exp.markers.label;
    setRuns((rs) => rs.map((r) => (r.id === active.id ? { ...r, markers: [...r.markers, { t: tNow, note }] } : r)));
    setMarkerNote('');
  };

  // ---- 측정(run) 관리
  const addRun = () => {
    const r = newRun(mode, runs.length);
    setRuns((rs) => [...rs, r]);
    setActiveId(r.id);
    setEventX(String(ev?.start ?? 0));
    setSelection(null);
  };
  const removeRun = (id: string) => {
    if (armedDelete !== id) { setArmedDelete(id); setTimeout(() => setArmedDelete((a) => (a === id ? null : a)), 3000); return; }
    setArmedDelete(null);
    setRuns((rs) => {
      const left = rs.filter((r) => r.id !== id);
      if (!left.length) { const r = newRun(mode, 0); setActiveId(r.id); return [r]; }
      if (id === activeId) setActiveId(left[left.length - 1].id);
      return left;
    });
  };
  const patchRun = (id: string, patch: Partial<Run>) => setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // ---- 표 (계산 열 포함)
  const cols = allCharts.length ? allCharts.map((c) => ({ id: c.sensor.id, title: c.unit ? `${c.label}(${c.unit})` : c.label, decimals: c.sensor.decimals }))
    : sensors.map((s) => ({ id: s.id, title: s.displayName, decimals: s.decimals }));
  const calcInfo = CALCS.find((c) => c.id === calc)!;
  const anaCol = cols.find((c) => c.id === anaId);
  const custom = p.custom ?? { name: '', unit: '', expr: '' };
  const customFn = useMemo(() => {
    if (calc !== 'custom' || !custom.expr.trim()) return { fn: null, err: '' };
    try { return { fn: compile(custom.expr, sensors.map((x) => x.id)), err: '' }; }
    catch (e) { return { fn: null, err: e instanceof FormulaError ? e.message : '?' }; }
  }, [calc, custom.expr, sensors]);
  const customTitle = `${custom.name.trim() || t('계산 값')}${custom.unit.trim() ? `(${custom.unit.trim()})` : ''}`;
  const calcTitle = calc === 'custom' ? (customFn.fn ? customTitle : '') : calc !== 'none' && anaCol ? calcInfo.title(anaCol.title) : '';
  const extraColumn = (xs: number[], vs: Record<string, number>[]) => {
    if (calc === 'custom') return customFn.fn ? evalColumn(customFn.fn, xs, vs, anaId) : null;
    return calc !== 'none' && anaId ? calcColumn(calc, xs, vs.map((v) => v[anaId] ?? NaN)) : null;
  };
  const isTemp = (anaChart?.unit ?? '').includes('°C');

  /** 측정 하나의 숫자 표: [x, 센서들..., 계산 열?] + 행마다 제외 여부 */
  const numericTable = (run: Run) => {
    const items = run.mode === 'event'
      ? run.events.map((e, i) => ({ i, x: e.x, v: e.v })).sort((a, b) => a.x - b.x)
      : run.rows.map((r, i) => ({ i, x: r.t, v: r.v }));
    const ex = new Set(run.excluded ?? []);
    const extra = extraColumn(items.map((it) => it.x), items.map((it) => it.v));
    return items.map((it, k) => ({
      idx: it.i,
      excluded: ex.has(it.i),
      cells: [run.mode === 'event' ? it.x : Number(it.x.toFixed(2)), ...cols.map((c) => it.v[c.id] ?? NaN), ...(extra ? [round(extra[k])] : [])],
    }));
  };

  // ---- 저장
  const stamp = () => {
    const d = new Date(), z = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
  };
  const baseName = `chemdict_${exp.id}${p.station ? `_st${p.station}` : ''}_${stamp()}`;
  const dataRuns = visibleRuns.filter((r) => r.rows.length || r.events.length);

  const summaryHead = [t('측정'), t('개수'), t('평균'), t('최소'), t('최대'), t('표준편차'), t('변화량 Δ'),
    ...(fitSel !== 'off' ? [t('함수'), 'R²'] : []), ...(showArea ? [t('넓이')] : []),
    ...(showEq ? [t('당량점'), t('반당량점 pH')] : []), ...(showPlateau ? [t('평탄 구간')] : [])];
  const summaryRows = (analysis ?? []).map(({ run, st, fit, area: ar, eq, plateau }) => [
    run.name, String(st?.n ?? 0), st ? fmt(st.mean) : '—', st ? fmt(st.min) : '—', st ? fmt(st.max) : '—', st ? fmt(st.sd) : '—', st ? fmt(st.dy) : '—',
    ...(fitSel !== 'off' ? [fit ? `${fitName(fit)}: ${equation(fit)}` : '—', fit ? fit.r2.toFixed(4) : '—'] : []),
    ...(showArea ? [ar !== null ? `${sig(ar)} ${anaChart?.unit ?? ''}·${xUnit}` : '—'] : []),
    ...(showEq ? [eq ? `${fmt(eq.x)} ${ev?.unit ?? ''} (pH ${fmt(eq.y)})` : t('뚜렷한 급변 없음'), eq?.halfY != null ? fmt(eq.halfY) : '—'] : []),
    ...(showPlateau ? [plateau ? `${fmt(plateau.mean)} ${anaChart?.unit ?? ''} (${fmt(plateau.x0)}~${fmt(plateau.x1)} s)` : t('없음')] : []),
  ]);

  const buildReport = (): Report => {
    const meta = [
      mode === 'event' ? t('값 입력 · {label}', { label: ev?.label ?? '' }) : t('시간 기록 · 간격 {v}', { v: intervalText(p.intervalMs) }),
      ...(selection ? [t('해석 구간 {v}', { v: `${fmt(Math.min(...selection))}~${fmt(Math.max(...selection))} ${xUnit}` })] : []),
    ];
    const head = [mode === 'event' ? `${ev?.label ?? 'x'}(${ev?.unit ?? ''})` : t('시간(s)'), ...cols.map((c) => c.title), ...(calcTitle ? [calcTitle] : []), t('해석 제외')];
    const rRuns = dataRuns.map((run) => ({
      name: run.name, colorIndex: run.colorIndex, head,
      rows: numericTable(run).map((r) => [...r.cells.map((v) => (typeof v === 'number' && !isFinite(v) ? null : v)), r.excluded ? t('제외') : null]),
    }));
    const colOf = (id: string) => 1 + cols.findIndex((c) => c.id === id);
    const notes: string[] = [];
    for (const a of analysis ?? []) {
      if (!dataRuns.includes(a.run)) continue;
      if (a.fit) notes.push(`${a.run.name} — ${fitName(a.fit)}: ${equation(a.fit)}${logX ? t(' (x = log 가로축)') : ''}, R² = ${a.fit.r2.toFixed(4)}`);
      if (a.area !== null) notes.push(t('{name} — 곡선 아래 넓이: {v}', { name: a.run.name, v: `${sig(a.area)} ${anaChart?.unit ?? ''}·${xUnit}` }));
    }
    if (smoothWin > 1) notes.push(t('그래프는 {n}점 이동 평균으로 부드럽게 한 값입니다.', { n: smoothWin }));
    if (dataRuns.some((r) => r.excluded?.length)) notes.push(t('‘해석 제외’ 표시한 점은 그래프와 해석에서 뺐습니다.'));
    return {
      title: exp.title,
      meta,
      info: infoRows(p.info, dataRuns, p.station),
      xTitle,
      logX,
      charts: charts.map((c) => ({
        title: `${c.label}${c.unit ? ` (${c.unit})` : ''}`,
        yTitle: `${c.label}${c.unit ? ` (${c.unit})` : ''}`,
        sensorCol: colOf(c.sensor.id),
        xCol: xSensor ? colOf(xSensor.id) : 0,
        opts: {
          series: seriesFor(c).filter((s) => dataRuns.some((r) => r.id === s.id)),
          xLabel, yLabel: c.label, view, startedAt: active?.startedAt, unit: c.unit, xLog: logX, timeAxis: mode === 'time' && !xSensor, yMin: c.min, yMax: c.max, xRange: zoom,
          markers: mode === 'time' && !xSensor ? active?.markers.map((m) => m.t) : [], overlays: overlaysFor(c.sensor.id),
        },
        trend: c.sensor.id === anaId && activeAna?.fit && !logX && !selection ? TREND[activeAna.fit.model] : undefined,
      })),
      summary: { head: summaryHead, rows: summaryRows.filter((_, i) => dataRuns.includes((analysis ?? [])[i]?.run)) },
      notes,
      runs: rRuns,
    };
  };

  const doExport = async (k: ExportKind) => {
    if (!dataRuns.length) { p.say('err', t('저장할 데이터가 없습니다.')); return; }
    if (k === 'csv') {
      const q = (x: string) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
      const head = [[t('실험'), exp.title], ...infoRows(p.info, dataRuns, p.station)].map((r) => r.map(q).join(',')).join('\n');
      const body = runsCSV(dataRuns, cols, xTitle).replace(/^\uFEFF/, '');
      saveFile(new Blob(['\uFEFF' + head + '\n\n' + body], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`);
      return;
    }
    if (k === 'copy') { await copyTable(); return; }
    if (k === 'file') { p.onSaveFile(); return; }
    const r = buildReport();
    if (k === 'png') {
      const c = reportImage(r);
      await new Promise<void>((res) => c.toBlob((b) => { if (b) saveFile(b, `${baseName}.png`); res(); }, 'image/png'));
    } else if (k === 'pdf') {
      saveFile(await reportPdf(r), `${baseName}.pdf`);
    } else {
      saveFile(reportXlsx(r), `${baseName}.xlsx`);
      if (k === 'numbers') p.say('ok', t('Numbers에서 이 .xlsx 파일을 열면 표와 그래프가 그대로 나옵니다.'));
    }
  };
  const copyTable = async () => {
    if (!active) return;
    const tsv = toTSV(runTable(active, cols, xTitle));
    try { await navigator.clipboard.writeText(tsv); p.say('ok', t('표를 복사했습니다. Numbers나 엑셀에 붙여넣으세요.')); }
    catch { p.say('err', t('이 브라우저에서는 복사가 막혀 있습니다. CSV로 저장하세요.')); }
  };

  const hasData = !!active && (active.rows.length > 0 || active.events.length > 0);
  const calcPts = (run: Run): Pt[] => {
    if (!calcTitle) return [];
    return numericTable(run).filter((r) => !r.excluded && isFinite(r.cells[r.cells.length - 1])).map((r) => [r.cells[0], r.cells[r.cells.length - 1]] as Pt);
  };
  const startClick = () => {
    const v = Number(trigVal);
    if (trigOn && mode === 'time') {
      const id = trigId || charts[0]?.sensor.id;
      if (!id || trigVal.trim() === '' || !isFinite(v)) { p.say('err', t('조건 시작: 기준값을 숫자로 입력하세요.')); return; }
      p.onStart({ id, dir: trigDir, value: v });
    } else p.onStart();
  };
  const trigSensor = charts.find((c) => c.sensor.id === (trigId || charts[0]?.sensor.id));
  const derivPts = (run: Run) => (anaChart ? derivative(smooth(pointsFor(run, anaId), Math.max(3, smoothWin))) : []);
  const otherSensors = mode === 'time' ? allCharts : [];

  return (
    <main className="wide measure">
      <div className="row-head" data-nav={t('측정 시작 · 정지')}>
        <div>
          <button className="ghost back" disabled={running} onClick={p.onBack}>← {t('실험 목록')}</button>
          <h1>{exp.title}</h1>
          <span className="mode-badge">{mode === 'event' ? t('값 입력 모드 · {label}', { label: ev?.label ?? '' }) : t('시간 기록 모드')}</span>
        </div>
        <div className="controls">
          {mode === 'time' && <IntervalPicker value={p.intervalMs} disabled={running} onChange={p.setIntervalMs} />}
          {mode === 'time' && (
            <select aria-label={t('끝내기')} title={t('정한 시간이 되면 측정을 멈추고 알림을 보냅니다')} value={p.autoStopMin} disabled={running} onChange={(e) => p.setAutoStopMin(Number(e.target.value))}>
              <option value={0}>{t('시간 정하지 않음')}</option>
              {[1, 5, 10, 30, 60, 120].map((m) => <option key={m} value={m}>{t('{n}분 뒤 끝내기', { n: m })}</option>)}
            </select>
          )}
          {!running
            ? <button className="primary rec" disabled={!p.connected} onClick={startClick}><Ico e={ICON.start} />{trigOn && mode === 'time' ? t('조건 기다리며 시작') : t('측정 시작')}</button>
            : <button className="danger" onClick={p.onStop}><Ico e={ICON.stop} />{t('정지')}</button>}
        </div>
      </div>
      {!p.connected && <p className="note warn">{t('저장된 측정을 보는 중입니다. 새로 측정하려면 보드를 연결하세요.')}</p>}

      <div className="status-strip" role="status">
        <span className={`dot ${running ? 'rec' : p.connected ? 'on' : ''}`} aria-hidden="true" />
        <b>{running ? t('측정 중') : (active?.rows.length || active?.events.length) ? t('멈춤') : t('대기')}</b>
        <span className="note">{active ? (active.mode === 'event' ? t('{n}점', { n: active.events.length }) : t('{n}개', { n: active.rows.length })) : ''}{mode === 'time' ? ` · ${intervalText(p.intervalMs)}` : ''}</span>
        <span className="grow" />
        <button className="ghost" disabled={charts.length === 0} onClick={() => setBig(true)}>⛶ {t('큰 화면')}</button>
      </div>

      <div className="tabs3" role="tablist" aria-label={t('측정 화면 칸')}>
        {([['measure', tk('📈 측정')], ['analysis', tk('🔍 분석')], ['record', tk('📝 기록·저장')]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t(l)}</button>
        ))}
      </div>

      {on('measure') && explore && mode === 'time' && charts.length > 0 && (
        <details className="trigger" open={trigOn}>
          <summary><Ico e={ICON.trigger} />{t('조건 시작')}{trigOn ? ` · ${t('켜짐')}` : ''}</summary>
          <div className="trigger-row">
            <label><input type="checkbox" checked={trigOn} disabled={running} onChange={(e) => setTrigOn(e.target.checked)} /> {t('값이 기준을 넘으면 기록 시작')}</label>
            <select aria-label={t('조건 센서')} value={trigId || charts[0]?.sensor.id} disabled={running} onChange={(e) => setTrigId(e.target.value)}>
              {charts.map((c) => <option key={c.sensor.id} value={c.sensor.id}>{c.label}</option>)}
            </select>
            <select aria-label={t('조건 방향')} value={trigDir} disabled={running} onChange={(e) => setTrigDir(e.target.value as 'up' | 'down')}>
              <option value="up">{t('이상이 되면')}</option>
              <option value="down">{t('이하가 되면')}</option>
            </select>
            <input aria-label={t('기준값')} inputMode="decimal" placeholder={t('기준값')} value={trigVal} disabled={running} onChange={(e) => setTrigVal(e.target.value)} />
            <span className="unit">{trigSensor?.unit}</span>
          </div>
          <p className="note">{t('예: 반응 용액 온도가 25 °C 이상이 되면 기록 시작. 시간은 조건이 맞은 순간부터 0초로 셉니다.')}</p>
        </details>
      )}
      {on('measure') && p.waiting && (
        <p className="note waiting" role="status">⏳ {t('조건을 기다리는 중 · 지금 {v}', { v: p.waiting.value !== undefined ? `${fmt(p.waiting.value)} ${trigSensor?.unit ?? ''}` : '—' })}</p>
      )}
      {on('measure') && mode === 'time' && p.intervalMs >= 2000 && !running && (
        <p className="note">{t('간격이 길면 그래프 점이 드문드문 찍힙니다. 온습도(DHT)는 2초, 이산화탄소(SCD4x)는 5초보다 짧으면 같은 값이 반복됩니다.')}</p>
      )}

      {on('record') && <div className="info-bar">
        <span><Ico e={ICON.info} /><b>{t('실험 정보')}</b> {infoSummary(p.info) || <span className="note">{t('모둠·이름·날짜 (선택) — 저장할 때 함께 남습니다')}</span>}</span>
        <button className="ghost" onClick={() => setInfoOpen(true)}>{infoSummary(p.info) ? t('수정') : t('입력')}</button>
      </div>}

      {/* 측정 목록 */}
      {on('measure', 'record') && <div className="runs" data-nav={t('측정 목록')}>
        {runs.map((r) => (
          <div key={r.id} className={`run ${r.id === active?.id ? 'active' : ''}`}>
            <input type="checkbox" aria-label={t('{name} 그래프에 표시', { name: r.name })} checked={r.visible} onChange={(e) => patchRun(r.id, { visible: e.target.checked })} />
            <i style={{ background: `var(--s${r.colorIndex + 1})` }} />
            {renaming === r.id ? (
              <input className="rename" autoFocus defaultValue={r.name}
                onBlur={(e) => { patchRun(r.id, { name: e.target.value.trim() || r.name }); setRenaming(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
            ) : (
              <button className="run-name" disabled={running} onClick={() => (r.id === active?.id ? setRenaming(r.id) : setActiveId(r.id))} title={r.id === active?.id ? t('이름 바꾸기') : t('이 측정 선택')}>
                {r.name}
              </button>
            )}
            <span className="run-count">{r.mode === 'event' ? t('{n}점', { n: r.events.length }) : t('{n}개', { n: r.rows.length })}</span>
            <button className="x" disabled={running} onClick={() => removeRun(r.id)} aria-label={t('{name} 삭제', { name: r.name })}>{armedDelete === r.id ? t('삭제?') : '×'}</button>
          </div>
        ))}
        <button className="ghost add-run" disabled={running} onClick={addRun}>+ {t('새 측정')}</button>
      </div>}

      {on('measure', 'record') && <details className="steps" data-nav={t('실험 순서 보기')} data-nav-level="3">
        <summary><Ico e="🧑‍🔬" />{t('실험 순서 보기')}</summary>
        <ol>{exp.steps.map((s, i) => <li key={i}><R t={s} /></li>)}</ol>
      </details>}
      {on('record') && bb && <BreadboardNote need={bb.need} why={bb.why} circuit={bb.circuit} />}
      {on('record') && exp.setup && exp.setup.materials.length > 0 && <ReagentNotes materials={exp.setup.materials} />}

      {charts.length === 0 && (
        <p className="note warn">{t('이 실험에 필요한 센서({list})가 연결되어 있지 않습니다.', { list: exp.sensors.join(', ') })} <button className="link" onClick={p.onOpenGuide}>{t('연결 안내')}</button> · <button className="link" onClick={p.onOpenSetup}>{t('센서 연결 설정')}</button></p>
      )}

      {/* 값 입력 모드: 기록 막대 */}
      {on('measure') && mode === 'event' && ev && (
        <div className="event-bar">
          <label htmlFor="event-x">{ev.label}</label>
          <input id="event-x" inputMode="decimal" value={eventX} onChange={(e) => setEventX(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') recordEvent(); }} />
          <span className="unit">{ev.unit}</span>
          <button className="primary" disabled={!running} onClick={recordEvent}>{t('값 기록')}</button>
          <span className="note">{running ? t('값이 ‘안정’이 되면 누르세요. 최근 1초 평균을 기록합니다.') : t('먼저 측정 시작을 누르세요.')}</span>
        </div>
      )}

      {/* 그래프 도구 */}
      {charts.length > 0 && (on('analysis') || (explore && on('measure'))) && (
        <div className="graph-tools" role="toolbar" aria-label={t('그래프 도구')}>
          <div className="seg" role="radiogroup" aria-label={t('그래프에서 할 일')}>
            {([['select', tk('구간 선택')], ['read', tk('값 읽기')], ['tangent', tk('접선')]] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={tool === k} className={tool === k ? 'on' : ''} onClick={() => setTool(k)}>{t(l)}</button>
            ))}
          </div>
          {zoom
            ? <button className="ghost" onClick={() => setZoom(null)}>{t('전체 보기')}</button>
            : <button className="ghost" disabled={!selection} onClick={() => { if (selection) { setZoom([Math.min(...selection), Math.max(...selection)]); } }}>{t('선택 구간 확대')}</button>}
          <label className="mini">{t('표시')}
            <select value={style} onChange={(e) => setStyle(e.target.value as Style)}>
              <option value="auto">{t('자동')}</option><option value="line">{t('선')}</option><option value="points">{t('점')}</option><option value="both">{t('선+점')}</option>
            </select>
          </label>
          {otherSensors.length > 1 && (
            <label className="mini">{t('가로축')}
              <select value={xAxis} onChange={(e) => setXAxis(e.target.value)}>
                <option value="">{t('시간')}</option>
                {otherSensors.map((c) => <option key={c.sensor.id} value={c.sensor.id}>{c.label}</option>)}
              </select>
            </label>
          )}
          <label className="mini">{t('부드럽게')}
            <select value={smoothWin} onChange={(e) => setSmoothWin(Number(e.target.value))}>
              <option value={1}>{t('끔')}</option><option value={3}>{t('약하게 (3점)')}</option><option value={5}>{t('보통 (5점)')}</option><option value={9}>{t('강하게 (9점)')}</option>
            </select>
          </label>
          <label className="mini">{t('격자')}
            <select value={view.grid} onChange={(e) => setView({ grid: e.target.value as ChartView['grid'] })}>
              <option value="both">{t('가로·세로')}</option><option value="y">{t('가로만')}</option><option value="fine">{t('촘촘하게')}</option><option value="none">{t('없음')}</option>
            </select>
          </label>
          {mode === 'time' && !xSensor && (
            <label className="mini">{t('시간 표기')}
              <select value={view.timeFmt} onChange={(e) => setView({ timeFmt: e.target.value as ChartView['timeFmt'] })}>
                <option value="auto">{t('자동')}</option><option value="s">{t('초 (s)')}</option><option value="min">{t('분 (min)')}</option><option value="mmss">{t('분:초')}</option><option value="clock">{t('시각')}</option>
              </select>
            </label>
          )}
          <label className="mini"><input type="checkbox" checked={view.yLabel} onChange={(e) => setView({ yLabel: e.target.checked })} /> {t('축 이름·단위')}</label>
        </div>
      )}

      {on('measure', 'analysis') && <div className="charts" data-nav={t('그래프')}>
        {charts.map((c, i) => (
          <Chart
            key={c.sensor.id}
            title={c.label}
            unit={c.unit}
            value={fmtValue(latest(c.sensor.id), c.sensor.decimals)}
            stable={stableOf(c.sensor)}
            series={seriesFor(c)}
            xLabel={xLabel}
            xUnit={xUnit}
            view={view}
            startedAt={active?.startedAt}
            xLog={logX}
            timeAxis={mode === 'time' && !xSensor}
            yMin={c.min}
            yMax={c.max}
            xRange={zoom}
            markers={mode === 'time' && !xSensor ? active?.markers.map((m) => m.t) : []}
            selection={selection}
            onSelect={setSelection}
            overlays={overlaysFor(c.sensor.id)}
            prediction={i === 0 && !xSensor ? (active?.prediction.length ? active.prediction : runs.find((r) => r.prediction.length)?.prediction ?? []) : []}
            drawing={i === 0 && drawing}
            onDrawEnd={(pts) => { if (active) patchRun(active.id, { prediction: pts }); setDrawing(false); }}
            tool={tool}
            tangentPts={active ? pointsFor(active, c.sensor.id) : undefined}
            exportName={`${baseName}_${c.sensor.id}`}
          />
        ))}
        {showDeriv && anaChart && (
          <Chart
            title={t('{name} 변화율', { name: anaChart.label })}
            unit={`${anaChart.unit}/${xUnit}`}
            series={visibleRuns.map((r) => ({ id: r.id, name: r.name, color: `--s${r.colorIndex + 1}`, pts: derivPts(r), points: false }))}
            xLabel={xLabel}
            xUnit={xUnit}
            view={view}
            startedAt={active?.startedAt}
            xLog={logX}
            timeAxis={mode === 'time' && !xSensor}
            xRange={zoom}
            selection={selection}
            onSelect={setSelection}
            tool={tool}
            tangentPts={active ? derivPts(active) : undefined}
            exportName={`${baseName}_${anaId}_rate`}
          />
        )}
        {showCalcChart && calcTitle && !xSensor && (
          <Chart
            title={calcTitle}
            unit={calc === 'custom' ? custom.unit : ''}
            series={visibleRuns.map((r) => ({ id: r.id, name: r.name, color: `--s${r.colorIndex + 1}`, pts: calcPts(r), points: effStyle !== 'line', line: effStyle !== 'points' }))}
            xLabel={xLabel}
            xUnit={xUnit}
            view={view}
            startedAt={active?.startedAt}
            xLog={logX}
            timeAxis={mode === 'time'}
            xRange={zoom}
            selection={selection}
            onSelect={setSelection}
            tool={tool}
            tangentPts={active ? calcPts(active) : undefined}
            exportName={`${baseName}_calc`}
          />
        )}
      </div>}

      {/* 도구 막대 */}
      {on('measure', 'record') && <div className="toolbar" data-nav={t('관찰 기록 · 저장')}>
        {on('measure') && mode === 'time' && exp.markers.enabled && (
          <div className="marker">
            <input id="marker-note" aria-label={exp.markers.label} value={markerNote} placeholder={exp.markers.prompt} onChange={(e) => setMarkerNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addMarker(); }} />
            <button onClick={addMarker} disabled={!running}><Ico e={ICON.marker} />{exp.markers.label}</button>
          </div>
        )}
        <div className="actions">
          {on('measure') && charts.length > 0 && <>
            <button className={`ghost ${sonify ? 'on' : ''}`} aria-pressed={sonify} disabled={micBusy} title={micBusy ? t('마이크로 재는 중에는 쓸 수 없습니다') : t('값이 커지면 높은 소리, 작아지면 낮은 소리가 납니다')} onClick={() => { primeAudio(); setSonify((v) => !v); }}>🔊 {t('값을 소리로 듣기')}</button>
            <button className="ghost" disabled={micBusy || running || rowCount < 2} onClick={() => playSeries((active?.rows ?? []).map((r) => r.v[firstId!]).filter((v): v is number => typeof v === 'number'))}>▶ {t('그래프 소리로 재생')}</button>
          </>}
          <button className="ghost" onClick={p.onOpenGuide}><Ico e={ICON.guide} />{t('연결 안내')}</button>
          {explore && <button className="ghost" disabled={running} onClick={p.onOpenSetup}><Ico e={ICON.setup} />{t('센서 설정')}</button>}
          <button className="ghost" disabled={!sensors.some((s) => s.spec && s.spec.cal.kind !== 'none')} onClick={() => p.onOpenCal(charts[0]?.sensor.id)}><Ico e={ICON.cal} />{t('보정')}</button>
          <button className="ghost" onClick={() => p.onOpenCheck(charts[0]?.sensor.id)}><Ico e={ICON.test} />{t('점검')}</button>
          {explore && charts.length > 0 && !xSensor && (
            drawing
              ? <button className="ghost" onClick={() => setDrawing(false)}>{t('그리기 취소')}</button>
              : active?.prediction.length || runs.some((r) => r.prediction.length)
                ? <button className="ghost" onClick={() => setRuns((rs) => rs.map((r) => ({ ...r, prediction: [] })))}>{t('예측 지우기')}</button>
                : <button className="ghost" onClick={() => setDrawing(true)}><Ico e={ICON.predict} />{t('예측 그리기')}</button>
          )}
          <button className="ghost" onClick={() => setShowTable((v) => !v)}><Ico e={ICON.table} />{showTable ? t('표 닫기') : t('표 보기')}</button>
          {on('record') && mode === 'time' && <button className="ghost" disabled={!dataRuns.length} onClick={() => setVideoOpen(true)}>🎬 {t('영상과 맞춰 보기')}</button>}
          <button className="ghost" onClick={p.onShare}><Ico e={ICON.share} />{t('QR 공유')}</button>
          <button className="primary" disabled={!dataRuns.length} onClick={() => setExportOpen(true)}><Ico e={ICON.save} />{t('저장하기')}</button>
        </div>
      </div>}

      {/* 해석 */}
      {on('analysis') && !(anaChart && analysis) && <p className="note">{t('측정한 점이 2개 이상이면 분석할 수 있습니다. [측정 시작]을 누르세요.')}</p>}
      {on('analysis') && anaChart && analysis && (
        <section className="analysis">
          <div className="ana-head">
            <h2><Ico e={ICON.analysis} />{t('데이터 해석')}</h2>
            {charts.length > 1 && (
              <select id="ana-sensor" value={anaId} onChange={(e) => setAnaSensor(e.target.value)} aria-label={t('해석할 센서')}>
                {charts.map((c) => <option key={c.sensor.id} value={c.sensor.id}>{c.label}</option>)}
              </select>
            )}
            <span className="note">
              {selection ? t('선택 구간 {v}', { v: `${fmt(Math.min(...selection))} ~ ${fmt(Math.max(...selection))} ${xUnit}` }) : t('전체 구간 (그래프를 드래그하면 그 구간만 계산)')}
            </span>
            {selection && <button className="link" onClick={() => setSelection(null)}>{t('선택 해제')}</button>}
          </div>

          <div className="ana-tools">
            <label className="fit-pick">{t('함수 찾기')}
              <select value={fitSel} onChange={(e) => setFitSel(e.target.value as ModelId | 'off')}>
                <option value="off">{t('끔')}</option>
                <option value="auto">{t('자동 (가장 잘 맞는 것)')}</option>
                {MODELS.map((m) => <option key={m.id} value={m.id}>{t(m.name)} · {m.form}</option>)}
              </select>
            </label>
            <label><input type="checkbox" checked={showArea} onChange={(e) => setShowArea(e.target.checked)} /> {t('넓이 (적분)')}</label>
            <label><input type="checkbox" checked={showDeriv} onChange={(e) => setShowDeriv(e.target.checked)} /> {t('변화율 그래프')}</label>
            {tools.includes('equivalence') && mode === 'event' && <label><input type="checkbox" checked={showEq} onChange={(e) => setShowEq(e.target.checked)} /> {t('당량점 찾기')}</label>}
            {tools.includes('plateau') && mode === 'time' && !xSensor && <label><input type="checkbox" checked={showPlateau} onChange={(e) => setShowPlateau(e.target.checked)} /> {t('평탄 구간 찾기')}</label>}
          </div>

          {activeAna?.fit && (
            <div className="fit-card">
              <div className="fit-eq">
                <span className="note">{activeAna.run.name} · {fitName(activeAna.fit)}{logX ? t(' (x = log 가로축)') : ''}</span>
                <b>{equation(activeAna.fit)}</b>
                <span>{t('R² = {r2} · 오차(RMSE) {rmse} · 점 {n}개', { r2: activeAna.fit.r2.toFixed(4), rmse: sig(activeAna.fit.rmse), n: activeAna.fit.n })}</span>
              </div>
              <p className="note">{t(MODELS.find((m) => m.id === activeAna.fit!.model)?.use ?? '')}</p>
              {fitSel === 'auto' && activeAna.cands.length > 1 && (
                <div className="cands">
                  <span className="note">{t('다른 후보:')}</span>
                  {activeAna.cands.slice(1).map((c) => (
                    <button key={c.model} className="chip-btn" onClick={() => setFitSel(c.model)}>{fitName(c)} (R² {c.r2.toFixed(3)})</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {fitSel !== 'off' && !activeAna?.fit && <p className="note warn">{t('이 데이터에는 이 함수를 맞출 수 없습니다 (점이 너무 적거나 0·음수 값).')}</p>}

          <div className="ana-table">
            <table>
              <thead><tr>{summaryHead.map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {summaryRows.map((row, k) => {
                  const run = analysis[k].run;
                  return (
                    <tr key={run.id} className={run.id === active?.id ? 'active' : ''}>
                      {row.map((c, j) => <td key={j}>{j === 0 && <i style={{ background: `var(--s${run.colorIndex + 1})` }} />}{c}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Interpret fit={fitSel !== 'off'} area={showArea} deriv={showDeriv} tool={tool} showEq={showEq} showPlateau={showPlateau} mode={mode} logX={logX} unit={anaChart.unit} xUnit={xUnit} />
          {activeAna?.st && (
            <CompareRef
              unit={anaChart.unit}
              decimals={anaChart.sensor.decimals}
              source={selection ? 'sel' : showPlateau && activeAna.plateau ? 'plateau' : 'last'}
              value={selection ? activeAna.st.mean : showPlateau && activeAna.plateau ? activeAna.plateau.mean : activeAna.st.last}
              sd={selection ? activeAna.st.sd : showPlateau && activeAna.plateau ? activeAna.plateau.sd : 0}
              accuracy={(() => { const k = checkKey(anaChart.sensor.type); return k ? c(`check.${k}.accuracy`, checkFor(anaChart.sensor.type)!.accuracy) : undefined; })()}
            />
          )}
          <SensorTips type={anaChart.sensor.type} onApply={(a) => {
            if (a.fit) setFitSel(a.fit);
            if (a.tool) setTool(a.tool);
            if (a.area) setShowArea(true);
            if (a.deriv) setShowDeriv(true);
            if (a.plateau) setShowPlateau(true);
            if (a.eq) setShowEq(true);
            if (a.calc) setCalc(a.calc);
            p.say('ok', t('해석 도구를 켰습니다. 그래프 아래에서 결과를 보세요.'));
          }} />
        </section>
      )}

      {(showTable || on('analysis')) && active && (
        <section className="data-table">
          <div className="ana-head">
            <h2>{t('{name} 표', { name: active.name })}</h2>
            <label className="mini">{t('계산 열')}
              <select value={calc} onChange={(e) => setCalc(e.target.value as CalcId)}>
                {CALCS.filter((c) => !c.tempOnly || isTemp).map((c) => <option key={c.id} value={c.id}>{t(c.name)}</option>)}
              </select>
            </label>
            {calc !== 'none' && calc !== 'custom' && anaCol && <span className="note">{t('기준: {name}', { name: anaCol.title })}</span>}
            {calcTitle && !xSensor && <label className="mini"><input type="checkbox" checked={showCalcChart} onChange={(e) => setShowCalcChart(e.target.checked)} /> {t('그래프로 보기')}</label>}
            {!!active.excluded?.length && <button className="link" onClick={() => patchRun(active.id, { excluded: [] })}>{t('제외 {n}개 모두 되돌리기', { n: active.excluded.length })}</button>}
            <button className="link" disabled={!hasData} onClick={copyTable}>{t('표 복사')}</button>
          </div>
          {calc === 'custom' && (
            <div className="custom-calc">
              <div className="custom-row">
                <label>{t('이름')}<input value={custom.name} placeholder={t('예: 절대온도')} onChange={(e) => p.setCustom({ ...custom, name: e.target.value })} /></label>
                <label>{t('단위')}<input value={custom.unit} placeholder="K" onChange={(e) => p.setCustom({ ...custom, unit: e.target.value })} /></label>
                <label className="grow">{t('수식')}<input value={custom.expr} spellCheck={false} placeholder="y + 273.15" onChange={(e) => p.setCustom({ ...custom, expr: e.target.value })} /></label>
              </div>
              {customFn.err && <p className="note warn">{t('수식을 읽을 수 없습니다: ‘{tok}’ 부근을 확인하세요.', { tok: customFn.err === 'end' ? t('끝') : customFn.err })}</p>}
              <p className="note">{t('쓸 수 있는 것: y = {name} 값, x = 가로축({x}), y0 = 첫 값, 센서 이름({ids}), + − * / ^ ( ), ln log sqrt abs exp sin cos, pi', { name: anaCol?.title ?? '', x: xUnit, ids: sensors.map((x) => x.id).join(', ') })}</p>
              <div className="cands">
                <span className="note">{t('예시:')}</span>
                {FORMULA_EXAMPLES.map((f) => <button key={f.expr} className="chip-btn" onClick={() => p.setCustom({ name: t(f.name), unit: f.unit, expr: f.expr })}>{t(f.name)} · {f.expr}</button>)}
              </div>
            </div>
          )}
          <p className="note">{t('튀는 값은 ‘제외’를 눌러 그래프와 해석에서 뺄 수 있습니다 (데이터는 지워지지 않음).')}</p>
          <DataTable
            head={[mode === 'event' ? xTitle : t('시간(s)'), ...cols.map((c) => c.title), ...(calcTitle ? [calcTitle] : [])]}
            rows={numericTable(active)}
            decimals={[mode === 'event' ? 4 : 2, ...cols.map((c) => c.decimals)]}
            calcCol={!!calcTitle}
            onToggle={toggleExclude}
            onDelete={active.mode === 'event' ? deleteEvent : undefined}
          />
        </section>
      )}

      {infoOpen && <InfoSheet info={p.info} onSave={p.setInfo} onClose={() => setInfoOpen(false)} />}
      {videoOpen && (
        <VideoSync
          charts={charts.map((c) => ({ id: c.sensor.id, label: c.label, unit: c.unit, decimals: c.sensor.decimals, series: active ? [{ id: active.id, name: active.name, color: '--s1', pts: pointsFor(active, c.sensor.id), points: false, line: true }] : [] }))}
          onClose={() => setVideoOpen(false)}
        />
      )}
      {big && (
        <BigScreen
          title={exp.title}
          running={running}
          connected={p.connected}
          tiles={charts.map((c) => ({ id: c.sensor.id, label: c.label, unit: c.unit, value: fmtValue(latest(c.sensor.id), c.sensor.decimals),
            pts: (active?.rows ?? []).slice(-120).map((r) => r.v[c.sensor.id]).filter((v): v is number => typeof v === 'number') }))}
          onStart={startClick}
          onStop={p.onStop}
          onClose={() => setBig(false)}
        />
      )}
      {exportOpen && <ExportSheet runCount={dataRuns.length} onExport={doExport} onClose={() => setExportOpen(false)} />}
    </main>
  );
}

function DataTable({ head, rows, decimals, calcCol, onToggle, onDelete }: {
  head: string[]; rows: { idx: number; excluded: boolean; cells: number[] }[]; decimals: number[]; calcCol: boolean;
  onToggle: (i: number) => void; onDelete?: (i: number) => void;
}) {
  const LIMIT = 500;
  const shown = rows.length > LIMIT ? rows.slice(rows.length - LIMIT) : rows;
  const cell = (v: number, j: number) => {
    if (!isFinite(v)) return '';
    if (calcCol && j === head.length - 1) return sig(v);
    return v.toFixed(Math.min(decimals[j] ?? 3, 6));
  };
  return (
    <>
      <div className="ana-table data-scroll">
        <table>
          <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}<th /></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.idx} className={r.excluded ? 'excluded' : ''}>
                {r.cells.map((v, j) => <td key={j}>{cell(v, j)}</td>)}
                <td className="row-acts">
                  <button className="link" onClick={() => onToggle(r.idx)}>{r.excluded ? t('되돌리기') : t('제외')}</button>
                  {onDelete && <button className="link" onClick={() => onDelete(r.idx)}>{t('삭제')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > LIMIT && <p className="note">{t('최근 {n}개만 보여 줍니다. 전체는 저장하기로 내보내세요.', { n: LIMIT })}</p>}
    </>
  );
}

/** 측정값을 이론값·문헌값과 비교해 오차를 봄 (선택 구간 평균 → 평탄 구간 → 마지막 값 순) */
function CompareRef({ unit, decimals, source, value, sd, accuracy }: { unit: string; decimals?: number; source: 'sel' | 'plateau' | 'last'; value: number; sd: number; accuracy?: string }) {
  const [ref, setRef] = useState('');
  const [tol, setTol] = useState('');
  const r = Number(ref), tl = Number(tol);
  const ok = ref !== '' && Number.isFinite(r);
  const err = ok ? value - r : 0;
  const rel = ok && r !== 0 ? (err / r) * 100 : null;
  const pass = ok && tol !== '' && Number.isFinite(tl) ? Math.abs(err) <= tl : null;
  const f = (x: number) => fmtValue(x, decimals);
  const srcName = source === 'sel' ? t('선택 구간 평균') : source === 'plateau' ? t('평탄 구간 평균') : t('마지막 값');
  return (
    <div className="compare-ref" data-nav={t('기준값과 비교')}>
      <b>{t('기준값과 비교')}</b>
      <span className="note">{srcName}: <b className="k-num">{f(value)} {unit}</b>{sd ? ` ±${f(sd)}` : ''}</span>
      <label className="mini">{t('이론값·문헌값')} <input inputMode="decimal" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={unit} aria-label={t('이론값·문헌값')} /></label>
      <label className="mini">{t('허용 오차')} <input inputMode="decimal" value={tol} onChange={(e) => setTol(e.target.value)} placeholder="±" aria-label={t('허용 오차')} /></label>
      {ok && (
        <span className={`cr-out ${pass === null ? '' : pass ? 'pass' : 'fail'}`}>
          {t('오차')} {err > 0 ? '+' : ''}{f(err)} {unit}{rel !== null && Math.abs(rel) < 1000 ? ` (${rel > 0 ? '+' : ''}${rel.toFixed(1)} %)` : ''}{pass === null ? '' : pass ? ' ✓' : ' ✗'}
        </span>
      )}
      {accuracy && <small className="note">{t('센서 정확도')}: {accuracy}</small>}
    </div>
  );
}

/** 해석 결과를 읽는 법 (학생용 안내) */
function Interpret({ fit, area: ar, deriv, tool, showEq, showPlateau, mode, logX, unit, xUnit }: {
  fit: boolean; area: boolean; deriv: boolean; tool: ChartTool; showEq: boolean; showPlateau: boolean; mode: string; logX?: boolean; unit: string; xUnit: string;
}) {
  const tips: string[] = [];
  if (fit) tips.push(logX
    ? t('로그 눈금에서 직선이면: 기울기는 "가로축 값이 10배 될 때 세로축 변화량"입니다. 강산 희석이라면 pH가 약 1씩 오르는지 보세요.')
    : t('함수 찾기: R²가 1에 가까울수록 잘 맞습니다. ‘자동’은 가장 잘 맞는 식을 고르되, 식이 복잡하면 R²가 확실히 좋아야 고릅니다. 실험 원리에 맞는 식인지 꼭 함께 생각하세요.'));
  if (tool === 'tangent') tips.push(t('접선: 그 순간의 변화 속도({u})입니다.', { u: `${unit}/${xUnit}` }) + (mode === 'time' ? ' ' + t('반응 초기와 나중의 기울기를 비교해 반응 속도 변화를 봅니다.') : ''));
  if (ar) tips.push(t('넓이: 곡선과 가로축 사이 넓이({u})입니다. 선택 구간만 계산하려면 그래프를 드래그하세요.', { u: `${unit}·${xUnit}` }));
  if (deriv) tips.push(t('변화율 그래프: 값이 가장 빨리 변하는 곳이 봉우리로 나타납니다. 적정에서는 봉우리 위치가 당량점입니다.'));
  if (showEq) tips.push(t('당량점: pH가 가장 급하게 변하는 곳입니다. 이 부피로 시료의 몰 농도를 계산하세요. 약산이라면 반당량점의 pH가 pKa와 같습니다.'));
  if (showPlateau) tips.push(t('평탄 구간: 값이 거의 변하지 않는 가장 긴 구간입니다. 냉각 곡선에서는 이 온도가 어는점입니다.'));
  if (!tips.length) tips.push(t('그래프를 드래그해 구간을 고르면 그 구간의 평균·변화량을 계산합니다. 함수 찾기·접선·넓이로 해석해 보세요.'));
  return <ul className="tips">{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}
