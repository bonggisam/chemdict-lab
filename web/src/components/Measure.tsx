import { useMemo, useState } from 'react';
import { Chart, fmt, type ChartTool, type Overlays, type Series } from './Chart';
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
  onStart: () => void;
  onStop: () => void;
  onBack: () => void;
  onOpenSetup: () => void;
  onOpenCal: (id?: string) => void;
  onOpenGuide: () => void;
  say: (kind: 'ok' | 'err', text: string) => void;
  onEventX?: (nextX: number) => void;
  station?: number;
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

  // ---- 그래프 상태
  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [tool, setTool] = useState<ChartTool>('select');
  const [style, setStyle] = useState<Style>('auto');
  const [xAxis, setXAxisState] = useState('');              // '' = 시간(또는 입력값), 아니면 센서 id
  const [smoothWin, setSmoothWin] = useState(1);
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
  const [calc, setCalc] = useState<CalcId>('none');
  const [exportOpen, setExportOpen] = useState(false);
  const [eventX, setEventX] = useState<string>(String(ev?.start ?? 0));
  const [markerNote, setMarkerNote] = useState('');
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const setXAxis = (id: string) => { setXAxisState(id); setZoom(null); setSelection(null); };

  // 그래프 목록: 템플릿의 y 축 → 센서 종류로 찾기. 자유 측정이면 연결된 모든 센서
  const allCharts: ChartSpec[] = useMemo(() => {
    if (exp.y.length) {
      return exp.y.flatMap((y) => {
        const s = sensors.find((x) => x.id === y.sensor) ?? sensors.find((x) => x.type === y.sensor);
        return s ? [{ sensor: s, label: y.label, unit: y.unit ?? s.displayUnit, min: y.min, max: y.max }] : [];
      });
    }
    return sensors.map((s) => ({ sensor: s, label: s.displayName, unit: s.displayUnit, min: s.spec?.min, max: s.spec?.max }));
  }, [exp, sensors]);

  // 가로축: 시간 / 입력값 / 다른 센서
  const xSensor = mode === 'time' && xAxis ? sensors.find((s) => s.id === xAxis) : undefined;
  const xSpec = xSensor ? allCharts.find((c) => c.sensor.id === xSensor.id) : undefined;
  const charts = xSensor ? allCharts.filter((c) => c.sensor.id !== xSensor.id) : allCharts;
  const xUnit = xSensor ? (xSpec?.unit ?? xSensor.displayUnit) : mode === 'event' ? ev?.unit ?? '' : 's';
  const xName = xSensor ? (xSpec?.label ?? xSensor.displayName) : mode === 'event' && ev ? ev.label : '시간';
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
  const fitName = (r: FitResult) => MODELS.find((m) => m.id === r.model)!.name;
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
      o.area = { pts, color: `--s${activeAna.run.colorIndex + 1}`, label: `넓이 ${sig(activeAna.area)} ${anaChart?.unit ?? ''}·${xUnit}` };
    }
    if (showEq && activeAna.eq) {
      o.vlines = [{ x: activeAna.eq.x, label: `당량점 ${fmt(activeAna.eq.x)} ${ev?.unit ?? ''}` }];
      if (activeAna.eq.halfY !== null) o.vlines.push({ x: activeAna.eq.halfX, label: `반당량점 pH ${fmt(activeAna.eq.halfY)}` });
    }
    if (showPlateau && activeAna.plateau) {
      const pl = activeAna.plateau;
      o.hband = { x0: pl.x0, x1: pl.x1, y: pl.mean, label: `평탄 구간 평균 ${fmt(pl.mean)} ${anaChart?.unit ?? ''}` };
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

  // ---- 이벤트 기록 (최근 1초 평균)
  const recordEvent = () => {
    if (!active) return;
    const x = Number(eventX);
    if (!isFinite(x)) { p.say('err', `${ev?.label ?? '값'}을 숫자로 입력하세요.`); return; }
    if (ev?.scale === 'log' && x <= 0) { p.say('err', '로그 눈금에서는 0보다 큰 값만 쓸 수 있습니다.'); return; }
    const v: Record<string, number> = {};
    for (const s of sensors) {
      const vals = recentValues(active, s.id, 1.0);
      if (vals.length) v[s.id] = Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(s.decimals + 1));
    }
    if (!Object.keys(v).length) { p.say('err', '아직 받은 값이 없습니다. 측정을 시작했는지 확인하세요.'); return; }
    const t = active.rows[active.rows.length - 1]?.t ?? 0;
    setRuns((rs) => rs.map((r) => (r.id === active.id ? { ...r, events: [...r.events, { x, v, t }] } : r)));
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
    const t = active.rows[active.rows.length - 1]?.t ?? 0;
    const note = markerNote.trim() || exp.markers.label;
    setRuns((rs) => rs.map((r) => (r.id === active.id ? { ...r, markers: [...r.markers, { t, note }] } : r)));
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
  const calcTitle = calc !== 'none' && anaCol ? calcInfo.title(anaCol.title) : '';
  const isTemp = (anaChart?.unit ?? '').includes('°C');

  /** 측정 하나의 숫자 표: [x, 센서들..., 계산 열?] + 행마다 제외 여부 */
  const numericTable = (run: Run) => {
    const items = run.mode === 'event'
      ? run.events.map((e, i) => ({ i, x: e.x, v: e.v })).sort((a, b) => a.x - b.x)
      : run.rows.map((r, i) => ({ i, x: r.t, v: r.v }));
    const ex = new Set(run.excluded ?? []);
    const extra = calc !== 'none' && anaId ? calcColumn(calc, items.map((it) => it.x), items.map((it) => it.v[anaId] ?? NaN)) : null;
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

  const summaryHead = ['측정', '개수', '평균', '최소', '최대', '표준편차', '변화량 Δ',
    ...(fitSel !== 'off' ? ['함수', 'R²'] : []), ...(showArea ? ['넓이'] : []),
    ...(showEq ? ['당량점', '반당량점 pH'] : []), ...(showPlateau ? ['평탄 구간'] : [])];
  const summaryRows = (analysis ?? []).map(({ run, st, fit, area: ar, eq, plateau }) => [
    run.name, String(st?.n ?? 0), st ? fmt(st.mean) : '—', st ? fmt(st.min) : '—', st ? fmt(st.max) : '—', st ? fmt(st.sd) : '—', st ? fmt(st.dy) : '—',
    ...(fitSel !== 'off' ? [fit ? `${fitName(fit)}: ${equation(fit)}` : '—', fit ? fit.r2.toFixed(4) : '—'] : []),
    ...(showArea ? [ar !== null ? `${sig(ar)} ${anaChart?.unit ?? ''}·${xUnit}` : '—'] : []),
    ...(showEq ? [eq ? `${fmt(eq.x)} ${ev?.unit ?? ''} (pH ${fmt(eq.y)})` : '뚜렷한 급변 없음', eq?.halfY != null ? fmt(eq.halfY) : '—'] : []),
    ...(showPlateau ? [plateau ? `${fmt(plateau.mean)} ${anaChart?.unit ?? ''} (${fmt(plateau.x0)}~${fmt(plateau.x1)} s)` : '없음'] : []),
  ]);

  const buildReport = (): Report => {
    const d = new Date();
    const meta = [
      `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      ...(p.station ? [`모둠 ${p.station}`] : []),
      mode === 'event' ? `값 입력 · ${ev?.label}` : `시간 기록 · 간격 ${intervalText(p.intervalMs)}`,
      ...(selection ? [`해석 구간 ${fmt(Math.min(...selection))}~${fmt(Math.max(...selection))} ${xUnit}`] : []),
    ];
    const head = [mode === 'event' ? `${ev?.label ?? 'x'}(${ev?.unit ?? ''})` : '시간(s)', ...cols.map((c) => c.title), ...(calcTitle ? [calcTitle] : []), '해석 제외'];
    const rRuns = dataRuns.map((run) => ({
      name: run.name, colorIndex: run.colorIndex, head,
      rows: numericTable(run).map((r) => [...r.cells.map((v) => (typeof v === 'number' && !isFinite(v) ? null : v)), r.excluded ? '제외' : null]),
    }));
    const colOf = (id: string) => 1 + cols.findIndex((c) => c.id === id);
    const notes: string[] = [];
    for (const a of analysis ?? []) {
      if (!dataRuns.includes(a.run)) continue;
      if (a.fit) notes.push(`${a.run.name} — ${fitName(a.fit)}: ${equation(a.fit)}${logX ? ' (x = log 가로축)' : ''}, R² = ${a.fit.r2.toFixed(4)}`);
      if (a.area !== null) notes.push(`${a.run.name} — 곡선 아래 넓이: ${sig(a.area)} ${anaChart?.unit ?? ''}·${xUnit}`);
    }
    if (smoothWin > 1) notes.push(`그래프는 ${smoothWin}점 이동 평균으로 부드럽게 한 값입니다.`);
    if (dataRuns.some((r) => r.excluded?.length)) notes.push('‘해석 제외’ 표시한 점은 그래프와 해석에서 뺐습니다.');
    return {
      title: exp.title,
      meta,
      xTitle,
      logX,
      charts: charts.map((c) => ({
        title: `${c.label}${c.unit ? ` (${c.unit})` : ''}`,
        yTitle: `${c.label}${c.unit ? ` (${c.unit})` : ''}`,
        sensorCol: colOf(c.sensor.id),
        xCol: xSensor ? colOf(xSensor.id) : 0,
        opts: {
          series: seriesFor(c).filter((s) => dataRuns.some((r) => r.id === s.id)),
          xLabel, unit: c.unit, xLog: logX, timeAxis: mode === 'time' && !xSensor, yMin: c.min, yMax: c.max, xRange: zoom,
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
    if (!dataRuns.length) { p.say('err', '저장할 데이터가 없습니다.'); return; }
    if (k === 'csv') { saveFile(new Blob([runsCSV(dataRuns, cols, xTitle)], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`); return; }
    if (k === 'copy') { await copyTable(); return; }
    const r = buildReport();
    if (k === 'png') {
      const c = reportImage(r);
      await new Promise<void>((res) => c.toBlob((b) => { if (b) saveFile(b, `${baseName}.png`); res(); }, 'image/png'));
    } else if (k === 'pdf') {
      saveFile(await reportPdf(r), `${baseName}.pdf`);
    } else {
      saveFile(reportXlsx(r), `${baseName}.xlsx`);
      if (k === 'numbers') p.say('ok', 'Numbers에서 이 .xlsx 파일을 열면 표와 그래프가 그대로 나옵니다.');
    }
  };
  const copyTable = async () => {
    if (!active) return;
    const tsv = toTSV(runTable(active, cols, xTitle));
    try { await navigator.clipboard.writeText(tsv); p.say('ok', '표를 복사했습니다. Numbers나 엑셀에 붙여넣으세요.'); }
    catch { p.say('err', '이 브라우저에서는 복사가 막혀 있습니다. CSV로 저장하세요.'); }
  };

  const hasData = !!active && (active.rows.length > 0 || active.events.length > 0);
  const derivPts = (run: Run) => (anaChart ? derivative(smooth(pointsFor(run, anaId), Math.max(3, smoothWin))) : []);
  const otherSensors = mode === 'time' ? allCharts : [];

  return (
    <main className="wide measure">
      <div className="row-head">
        <div>
          <button className="ghost back" disabled={running} onClick={p.onBack}>← 실험 목록</button>
          <h1>{exp.title}</h1>
          <span className="mode-badge">{mode === 'event' ? `값 입력 모드 · ${ev?.label}` : '시간 기록 모드'}</span>
        </div>
        <div className="controls">
          {mode === 'time' && <IntervalPicker value={p.intervalMs} disabled={running} onChange={p.setIntervalMs} />}
          {!running
            ? <button className="primary" onClick={p.onStart}>측정 시작</button>
            : <button className="danger" onClick={p.onStop}>정지</button>}
        </div>
      </div>
      {mode === 'time' && p.intervalMs >= 2000 && !running && (
        <p className="note">간격이 길면 그래프 점이 드문드문 찍힙니다. 온습도(DHT)는 2초, 이산화탄소(SCD4x)는 5초보다 짧으면 같은 값이 반복됩니다.</p>
      )}

      {/* 측정 목록 */}
      <div className="runs">
        {runs.map((r) => (
          <div key={r.id} className={`run ${r.id === active?.id ? 'active' : ''}`}>
            <input type="checkbox" aria-label={`${r.name} 그래프에 표시`} checked={r.visible} onChange={(e) => patchRun(r.id, { visible: e.target.checked })} />
            <i style={{ background: `var(--s${r.colorIndex + 1})` }} />
            {renaming === r.id ? (
              <input className="rename" autoFocus defaultValue={r.name}
                onBlur={(e) => { patchRun(r.id, { name: e.target.value.trim() || r.name }); setRenaming(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
            ) : (
              <button className="run-name" disabled={running} onClick={() => (r.id === active?.id ? setRenaming(r.id) : setActiveId(r.id))} title={r.id === active?.id ? '이름 바꾸기' : '이 측정 선택'}>
                {r.name}
              </button>
            )}
            <span className="run-count">{r.mode === 'event' ? `${r.events.length}점` : `${r.rows.length}개`}</span>
            <button className="x" disabled={running} onClick={() => removeRun(r.id)} aria-label={`${r.name} 삭제`}>{armedDelete === r.id ? '삭제?' : '×'}</button>
          </div>
        ))}
        <button className="ghost add-run" disabled={running} onClick={addRun}>+ 새 측정</button>
      </div>

      <details className="steps">
        <summary>실험 순서 보기</summary>
        <ol>{exp.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </details>

      {charts.length === 0 && (
        <p className="note warn">이 실험에 필요한 센서({exp.sensors.join(', ')})가 연결되어 있지 않습니다. <button className="link" onClick={p.onOpenGuide}>연결 안내</button> · <button className="link" onClick={p.onOpenSetup}>센서 연결 설정</button></p>
      )}

      {/* 값 입력 모드: 기록 막대 */}
      {mode === 'event' && ev && (
        <div className="event-bar">
          <label htmlFor="event-x">{ev.label}</label>
          <input id="event-x" inputMode="decimal" value={eventX} onChange={(e) => setEventX(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') recordEvent(); }} />
          <span className="unit">{ev.unit}</span>
          <button className="primary" disabled={!running} onClick={recordEvent}>값 기록</button>
          <span className="note">{running ? '값이 ‘안정’이 되면 누르세요. 최근 1초 평균을 기록합니다.' : '먼저 측정 시작을 누르세요.'}</span>
        </div>
      )}

      {/* 그래프 도구 */}
      {charts.length > 0 && (
        <div className="graph-tools" role="toolbar" aria-label="그래프 도구">
          <div className="seg" role="radiogroup" aria-label="그래프에서 할 일">
            {([['select', '구간 선택'], ['read', '값 읽기'], ['tangent', '접선']] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={tool === k} className={tool === k ? 'on' : ''} onClick={() => setTool(k)}>{l}</button>
            ))}
          </div>
          {zoom
            ? <button className="ghost" onClick={() => setZoom(null)}>전체 보기</button>
            : <button className="ghost" disabled={!selection} onClick={() => { if (selection) { setZoom([Math.min(...selection), Math.max(...selection)]); } }}>선택 구간 확대</button>}
          <label className="mini">표시
            <select value={style} onChange={(e) => setStyle(e.target.value as Style)}>
              <option value="auto">자동</option><option value="line">선</option><option value="points">점</option><option value="both">선+점</option>
            </select>
          </label>
          {otherSensors.length > 1 && (
            <label className="mini">가로축
              <select value={xAxis} onChange={(e) => setXAxis(e.target.value)}>
                <option value="">시간</option>
                {otherSensors.map((c) => <option key={c.sensor.id} value={c.sensor.id}>{c.label}</option>)}
              </select>
            </label>
          )}
          <label className="mini">부드럽게
            <select value={smoothWin} onChange={(e) => setSmoothWin(Number(e.target.value))}>
              <option value={1}>끔</option><option value={3}>약하게 (3점)</option><option value={5}>보통 (5점)</option><option value={9}>강하게 (9점)</option>
            </select>
          </label>
        </div>
      )}

      <div className="charts">
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
            title={`${anaChart.label} 변화율`}
            unit={`${anaChart.unit}/${xUnit}`}
            series={visibleRuns.map((r) => ({ id: r.id, name: r.name, color: `--s${r.colorIndex + 1}`, pts: derivPts(r), points: false }))}
            xLabel={xLabel}
            xUnit={xUnit}
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
      </div>

      {/* 도구 막대 */}
      <div className="toolbar">
        {mode === 'time' && exp.markers.enabled && (
          <div className="marker">
            <input id="marker-note" aria-label={exp.markers.label} value={markerNote} placeholder={exp.markers.prompt} onChange={(e) => setMarkerNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addMarker(); }} />
            <button onClick={addMarker} disabled={!running}>{exp.markers.label}</button>
          </div>
        )}
        <div className="actions">
          <button className="ghost" onClick={p.onOpenGuide}>연결 안내</button>
          <button className="ghost" disabled={running} onClick={p.onOpenSetup}>센서 설정</button>
          <button className="ghost" disabled={!sensors.some((s) => s.spec && s.spec.cal.kind !== 'none')} onClick={() => p.onOpenCal(charts[0]?.sensor.id)}>보정</button>
          {charts.length > 0 && !xSensor && (
            drawing
              ? <button className="ghost" onClick={() => setDrawing(false)}>그리기 취소</button>
              : active?.prediction.length || runs.some((r) => r.prediction.length)
                ? <button className="ghost" onClick={() => setRuns((rs) => rs.map((r) => ({ ...r, prediction: [] })))}>예측 지우기</button>
                : <button className="ghost" onClick={() => setDrawing(true)}>예측 그리기</button>
          )}
          <button className="ghost" onClick={() => setShowTable((v) => !v)}>{showTable ? '표 닫기' : '표 보기'}</button>
          <button className="primary" disabled={!dataRuns.length} onClick={() => setExportOpen(true)}>저장하기</button>
        </div>
      </div>

      {/* 해석 */}
      {anaChart && analysis && (
        <section className="analysis">
          <div className="ana-head">
            <h2>데이터 해석</h2>
            {charts.length > 1 && (
              <select id="ana-sensor" value={anaId} onChange={(e) => setAnaSensor(e.target.value)} aria-label="해석할 센서">
                {charts.map((c) => <option key={c.sensor.id} value={c.sensor.id}>{c.label}</option>)}
              </select>
            )}
            <span className="note">
              {selection ? `선택 구간 ${fmt(Math.min(...selection))} ~ ${fmt(Math.max(...selection))} ${xUnit}` : '전체 구간 (그래프를 드래그하면 그 구간만 계산)'}
            </span>
            {selection && <button className="link" onClick={() => setSelection(null)}>선택 해제</button>}
          </div>

          <div className="ana-tools">
            <label className="fit-pick">함수 찾기
              <select value={fitSel} onChange={(e) => setFitSel(e.target.value as ModelId | 'off')}>
                <option value="off">끔</option>
                <option value="auto">자동 (가장 잘 맞는 것)</option>
                {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.form}</option>)}
              </select>
            </label>
            <label><input type="checkbox" checked={showArea} onChange={(e) => setShowArea(e.target.checked)} /> 넓이 (적분)</label>
            <label><input type="checkbox" checked={showDeriv} onChange={(e) => setShowDeriv(e.target.checked)} /> 변화율 그래프</label>
            {tools.includes('equivalence') && mode === 'event' && <label><input type="checkbox" checked={showEq} onChange={(e) => setShowEq(e.target.checked)} /> 당량점 찾기</label>}
            {tools.includes('plateau') && mode === 'time' && !xSensor && <label><input type="checkbox" checked={showPlateau} onChange={(e) => setShowPlateau(e.target.checked)} /> 평탄 구간 찾기</label>}
          </div>

          {activeAna?.fit && (
            <div className="fit-card">
              <div className="fit-eq">
                <span className="note">{activeAna.run.name} · {fitName(activeAna.fit)}{logX ? ' (x = log 가로축)' : ''}</span>
                <b>{equation(activeAna.fit)}</b>
                <span>R² = {activeAna.fit.r2.toFixed(4)} · 오차(RMSE) {sig(activeAna.fit.rmse)} · 점 {activeAna.fit.n}개</span>
              </div>
              <p className="note">{MODELS.find((m) => m.id === activeAna.fit!.model)?.use}</p>
              {fitSel === 'auto' && activeAna.cands.length > 1 && (
                <div className="cands">
                  <span className="note">다른 후보:</span>
                  {activeAna.cands.slice(1).map((c) => (
                    <button key={c.model} className="chip-btn" onClick={() => setFitSel(c.model)}>{fitName(c)} (R² {c.r2.toFixed(3)})</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {fitSel !== 'off' && !activeAna?.fit && <p className="note warn">이 데이터에는 이 함수를 맞출 수 없습니다 (점이 너무 적거나 0·음수 값).</p>}

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
        </section>
      )}

      {showTable && active && (
        <section className="data-table">
          <div className="ana-head">
            <h2>{active.name} 표</h2>
            <label className="mini">계산 열
              <select value={calc} onChange={(e) => setCalc(e.target.value as CalcId)}>
                {CALCS.filter((c) => !c.tempOnly || isTemp).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {calc !== 'none' && anaCol && <span className="note">기준: {anaCol.title}</span>}
            {!!active.excluded?.length && <button className="link" onClick={() => patchRun(active.id, { excluded: [] })}>제외 {active.excluded.length}개 모두 되돌리기</button>}
            <button className="link" disabled={!hasData} onClick={copyTable}>표 복사</button>
          </div>
          <p className="note">튀는 값은 ‘제외’를 눌러 그래프와 해석에서 뺄 수 있습니다 (데이터는 지워지지 않음).</p>
          <DataTable
            head={[mode === 'event' ? xTitle : '시간(s)', ...cols.map((c) => c.title), ...(calcTitle ? [calcTitle] : [])]}
            rows={numericTable(active)}
            decimals={[mode === 'event' ? 4 : 2, ...cols.map((c) => c.decimals)]}
            calcCol={!!calcTitle}
            onToggle={toggleExclude}
            onDelete={active.mode === 'event' ? deleteEvent : undefined}
          />
        </section>
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
                  <button className="link" onClick={() => onToggle(r.idx)}>{r.excluded ? '되돌리기' : '제외'}</button>
                  {onDelete && <button className="link" onClick={() => onDelete(r.idx)}>삭제</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > LIMIT && <p className="note">최근 {LIMIT}개만 보여 줍니다. 전체는 저장하기로 내보내세요.</p>}
    </>
  );
}

/** 해석 결과를 읽는 법 (학생용 안내) */
function Interpret({ fit, area: ar, deriv, tool, showEq, showPlateau, mode, logX, unit, xUnit }: {
  fit: boolean; area: boolean; deriv: boolean; tool: ChartTool; showEq: boolean; showPlateau: boolean; mode: string; logX?: boolean; unit: string; xUnit: string;
}) {
  const tips: string[] = [];
  if (fit) tips.push(logX
    ? '로그 눈금에서 직선이면: 기울기는 "가로축 값이 10배 될 때 세로축 변화량"입니다. 강산 희석이라면 pH가 약 1씩 오르는지 보세요.'
    : '함수 찾기: R²가 1에 가까울수록 잘 맞습니다. ‘자동’은 가장 잘 맞는 식을 고르되, 식이 복잡하면 R²가 확실히 좋아야 고릅니다. 실험 원리에 맞는 식인지 꼭 함께 생각하세요.');
  if (tool === 'tangent') tips.push(`접선: 그 순간의 변화 속도(${unit}/${xUnit})입니다. ${mode === 'time' ? '반응 초기와 나중의 기울기를 비교해 반응 속도 변화를 봅니다.' : ''}`);
  if (ar) tips.push(`넓이: 곡선과 가로축 사이 넓이(${unit}·${xUnit})입니다. 선택 구간만 계산하려면 그래프를 드래그하세요.`);
  if (deriv) tips.push('변화율 그래프: 값이 가장 빨리 변하는 곳이 봉우리로 나타납니다. 적정에서는 봉우리 위치가 당량점입니다.');
  if (showEq) tips.push('당량점: pH가 가장 급하게 변하는 곳입니다. 이 부피로 시료의 몰 농도를 계산하세요. 약산이라면 반당량점의 pH가 pKa와 같습니다.');
  if (showPlateau) tips.push('평탄 구간: 값이 거의 변하지 않는 가장 긴 구간입니다. 냉각 곡선에서는 이 온도가 어는점입니다.');
  if (!tips.length) tips.push('그래프를 드래그해 구간을 고르면 그 구간의 평균·변화량을 계산합니다. 함수 찾기·접선·넓이로 해석해 보세요.');
  return <ul className="tips">{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}
