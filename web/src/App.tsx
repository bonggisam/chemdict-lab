import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Measure } from './components/Measure';
import { SensorSetup } from './components/SensorSetup';
import { CalibrationSheet } from './components/CalibrationSheet';
import { experiments } from './lib/experiments';
import { parseLine, type BoardMsg, type Experiment, type HelloMsg } from './lib/protocol';
import { BleTransport, SerialTransport, SimTransport, hasBluetooth, hasSerial, type Transport } from './lib/transports';
import { analogTypes, resolveSensor } from './lib/sensors';
import { isStable } from './lib/analysis';
import { newRun, type Row, type Run } from './lib/runs';

type Screen = 'connect' | 'pick' | 'measure';
type CalMsg = { id: string; slope: number; offset: number; points: number };

export default function App() {
  const transportRef = useRef<Transport | null>(null);
  const [screen, setScreen] = useState<Screen>('connect');
  const [busy, setBusy] = useState(false);
  const [connLabel, setConnLabel] = useState('');
  const [hello, setHello] = useState<HelloMsg | null>(null);
  const [exp, setExp] = useState<Experiment | null>(null);
  const [running, setRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(1000);
  const [runs, setRunsState] = useState<Run[]>([]);
  const [activeId, setActiveIdState] = useState('');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [cal, setCal] = useState<{ id?: string } | null>(null);
  const [lastCal, setLastCal] = useState<CalMsg | null>(null);
  const [calRows, setCalRows] = useState<Row[]>([]);

  // 메시지 처리기에서 최신 상태를 읽기 위한 ref
  const recordingRef = useRef(false);   // 측정(run)에 기록 중
  const calibratingRef = useRef(false); // 보정 화면용 미리보기 측정 중
  const activeIdRef = useRef('');
  const setActiveId = (id: string) => { activeIdRef.current = id; setActiveIdState(id); };
  const setRuns = useCallback((fn: (r: Run[]) => Run[]) => setRunsState(fn), []);

  const say = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 3500);
  }, []);

  const handleMsg = useCallback((m: BoardMsg) => {
    switch (m.type) {
      case 'hello':
        setHello(m);
        break;
      case 'd': {
        const row = { t: m.t, v: m.v };
        if (recordingRef.current) {
          const id = activeIdRef.current;
          setRunsState((rs) => rs.map((r) => (r.id === id ? { ...r, rows: [...r.rows, row] } : r)));
        } else if (calibratingRef.current) {
          setCalRows((rs) => [...rs.slice(-40), row]);
        }
        break;
      }
      case 'ack':
        if (m.cmd === 'START' && recordingRef.current) setRunning(true);
        if (m.cmd === 'STOP') setRunning(false);
        break;
      case 'cal':
        setLastCal(m);
        say('ok', '보정 완료 · 보드에 저장했습니다.');
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
      recordingRef.current = false;
      calibratingRef.current = false;
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
      setScreen(exp ? 'measure' : 'pick');
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
    recordingRef.current = false;
    calibratingRef.current = false;
    setRunning(false);
    setHello(null);
    setConnLabel('');
    setScreen('connect');
    await t?.disconnect();
  };

  useEffect(() => () => { transportRef.current?.disconnect(); }, []);

  const send = useCallback((cmd: string) => { transportRef.current?.send(cmd); }, []);

  const sensors = useMemo(() => (hello?.sensors ?? []).map(resolveSensor), [hello]);
  const available = (e: Experiment) => e.sensors.includes('*') || e.sensors.every((t) => sensors.some((s) => s.type === t || s.id === t));

  // ---- 센서 설정
  const setPort = (port: string, type: string) => {
    if (type === 'OFF') { send(`PORT ${port} OFF`); return; }
    const spec = analogTypes.find((t) => t.type === type);
    send(`PORT ${port} ${type} ${spec?.slope ?? 1} ${spec?.offset ?? 0}`);
  };
  const clearCal = (id: string) => {
    const s = sensors.find((x) => x.id === id);
    if (s && /^A\d$/.test(s.src)) setPort(s.src, s.type); // 기본 변환식으로 되돌림
    else send(`CAL ${id} CLEAR`);
  };

  // ---- 실험·측정
  const pickExperiment = (e: Experiment) => {
    const mode = e.mode ?? 'time';
    const r = newRun(mode, 0);
    setExp(e);
    setIntervalMs(e.intervalMs);
    setRuns(() => [r]);
    setActiveId(r.id);
    setScreen('measure');
  };

  const start = () => {
    if (!exp) return;
    let id = activeIdRef.current;
    const cur = runs.find((r) => r.id === id);
    // 시간 기록 모드에서 이미 데이터가 있으면 새 측정으로 (이전 측정은 비교용으로 남김)
    if (cur && cur.mode === 'time' && cur.rows.length) {
      const r = newRun('time', runs.length);
      r.prediction = cur.rows.length ? [] : cur.prediction;
      setRuns((rs) => [...rs, r]);
      id = r.id;
      setActiveId(id);
    } else if (cur && cur.mode === 'event') {
      // 값 입력 모드는 같은 측정에 계속 추가 (안정 판정용 자동 기록만 새로)
      setRuns((rs) => rs.map((r) => (r.id === id ? { ...r, rows: [] } : r)));
    }
    calibratingRef.current = false;
    recordingRef.current = true;
    if (transportRef.current?.kind === 'sim') send(exp.mode === 'event' ? `SIMX ${exp.event?.start ?? 0}` : 'SIMX');
    send(`START ${exp.mode === 'event' ? exp.intervalMs : intervalMs}`);
  };
  const stop = () => {
    recordingRef.current = false;
    send('STOP');
  };

  // ---- 보정 화면: 측정 중이 아니면 미리보기 측정을 켬
  const openCal = (id?: string) => {
    setLastCal(null);
    setCal({ id });
    if (!recordingRef.current) {
      calibratingRef.current = true;
      setCalRows([]);
      send('START 500');
    }
  };
  const closeCal = () => {
    setCal(null);
    if (calibratingRef.current) { calibratingRef.current = false; send('STOP'); }
  };
  const calSource: Row[] = recordingRef.current ? (runs.find((r) => r.id === activeId)?.rows ?? []) : calRows;
  const liveValue = (id: string) => {
    for (let i = calSource.length - 1; i >= Math.max(0, calSource.length - 5); i--) if (typeof calSource[i].v[id] === 'number') return calSource[i].v[id];
    return undefined;
  };
  const liveStable = (id: string) => {
    const s = sensors.find((x) => x.id === id);
    const vals = calSource.slice(-6).map((r) => r.v[id]).filter((v): v is number => typeof v === 'number');
    return vals.length ? isStable(vals, s?.spec?.stableBand ?? 0.05) : null;
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

          {hello ? <SensorSetup sensors={sensors} disabled={false} onSetPort={setPort} /> : <p className="note">센서 정보를 불러오는 중…</p>}

          <div className="row-head sub">
            <h2>실험</h2>
            <button className="ghost" disabled={!sensors.some((s) => s.spec && s.spec.cal.kind !== 'none')} onClick={() => openCal()}>센서 보정</button>
          </div>
          <div className="cards">
            {experiments.map((e) => {
              const ok = available(e);
              return (
                <button key={e.id} className="card" disabled={!ok} onClick={() => pickExperiment(e)}>
                  <span className="subject">{e.subject}{e.mode === 'event' ? ' · 값 입력' : ''}</span>
                  <b>{e.title}</b>
                  {e.standards.length > 0 && <span className="codes">{e.standards.map((s) => `[${s}]`).join(' ')}</span>}
                  <span className="need">
                    {e.sensors.includes('*') ? '모든 센서' : e.sensors.map((t) => analogTypes.find((a) => a.type === t)?.name ?? sensors.find((s) => s.type === t)?.displayName ?? t).join(' · ')}
                    {!ok && ' — 위에서 센서를 연결하세요'}
                  </span>
                </button>
              );
            })}
          </div>
        </main>
      )}

      {screen === 'measure' && exp && (
        <Measure
          exp={exp}
          sensors={sensors}
          runs={runs}
          setRuns={setRuns}
          activeId={activeId}
          setActiveId={setActiveId}
          running={running}
          intervalMs={intervalMs}
          setIntervalMs={setIntervalMs}
          onStart={start}
          onStop={stop}
          onBack={() => setScreen('pick')}
          onOpenSetup={() => setSetupOpen(true)}
          onOpenCal={openCal}
          say={say}
          onEventX={(x) => { if (transportRef.current?.kind === 'sim') send(`SIMX ${x}`); }}
          station={hello?.station}
        />
      )}

      {setupOpen && (
        <div className="sheet-backdrop" onClick={() => setSetupOpen(false)}>
          <div className="sheet wide-sheet" onClick={(e) => e.stopPropagation()}>
            <SensorSetup sensors={sensors} disabled={running} onSetPort={setPort} />
            <div className="sheet-actions"><span /><button onClick={() => setSetupOpen(false)}>닫기</button></div>
          </div>
        </div>
      )}

      {cal && (
        <CalibrationSheet
          sensors={sensors}
          initialId={cal.id}
          live={liveValue}
          stable={liveStable}
          running={running || calibratingRef.current}
          lastCal={lastCal}
          send={send}
          onClear={clearCal}
          onClose={closeCal}
        />
      )}

      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}
