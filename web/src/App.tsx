import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chart } from './components/Chart';
import { experiments } from './lib/experiments';
import { parseLine, type BoardMsg, type Experiment, type HelloMsg, type SensorInfo } from './lib/protocol';
import { BleTransport, SerialTransport, SimTransport, hasBluetooth, hasSerial, type Transport } from './lib/transports';
import { saveCSV, toCSV, type Marker, type Row } from './lib/csv';

type Screen = 'connect' | 'pick' | 'measure';

export default function App() {
  const transportRef = useRef<Transport | null>(null);
  const [screen, setScreen] = useState<Screen>('connect');
  const [busy, setBusy] = useState(false);
  const [connLabel, setConnLabel] = useState('');
  const [hello, setHello] = useState<HelloMsg | null>(null);
  const [exp, setExp] = useState<Experiment | null>(null);
  const [running, setRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(1000);
  const [rows, setRows] = useState<Row[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [markerNote, setMarkerNote] = useState('');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calStep, setCalStep] = useState(0);
  const [clearArmed, setClearArmed] = useState(false);
  const runningRef = useRef(false);

  const say = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 3500);
  }, []);

  const handleMsg = useCallback((m: BoardMsg) => {
    switch (m.type) {
      case 'hello':
        setHello(m);
        break;
      case 'd':
        if (runningRef.current) setRows((r) => [...r, { t: m.t, v: m.v }]);
        break;
      case 'ack':
        if (m.cmd === 'START') { runningRef.current = true; setRunning(true); }
        if (m.cmd === 'STOP') { runningRef.current = false; setRunning(false); }
        break;
      case 'cal':
        say('ok', `${m.id} 보정 완료 · 기울기 ${m.slope}, 절편 ${m.offset}`);
        setCalStep(3);
        transportRef.current?.send('HELLO');
        break;
      case 'err':
        say('err', `보드 응답: ${m.cmd} — ${m.msg}`);
        break;
    }
  }, [say]);

  const connect = async (kind: 'serial' | 'ble' | 'sim') => {
    const t: Transport = kind === 'serial' ? new SerialTransport() : kind === 'ble' ? new BleTransport() : new SimTransport();
    t.onLine = (line) => { const m = parseLine(line); if (m) handleMsg(m); };
    t.onClose = () => {
      if (transportRef.current !== t) return;
      transportRef.current = null;
      runningRef.current = false;
      setRunning(false);
      setHello(null);
      setConnLabel('');
      setScreen('connect');
      say('err', '연결이 끊어졌습니다. 케이블이나 블루투스를 확인하고 다시 연결하세요.');
    };
    setBusy(true);
    try {
      await t.connect();
      transportRef.current = t;
      setConnLabel(t.label);
      await t.send('HELLO');
      setScreen('pick');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel|No port selected|User cancelled/i.test(msg)) say('err', `연결하지 못했습니다: ${msg}`);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    const t = transportRef.current;
    transportRef.current = null;
    runningRef.current = false;
    setRunning(false);
    setHello(null);
    setConnLabel('');
    setScreen('connect');
    await t?.disconnect();
  };

  useEffect(() => () => { transportRef.current?.disconnect(); }, []);

  const send = (cmd: string) => transportRef.current?.send(cmd);

  const sensorMap = useMemo(() => {
    const m: Record<string, SensorInfo> = {};
    hello?.sensors.forEach((s) => (m[s.id] = s));
    return m;
  }, [hello]);

  const available = (e: Experiment) => e.sensors.includes('*') || e.sensors.every((id) => sensorMap[id]);

  const chartSpecs = useMemo(() => {
    if (!exp) return [];
    if (exp.y.length) {
      return exp.y.map((y) => ({ sensor: y.sensor, label: y.label, unit: y.unit ?? sensorMap[y.sensor]?.unit, min: y.min, max: y.max }));
    }
    return (hello?.sensors ?? []).map((s) => ({ sensor: s.id, label: s.name, unit: s.unit, min: undefined, max: undefined }));
  }, [exp, hello, sensorMap]);

  const exportIds = chartSpecs.map((c) => c.sensor);

  const pickExperiment = (e: Experiment) => {
    setExp(e);
    setIntervalMs(e.intervalMs);
    setRows([]);
    setMarkers([]);
    setScreen('measure');
  };

  const start = () => {
    if (rows.length) setRows([]);
    setMarkers([]);
    send(`START ${intervalMs}`);
  };
  const stop = () => send('STOP');

  const addMarker = () => {
    if (!exp) return;
    const t = rows.length ? rows[rows.length - 1].t : 0;
    const note = markerNote.trim() || exp.markers.label;
    setMarkers((m) => [...m, { t, note }]);
    setMarkerNote('');
  };

  const exportCSV = async () => {
    if (!exp || !rows.length) return;
    const names: Record<string, string> = {};
    chartSpecs.forEach((c) => (names[c.sensor] = c.unit ? `${c.label}(${c.unit})` : c.label));
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    const station = hello?.station ? `_st${hello.station}` : '';
    await saveCSV(toCSV(rows, exportIds, names, markers), `chemdict_${exp.id}${station}_${stamp}.csv`);
  };

  const clearData = () => {
    if (!clearArmed && rows.length) { setClearArmed(true); window.setTimeout(() => setClearArmed(false), 3000); return; }
    setRows([]); setMarkers([]); setClearArmed(false);
  };

  const calRecord = (n: 1 | 2, ref: string) => {
    send(`CAL pH ${n} ${ref}`);
    if (n === 1) setCalStep(2);
  };

  const unsupported = !hasSerial() && !hasBluetooth();

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true">⚗</span>
          <span>ChemDict Lab</span>
        </div>
        {connLabel && (
          <div className="conn">
            <span className="dot" aria-hidden="true" />
            <span>{connLabel}{hello?.station ? ` · 모둠 ${hello.station}` : ''}</span>
            <button className="ghost" onClick={disconnect}>연결 끊기</button>
          </div>
        )}
      </header>

      {screen === 'connect' && (
        <main className="center">
          <h1>보드를 연결하세요</h1>
          <p className="lede">USB 케이블로 꽂거나 블루투스로 찾으면, 연결된 센서를 자동으로 불러옵니다.</p>
          <div className="connect-grid">
            <button className="big" disabled={!hasSerial() || busy} onClick={() => connect('serial')}>
              <b>USB로 연결</b>
              <span>{hasSerial() ? '맥·윈도우·크롬북' : '이 브라우저에서는 사용할 수 없음'}</span>
            </button>
            <button className="big" disabled={!hasBluetooth() || busy} onClick={() => connect('ble')}>
              <b>블루투스로 연결</b>
              <span>{hasBluetooth() ? 'ChemDict-01 ~ 08' : '이 브라우저에서는 사용할 수 없음'}</span>
            </button>
            <button className="big alt" disabled={busy} onClick={() => connect('sim')}>
              <b>보드 없이 체험</b>
              <span>시뮬레이터 데이터</span>
            </button>
          </div>
          {unsupported && (
            <p className="note warn">
              사파리는 USB·블루투스 연결을 지원하지 않습니다. 맥·윈도우에서는 크롬이나 엣지로 열고, 아이패드·아이폰에서는 ChemDict Lab 앱을 쓰세요.
            </p>
          )}
        </main>
      )}

      {screen === 'pick' && (
        <main className="wide">
          <div className="row-head">
            <h1>실험 고르기</h1>
            {hello && hello.fw !== 'sim' && (
              <label className="switch">
                <input type="checkbox" checked={hello.demo} onChange={(e) => send(`DEMO ${e.target.checked ? 'ON' : 'OFF'}`)} />
                <span>데모 데이터</span>
              </label>
            )}
          </div>
          <p className="lede">
            인식된 센서:{' '}
            {hello ? hello.sensors.map((s) => <span key={s.id} className="chip">{s.name}{s.cal ? ' ✓보정' : ''}</span>) : '불러오는 중…'}
          </p>
          <div className="cards">
            {experiments.map((e) => {
              const ok = available(e);
              return (
                <button key={e.id} className="card" disabled={!ok} onClick={() => pickExperiment(e)}>
                  <span className="subject">{e.subject}</span>
                  <b>{e.title}</b>
                  {e.standards.length > 0 && <span className="codes">{e.standards.map((s) => `[${s}]`).join(' ')}</span>}
                  <span className="need">
                    {e.sensors.includes('*') ? '모든 센서' : e.sensors.map((id) => sensorMap[id]?.name ?? id).join(' · ')}
                    {!ok && ' — 센서 없음'}
                  </span>
                </button>
              );
            })}
          </div>
        </main>
      )}

      {screen === 'measure' && exp && (
        <main className="wide">
          <div className="row-head">
            <div>
              <button className="ghost back" disabled={running} onClick={() => setScreen('pick')}>← 실험 목록</button>
              <h1>{exp.title}</h1>
            </div>
            <div className="controls">
              <label className="interval">
                간격
                <select value={intervalMs} disabled={running} onChange={(e) => setIntervalMs(Number(e.target.value))}>
                  {[200, 500, 1000, 2000, 5000].map((ms) => <option key={ms} value={ms}>{ms / 1000}초</option>)}
                </select>
              </label>
              {!running
                ? <button className="primary" onClick={start}>측정 시작</button>
                : <button className="danger" onClick={stop}>정지</button>}
            </div>
          </div>

          <details className="steps">
            <summary>실험 순서 보기</summary>
            <ol>{exp.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          </details>

          <div className="charts">
            {chartSpecs.map((c) => (
              <Chart key={c.sensor} rows={rows} sensor={c.sensor} label={c.label} unit={c.unit} min={c.min} max={c.max} markers={markers} />
            ))}
          </div>

          <div className="toolbar">
            {exp.markers.enabled && (
              <div className="marker">
                <input
                  id="marker-note"
                  value={markerNote}
                  placeholder={exp.markers.prompt}
                  onChange={(e) => setMarkerNote(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addMarker(); }}
                />
                <button onClick={addMarker} disabled={!running && !rows.length}>{exp.markers.label}</button>
              </div>
            )}
            <div className="actions">
              {sensorMap['pH'] && <button className="ghost" disabled={running} onClick={() => { setCalOpen(true); setCalStep(1); }}>pH 보정</button>}
              <button className="ghost" onClick={clearData} disabled={running || !rows.length}>{clearArmed ? '한 번 더 누르면 지워집니다' : '데이터 지우기'}</button>
              <button className="primary" onClick={exportCSV} disabled={!rows.length}>CSV 내보내기</button>
            </div>
          </div>

          {markers.length > 0 && (
            <ul className="marker-list">
              {markers.map((m, i) => <li key={i}><span>{m.t.toFixed(1)} s</span>{m.note}</li>)}
            </ul>
          )}
          <p className="note">측정 {rows.length}개 · 표시 {markers.length}개</p>
        </main>
      )}

      {calOpen && (
        <div className="sheet-backdrop" onClick={() => setCalOpen(false)}>
          <div className="sheet" role="dialog" aria-label="pH 보정" onClick={(e) => e.stopPropagation()}>
            <h2>pH 2점 보정</h2>
            <ol className="cal-steps">
              <li className={calStep === 1 ? 'on' : calStep > 1 ? 'done' : ''}>
                <p>센서를 증류수로 헹구고 <b>pH 7 완충 용액</b>에 담그세요. 값이 멈추면 누르세요.</p>
                <button className="primary" disabled={calStep !== 1} onClick={() => calRecord(1, '7.00')}>pH 7.00 기록</button>
              </li>
              <li className={calStep === 2 ? 'on' : calStep > 2 ? 'done' : ''}>
                <p>다시 헹군 뒤 <b>pH 4 완충 용액</b>에 담그세요. 값이 멈추면 누르세요.</p>
                <button className="primary" disabled={calStep !== 2} onClick={() => calRecord(2, '4.00')}>pH 4.00 기록</button>
              </li>
              <li className={calStep === 3 ? 'on done' : ''}>
                <p>보정값이 보드에 저장됩니다. 다음부터는 다시 하지 않아도 됩니다.</p>
              </li>
            </ol>
            <div className="sheet-actions">
              <button className="ghost" onClick={() => { send('CAL pH CLEAR'); setCalStep(1); }}>보정 초기화</button>
              <button onClick={() => setCalOpen(false)}>{calStep === 3 ? '완료' : '닫기'}</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}
