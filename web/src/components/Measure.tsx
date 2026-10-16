import { useMemo, useState } from 'react';
import { Chart, fmt, type Overlays, type Series } from './Chart';
import type { Experiment } from '../lib/protocol';
import type { ResolvedSensor } from '../lib/sensors';
import { fmtValue } from '../lib/sensors';
import { findEquivalence, findPlateau, isStable, linearFit, stats, type Pt } from '../lib/analysis';
import { newRun, recentValues, runTable, runsCSV, saveFile, seriesPoints, toTSV, type Run } from '../lib/runs';

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
  say: (kind: 'ok' | 'err', text: string) => void;
  onEventX?: (nextX: number) => void;
  station?: number;
}

interface ChartSpec { sensor: ResolvedSensor; label: string; unit: string; min?: number; max?: number }

export function Measure(p: Props) {
  const { exp, sensors, runs, setRuns, activeId, setActiveId, running } = p;
  const mode = exp.mode ?? 'time';
  const ev = exp.event;
  const tools = exp.analysis ?? ['stats', 'fit'];
  const active = runs.find((r) => r.id === activeId) ?? runs[0];

  const [selection, setSelection] = useState<[number, number] | null>(null);
  const [anaSensor, setAnaSensor] = useState<string>('');
  const [showFit, setShowFit] = useState(false);
  const [showEq, setShowEq] = useState(false);
  const [showPlateau, setShowPlateau] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [eventX, setEventX] = useState<string>(String(ev?.start ?? 0));
  const [markerNote, setMarkerNote] = useState('');
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  // 그래프 목록: 템플릿의 y 축 → 센서 종류로 찾기. 자유 측정이면 연결된 모든 센서
  const charts: ChartSpec[] = useMemo(() => {
    if (exp.y.length) {
      return exp.y.flatMap((y) => {
        const s = sensors.find((x) => x.id === y.sensor) ?? sensors.find((x) => x.type === y.sensor);
        return s ? [{ sensor: s, label: y.label, unit: y.unit ?? s.displayUnit, min: y.min, max: y.max }] : [];
      });
    }
    return sensors.map((s) => ({ sensor: s, label: s.displayName, unit: s.displayUnit, min: s.spec?.min, max: s.spec?.max }));
  }, [exp, sensors]);

  const anaId = anaSensor && charts.some((c) => c.sensor.id === anaSensor) ? anaSensor : charts[0]?.sensor.id ?? '';
  const anaChart = charts.find((c) => c.sensor.id === anaId);
  const xTitle = mode === 'event' && ev ? `${ev.label}(${ev.unit})` : '시간(s)';
  const xLabel = mode === 'event' && ev ? `${ev.label} (${ev.unit})` : '시간 (s)';
  const visibleRuns = runs.filter((r) => r.visible);

  const inSel = (pts: Pt[]) => {
    if (!selection) return pts;
    const [a, b] = [Math.min(...selection), Math.max(...selection)];
    return pts.filter(([x]) => x >= a && x <= b);
  };

  // ---- 해석
  const analysis = useMemo(() => {
    if (!anaChart) return null;
    const band = anaChart.sensor.spec?.stableBand ?? 0.05;
    return visibleRuns.map((run) => {
      const all = seriesPoints(run, anaId);
      const pts = inSel(all);
      const fitPts = mode === 'event' && ev?.scale === 'log' ? pts.filter(([x]) => x > 0).map(([x, y]) => [Math.log10(x), y] as Pt) : pts;
      return {
        run,
        st: stats(pts),
        fit: linearFit(fitPts),
        eq: mode === 'event' ? findEquivalence(all) : null,
        plateau: mode === 'time' ? findPlateau(pts, band * 4, 15) : null,
      };
    });
  }, [visibleRuns, anaId, anaChart, selection, mode, ev]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeAna = analysis?.find((a) => a.run.id === active?.id) ?? analysis?.[0];

  const overlaysFor = (sensorId: string): Overlays | undefined => {
    if (sensorId !== anaId || !activeAna) return undefined;
    const o: Overlays = {};
    const pts = inSel(seriesPoints(activeAna.run, anaId));
    if (showFit && activeAna.fit && pts.length > 1) {
      const xs = pts.map(([x]) => x);
      const logX = mode === 'event' && ev?.scale === 'log';
      o.fit = { m: activeAna.fit.m, b: activeAna.fit.b, x0: Math.min(...xs), x1: Math.max(...xs), logX };
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
    setRuns((rs) => rs.map((r) => (r.id === active?.id ? { ...r, events: r.events.filter((_, i) => i !== idx) } : r)));
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

  // ---- 내보내기
  const cols = charts.length ? charts.map((c) => ({ id: c.sensor.id, title: c.unit ? `${c.label}(${c.unit})` : c.label, decimals: c.sensor.decimals }))
    : sensors.map((s) => ({ id: s.id, title: s.displayName, decimals: s.decimals }));
  const stamp = () => {
    const d = new Date(), z = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`;
  };
  const baseName = `chemdict_${exp.id}${p.station ? `_st${p.station}` : ''}_${stamp()}`;
  const exportCSV = () => {
    const rs = visibleRuns.filter((r) => r.rows.length || r.events.length);
    if (!rs.length) return;
    saveFile(new Blob([runsCSV(rs, cols, xTitle)], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`);
  };
  const copyTable = async () => {
    if (!active) return;
    const tsv = toTSV(runTable(active, cols, xTitle));
    try { await navigator.clipboard.writeText(tsv); p.say('ok', '표를 복사했습니다. Numbers나 엑셀에 붙여넣으세요.'); }
    catch { p.say('err', '이 브라우저에서는 복사가 막혀 있습니다. CSV 내보내기를 쓰세요.'); }
  };

  const hasData = !!active && (active.rows.length > 0 || active.events.length > 0);
  const table = active ? runTable(active, cols, xTitle) : [];

  return (
    <main className="wide measure">
      <div className="row-head">
        <div>
          <button className="ghost back" disabled={running} onClick={p.onBack}>← 실험 목록</button>
          <h1>{exp.title}</h1>
          <span className="mode-badge">{mode === 'event' ? `값 입력 모드 · ${ev?.label}` : '시간 기록 모드'}</span>
        </div>
        <div className="controls">
          {mode === 'time' && (
            <label className="interval">
              간격
              <select id="interval" value={p.intervalMs} disabled={running} onChange={(e) => p.setIntervalMs(Number(e.target.value))}>
                {[200, 500, 1000, 2000, 5000].map((ms) => <option key={ms} value={ms}>{ms / 1000}초</option>)}
              </select>
            </label>
          )}
          {!running
            ? <button className="primary" onClick={p.onStart}>측정 시작</button>
            : <button className="danger" onClick={p.onStop}>정지</button>}
        </div>
      </div>

      {/* 측정 목록 */}
      <div className="runs">
        {runs.map((r) => (
          <div key={r.id} className={`run ${r.id === active?.id ? 'active' : ''}`}>
            <input type="checkbox" aria-label={`${r.name} 그래프에 표시`} checked={r.visible} onChange={(e) => patchRun(r.id, { visible: e.target.checked })} />
            <i style={{ background: `var(--s${r.colorIndex + 1})` }} />
            {renaming === r.id ? (
              <input
                className="rename"
                autoFocus
                defaultValue={r.name}
                onBlur={(e) => { patchRun(r.id, { name: e.target.value.trim() || r.name }); setRenaming(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              />
            ) : (
              <button className="run-name" disabled={running} onClick={() => (r.id === active?.id ? setRenaming(r.id) : setActiveId(r.id))} title={r.id === active?.id ? '이름 바꾸기' : '이 측정 선택'}>
                {r.name}
              </button>
            )}
            <span className="run-count">{r.mode === 'event' ? `${r.events.length}점` : `${r.rows.length}개`}</span>
            <button className="x" disabled={running} onClick={() => removeRun(r.id)} aria-label={`${r.name} 삭제`}>
              {armedDelete === r.id ? '삭제?' : '×'}
            </button>
          </div>
        ))}
        <button className="ghost add-run" disabled={running} onClick={addRun}>+ 새 측정</button>
      </div>

      <details className="steps">
        <summary>실험 순서 보기</summary>
        <ol>{exp.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      </details>

      {charts.length === 0 && (
        <p className="note warn">이 실험에 필요한 센서({exp.sensors.join(', ')})가 연결되어 있지 않습니다. <button className="link" onClick={p.onOpenSetup}>센서 연결 설정</button></p>
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

      <div className="charts">
        {charts.map((c, i) => {
          const series: Series[] = visibleRuns.map((r) => ({
            id: r.id,
            name: r.name,
            color: `--s${r.colorIndex + 1}`,
            pts: seriesPoints(r, c.sensor.id),
            points: r.mode === 'event',
          }));
          const live = latest(c.sensor.id);
          return (
            <Chart
              key={c.sensor.id}
              title={c.label}
              unit={c.unit}
              value={fmtValue(live, c.sensor.decimals)}
              stable={stableOf(c.sensor)}
              series={series}
              xLabel={xLabel}
              xLog={mode === 'event' && ev?.scale === 'log'}
              timeAxis={mode === 'time'}
              yMin={c.min}
              yMax={c.max}
              markers={mode === 'time' ? active?.markers.map((m) => m.t) : []}
              selection={selection}
              onSelect={setSelection}
              overlays={overlaysFor(c.sensor.id)}
              prediction={i === 0 ? (active?.prediction.length ? active.prediction : runs.find((r) => r.prediction.length)?.prediction ?? []) : []}
              drawing={i === 0 && drawing}
              onDrawEnd={(pts) => { if (active) patchRun(active.id, { prediction: pts }); setDrawing(false); }}
              exportName={`${baseName}_${c.sensor.id}`}
            />
          );
        })}
      </div>

      {/* 도구 막대 */}
      <div className="toolbar">
        {mode === 'time' && exp.markers.enabled && (
          <div className="marker">
            <input id="marker-note" value={markerNote} placeholder={exp.markers.prompt} onChange={(e) => setMarkerNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addMarker(); }} />
            <button onClick={addMarker} disabled={!running}>{exp.markers.label}</button>
          </div>
        )}
        <div className="actions">
          <button className="ghost" disabled={running} onClick={p.onOpenSetup}>센서 설정</button>
          <button className="ghost" disabled={!sensors.some((s) => s.spec && s.spec.cal.kind !== 'none')} onClick={() => p.onOpenCal(charts[0]?.sensor.id)}>보정</button>
          {charts.length > 0 && (
            drawing
              ? <button className="ghost" onClick={() => setDrawing(false)}>그리기 취소</button>
              : active?.prediction.length || runs.some((r) => r.prediction.length)
                ? <button className="ghost" onClick={() => setRuns((rs) => rs.map((r) => ({ ...r, prediction: [] })))}>예측 지우기</button>
                : <button className="ghost" onClick={() => setDrawing(true)}>예측 그리기</button>
          )}
          <button className="ghost" onClick={() => setShowTable((v) => !v)}>{showTable ? '표 닫기' : '표 보기'}</button>
          <button className="ghost" disabled={!hasData} onClick={copyTable}>표 복사</button>
          <button className="primary" disabled={!visibleRuns.some((r) => r.rows.length || r.events.length)} onClick={exportCSV}>CSV 내보내기</button>
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
              {selection ? `선택 구간 ${fmt(Math.min(...selection))} ~ ${fmt(Math.max(...selection))} ${mode === 'event' ? ev?.unit ?? '' : 's'}` : '전체 구간 (그래프를 드래그하면 구간만 계산)'}
            </span>
            {selection && <button className="link" onClick={() => setSelection(null)}>선택 해제</button>}
          </div>

          <div className="tool-toggles">
            {tools.includes('fit') && <label><input type="checkbox" checked={showFit} onChange={(e) => setShowFit(e.target.checked)} /> 직선 맞춤{mode === 'event' && ev?.scale === 'log' ? ' (log x)' : ''}</label>}
            {tools.includes('equivalence') && mode === 'event' && <label><input type="checkbox" checked={showEq} onChange={(e) => setShowEq(e.target.checked)} /> 당량점 찾기</label>}
            {tools.includes('plateau') && mode === 'time' && <label><input type="checkbox" checked={showPlateau} onChange={(e) => setShowPlateau(e.target.checked)} /> 평탄 구간 찾기</label>}
          </div>

          <div className="ana-table">
            <table>
              <thead>
                <tr>
                  <th>측정</th><th>개수</th><th>평균</th><th>최소</th><th>최대</th><th>표준편차</th><th>변화량 Δ</th>
                  {showFit && <th>기울기</th>}{showFit && <th>R²</th>}
                  {showEq && <th>당량점</th>}{showEq && <th>반당량점 pH</th>}
                  {showPlateau && <th>평탄 구간</th>}
                </tr>
              </thead>
              <tbody>
                {analysis.map(({ run, st, fit, eq, plateau }) => (
                  <tr key={run.id} className={run.id === active?.id ? 'active' : ''}>
                    <td><i style={{ background: `var(--s${run.colorIndex + 1})` }} />{run.name}</td>
                    <td>{st?.n ?? 0}</td>
                    <td>{st ? fmt(st.mean) : '—'}</td>
                    <td>{st ? fmt(st.min) : '—'}</td>
                    <td>{st ? fmt(st.max) : '—'}</td>
                    <td>{st ? fmt(st.sd) : '—'}</td>
                    <td>{st ? fmt(st.dy) : '—'}</td>
                    {showFit && <td>{fit ? fmt(fit.m) : '—'}</td>}
                    {showFit && <td>{fit ? fit.r2.toFixed(3) : '—'}</td>}
                    {showEq && <td>{eq ? `${fmt(eq.x)} ${ev?.unit ?? ''} (pH ${fmt(eq.y)})` : '뚜렷한 급변 없음'}</td>}
                    {showEq && <td>{eq?.halfY != null ? fmt(eq.halfY) : '—'}</td>}
                    {showPlateau && <td>{plateau ? `${fmt(plateau.mean)} ${anaChart.unit} (${fmt(plateau.x0)}~${fmt(plateau.x1)} s)` : '없음'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Interpret tools={tools} showFit={showFit} showEq={showEq} showPlateau={showPlateau} mode={mode} logX={ev?.scale === 'log'} unit={anaChart.unit} />
        </section>
      )}

      {showTable && active && (
        <section className="data-table">
          <h2>{active.name} 데이터</h2>
          <div className="ana-table">
            <table>
              <thead><tr>{table[0]?.map((h, i) => <th key={i}>{h}</th>)}{active.mode === 'event' && <th />}</tr></thead>
              <tbody>
                {active.mode === 'event'
                  ? active.events
                      .map((e, idx) => ({ e, idx }))
                      .sort((a, b) => a.e.x - b.e.x)
                      .map(({ e, idx }) => (
                        <tr key={idx}>
                          <td>{e.x}</td>
                          {cols.map((c) => <td key={c.id}>{e.v[c.id] !== undefined ? e.v[c.id].toFixed(c.decimals) : ''}</td>)}
                          <td><button className="link" onClick={() => deleteEvent(idx)}>삭제</button></td>
                        </tr>
                      ))
                  : table.slice(Math.max(1, table.length - 200)).map((row, i) => (
                      <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>
                    ))}
              </tbody>
            </table>
          </div>
          {active.mode === 'time' && active.rows.length > 200 && <p className="note">최근 200개만 보여 줍니다. 전체는 CSV로 내보내세요.</p>}
        </section>
      )}
    </main>
  );
}

/** 해석 결과를 읽는 법 (학생용 안내) */
function Interpret({ tools, showFit, showEq, showPlateau, mode, logX, unit }: { tools: string[]; showFit: boolean; showEq: boolean; showPlateau: boolean; mode: string; logX?: boolean; unit: string }) {
  const tips: string[] = [];
  if (showFit) {
    tips.push(logX
      ? '로그 눈금 직선 맞춤: 기울기는 "희석 배수가 10배 늘 때 값이 얼마나 변하는지"입니다. 강산이라면 pH가 약 1씩 오르는지 확인하세요.'
      : mode === 'time'
        ? `직선 맞춤: 기울기는 1초당 변화량(${unit}/s)입니다. 반응 속도나 온도 변화 속도를 비교할 때 씁니다. R²가 1에 가까울수록 직선에 잘 맞습니다.`
        : '직선 맞춤: 기울기는 가로축 값이 1 늘 때 세로축 값의 변화량입니다. R²가 1에 가까울수록 직선에 잘 맞습니다.');
  }
  if (showEq) tips.push('당량점: pH가 가장 급하게 변하는 곳입니다. 이 부피로 시료의 몰 농도를 계산하세요. 약산이라면 반당량점의 pH가 pKa와 같습니다.');
  if (showPlateau) tips.push('평탄 구간: 값이 거의 변하지 않는 가장 긴 구간입니다. 냉각 곡선에서는 이 온도가 어는점입니다. 측정 두 개를 비교해 어는점 내림을 구하세요.');
  if (!tips.length && tools.length) tips.push('그래프를 드래그해 구간을 고르면 그 구간의 평균·변화량을 계산합니다. 위의 도구를 켜서 해석해 보세요.');
  return <ul className="tips">{tips.map((t, i) => <li key={i}>{t}</li>)}</ul>;
}
