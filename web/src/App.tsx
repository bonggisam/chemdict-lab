import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Measure } from './components/Measure';
import { SensorSetup } from './components/SensorSetup';
import { CalibrationSheet } from './components/CalibrationSheet';
import { Guide } from './components/Guide';
import { SensorPicker } from './components/SensorPicker';
import { ExperimentBrowser } from './components/ExperimentBrowser';
import { QuickSheet, type QuickStatus } from './components/QuickSheet';
import { boardByName, boards, loadBoardId, quickExperiment, saveBoardId, type Part } from './lib/guide';
import { BoardStep, type FwState } from './components/BoardStep';
import { loadInfo, saveInfo, type ExpInfo } from './lib/info';
import { LANGS, initialLang, loadLang, t, tk, type Lang } from './lib/i18n';
import { relocalize } from './lib/l10n';
import { PwaBar } from './components/PwaBar';
import { BUNDLED_FW, FlashError, TARGETS, boardFromUsb, flashBoard, older } from './lib/flash';
import { experiments } from './lib/experiments';
import { parseLine, type BoardMsg, type Experiment, type HelloMsg } from './lib/protocol';
import { BleTransport, SerialTransport, SimTransport, hasBluetooth, hasSerial, type Transport } from './lib/transports';
import { analogTypes, resolveSensor } from './lib/sensors';
import { isStable } from './lib/analysis';
import { newRun, type Row, type Run } from './lib/runs';

type Screen = 'connect' | 'pick' | 'measure' | 'guide';
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
  const [quick, setQuick] = useState<{ part: Part; status: QuickStatus } | null>(null);
  const quickTimer = useRef<number | null>(null);
  const autoStartRef = useRef(false);
  const [guideFrom, setGuideFrom] = useState<{ screen: Screen; expId?: string; tab?: 'wire' | 'help' }>({ screen: 'connect' });
  const openGuide = (expId?: string, tab?: 'wire' | 'help') => { setGuideFrom({ screen: screen === 'guide' ? 'connect' : screen, expId, tab }); setScreen('guide'); };
  const [boardId, setBoardId] = useState(loadBoardId);
  const pickBoard = (id: string) => { setBoardId(id); saveBoardId(id); };
  const [fw, setFw] = useState<FwState | null>(null);
  const [info, setInfoState] = useState<ExpInfo>(loadInfo);
  // 언어: 처음에는 저장된 언어(없으면 브라우저 언어)로
  const [lang, setLangState] = useState<Lang>('ko');
  const changeLang = async (l: Lang) => { await loadLang(l); relocalize(); setLangState(l); };
  useEffect(() => { const l = initialLang(); if (l !== 'ko') changeLang(l); else loadLang('ko'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setInfo = (i: ExpInfo) => { setInfoState(i); saveInfo(i); };
  const fwTimers = useRef<number[]>([]);
  const clearFwTimers = () => { fwTimers.current.forEach(clearTimeout); fwTimers.current = []; };
  const rescan = () => { transportRef.current?.send('HELLO'); say('ok', t('센서를 다시 찾았습니다.')); };

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

  const helloRef = useRef<((m: HelloMsg) => void) | null>(null);
  const handleMsg = useCallback((m: BoardMsg) => {
    switch (m.type) {
      case 'hello':
        setHello(m);
        helloRef.current?.(m);
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
        say('ok', t('보정 완료 · 보드에 저장했습니다.'));
        transportRef.current?.send('HELLO');
        break;
      case 'err':
        say('err', t('보드 응답: {cmd} — {msg}', { cmd: m.cmd, msg: m.msg }));
        break;
    }
  }, [say]);

  const connect = async (kind: 'serial' | 'ble' | 'sim', reuse?: SerialPort) => {
    const tr: Transport = kind === 'serial' ? new SerialTransport(reuse) : kind === 'ble' ? new BleTransport() : new SimTransport();
    tr.onLine = (line) => { const m = parseLine(line); if (m) handleMsg(m); };
    tr.onClose = () => {
      if (transportRef.current !== tr) return;
      transportRef.current = null;
      recordingRef.current = false;
      calibratingRef.current = false;
      setRunning(false);
      setHello(null);
      setConnLabel('');
      // 연결 안내를 보는 중이면 화면을 유지 (센서를 꽂으려고 USB를 뽑는 경우)
      clearFwTimers();
      setFw((f) => (f?.status === 'installing' || f?.status === 'failed' ? f : null));
      setScreen((sc) => (sc === 'guide' ? sc : 'connect'));
      setGuideFrom((g) => ({ ...g, screen: 'connect' }));
      say('err', t('연결이 끊어졌습니다. 케이블이나 블루투스를 확인하고 다시 연결하세요.'));
    };
    setBusy(true);
    try {
      await tr.connect();
      transportRef.current = tr;
      setConnLabel(tr.label);
      clearFwTimers();
      if (tr instanceof SerialTransport) {
        // 측정 프로그램이 있으면 hello가 옴 (보드가 다시 시작하느라 1~2초 걸릴 수 있음)
        const usbBoard = boardFromUsb(tr.usb);
        if (usbBoard && usbBoard !== 'clone') pickBoard(usbBoard);
        setFw({ status: 'checking' });
        setScreen('connect');
        helloRef.current = (m) => {
          helloRef.current = null;
          clearFwTimers();
          const id = boardByName(m.board)?.id;
          if (m.fw !== 'sim' && older(m.fw, BUNDLED_FW) && id && TARGETS[id]) { setFw({ status: 'outdated', version: m.fw }); return; }
          setFw(null);
          setScreen((sc) => (sc === 'connect' ? (exp ? 'measure' : 'pick') : sc));
        };
        await tr.send('HELLO');
        fwTimers.current.push(window.setTimeout(() => tr.send('HELLO'), 2500));
        fwTimers.current.push(window.setTimeout(() => {
          if (transportRef.current !== tr || !helloRef.current) return;
          helloRef.current = null;
          setFw({ status: 'missing', usbBoard });
        }, 4500));
      } else {
        await tr.send('HELLO');
        setScreen(exp ? 'measure' : 'pick');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/cancel|No port selected|User cancelled/i.test(msg)) { /* 사용자가 선택 창을 닫음 */ }
      else if (/open|busy|in use|NetworkError|InvalidState/i.test(msg)) say('err', t('다른 프로그램이 보드를 쓰고 있습니다. Arduino IDE의 시리얼 모니터를 닫고 다시 연결하세요.'));
      else say('err', t('연결하지 못했습니다: {msg}', { msg }));
    } finally {
      setBusy(false);
    }
  };

  // ---- 측정 프로그램 설치: 포트를 넘겨받아 굽고, 같은 포트로 다시 연결
  const install = async (targetId: string) => {
    const tr = transportRef.current;
    const target = TARGETS[targetId];
    if (!(tr instanceof SerialTransport) || !target) return;
    clearFwTimers();
    helloRef.current = null;
    transportRef.current = null;
    setHello(null);
    setConnLabel('');
    const port = await tr.release();
    if (!port) return;
    setFw({ status: 'installing', stage: 'reset', ratio: 0 });
    try {
      await flashBoard(port, target, (stage, ratio) => setFw({ status: 'installing', stage, ratio }));
      pickBoard(targetId);
      setFw({ status: 'done' });
      await new Promise((r) => setTimeout(r, 600));
      await connect('serial', port);
    } catch (e) {
      const kind = e instanceof FlashError ? e.kind : 'other';
      const message = kind === 'nosync' ? t('보드가 설치 모드로 들어가지 않았습니다. 보드 종류가 맞는지 확인하세요.')
        : kind === 'verify' ? t('쓴 내용이 맞지 않습니다. 다시 시도하세요.')
        : kind === 'busy' ? t('다른 프로그램이 보드를 쓰고 있습니다. Arduino IDE를 닫고 다시 시도하세요.')
        : t('오류: {msg}', { msg: e instanceof Error ? e.message : String(e) });
      setFw({ status: 'failed', message });
    }
  };

  const disconnect = async () => {
    clearFwTimers();
    helloRef.current = null;
    setFw(null);
    const tr = transportRef.current;
    transportRef.current = null;
    recordingRef.current = false;
    calibratingRef.current = false;
    setRunning(false);
    setHello(null);
    setConnLabel('');
    setScreen('connect');
    await tr?.disconnect();
  };

  useEffect(() => () => { transportRef.current?.disconnect(); }, []);

  // Esc로 열린 창 닫기
  const escRef = useRef<() => void>(() => {});
  escRef.current = () => { if (quick) setQuick(null); else if (cal) closeCal(); else if (setupOpen) setSetupOpen(false); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') escRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- 브라우저 뒤로가기 = 앱 안의 이전 화면 (페이지를 나가지 않게)
  // 화면이 바뀔 때마다 기록을 남기고, 뒤로가기를 누르면 그 화면으로 돌아감.
  // 열린 창(센서 연결·저장 등)이 있으면 먼저 닫고, 측정 중이면 화면을 바꾸지 않음.
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const runningRef = useRef(running);
  runningRef.current = running;
  const fromPop = useRef(false);
  useEffect(() => {
    try { history.replaceState({ cd: screenRef.current }, ''); } catch { /* noop */ }
    const stay = () => { try { history.pushState({ cd: screenRef.current }, ''); } catch { /* noop */ } };
    const onPop = (e: PopStateEvent) => {
      const sheet = document.querySelector<HTMLElement>('.sheet-backdrop');
      if (sheet) { sheet.click(); stay(); return; }
      if (runningRef.current) { stay(); say('err', t('측정 중입니다. 먼저 [정지]를 누르세요.')); return; }
      const target = (e.state as { cd?: Screen } | null)?.cd;
      if (!target) return;
      fromPop.current = true;
      setScreen(target);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [say]);
  useEffect(() => {
    if (fromPop.current) { fromPop.current = false; return; }
    if ((history.state as { cd?: Screen } | null)?.cd === screen) return;
    try { history.pushState({ cd: screen }, ''); } catch { /* noop */ }
  }, [screen]);
  // 측정 화면 기록인데 실험이 없으면 실험 고르기로
  useEffect(() => { if (screen === 'measure' && !exp) setScreen('pick'); }, [screen, exp]);

  const send = useCallback((cmd: string) => { transportRef.current?.send(cmd); }, []);

  const sensors = useMemo(() => (hello?.sensors ?? []).map(resolveSensor), [hello]);
  const detectedBoard = boardByName(hello?.board);
  const board = detectedBoard ?? boards.find((b) => b.id === boardId) ?? boards[0];

  // ---- 센서 설정
  const setPort = (port: string, type: string) => {
    if (type === 'OFF') { send(`PORT ${port} OFF`); return; }
    const spec = analogTypes.find((t) => t.type === type);
    send(`PORT ${port} ${type} ${spec?.slope ?? 1} ${spec?.offset ?? 0}`);
  };
  const clearCal = (id: string) => {
    const s = sensors.find((x) => x.id === id);
    if (s && /^(A\d|D3)$/.test(s.src)) setPort(s.src, s.type); // 기본 변환식으로 되돌림
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

  // ---- 바로 측정: 센서 카드 → 연결 → [측정 시작] 한 번
  const quickFound = (p: Part) => {
    if (p.analogType) return sensors.some((s) => s.type === p.analogType);
    const sim = transportRef.current?.kind === 'sim';
    return p.provides.every((t) => sensors.some((s) => s.type === t && (sim || s.src !== 'demo')));
  };
  const quickStart = (port?: string) => {
    if (!quick) return;
    const p = quick.part;
    setQuick({ part: p, status: 'finding' });
    if (p.analogType && port) setPort(port, p.analogType); // 보드가 설정 후 센서 목록(hello)을 다시 보냄
    else send('HELLO');                                      // 보드가 센서를 다시 찾음
    if (quickTimer.current) clearTimeout(quickTimer.current);
    quickTimer.current = window.setTimeout(() => setQuick((q) => (q && q.status === 'finding' ? { ...q, status: 'notfound' } : q)), 8000);
  };
  useEffect(() => {
    if (!quick || quick.status !== 'finding' || !quickFound(quick.part)) return;
    if (quickTimer.current) clearTimeout(quickTimer.current);
    const e = quickExperiment(quick.part);
    setQuick(null);
    autoStartRef.current = true;
    pickExperiment(e);
    const spec = quick.part.analogType ? analogTypes.find((t) => t.type === quick.part.analogType) : undefined;
    if (spec?.requiresCal) say('ok', t('측정을 시작합니다. 정확한 값은 [보정] 후에 나옵니다.'));
  }, [hello]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (autoStartRef.current && exp && screen === 'measure') { autoStartRef.current = false; start(); }
  }, [exp, screen]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // 측정 시작 시각 (처음 시작할 때만 기록, 저장 파일에 남김)
    const now = new Date().toISOString();
    setRuns((rs) => rs.map((r) => (r.id === id && !r.startedAt ? { ...r, startedAt: now } : r)));
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

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <img className="logo" src={`${import.meta.env.BASE_URL}logo-128.png`} alt="" width={32} height={32} />
          <span>ChemDict Lab</span>
        </div>
        <nav className="top-nav stepper" aria-label={t('단계')}>
          {([
            ['connect', '1', tk('보드 연결')],
            ['pick', '2', tk('실험')],
            ['guide', '3', tk('연결 방법·문제 해결')],
          ] as const).map(([sc, n, label]) => {
            const on = sc === 'pick' ? screen === 'pick' || screen === 'measure' : screen === sc;
            const done = sc === 'connect' && !!hello && !on;
            return (
              <button key={sc} className={`${on ? 'on' : ''} ${done ? 'done' : ''}`} aria-current={on ? 'step' : undefined}
                onClick={() => {
                  if (on) return;
                  if (sc === 'guide') openGuide(screen === 'measure' ? exp?.id : undefined);
                  else if (sc === 'pick') setScreen(exp && screen !== 'pick' ? 'measure' : 'pick');
                  else setScreen('connect');
                }}>
                <span className="n">{done ? '✓' : n}</span><span className="t">{t(label)}</span>
              </button>
            );
          })}
        </nav>
        {connLabel && (
          <div className="conn">
            <span className="dot" aria-hidden="true" />
            <span>{connLabel}{hello?.station ? ` · ${t('모둠 {n}', { n: hello.station })}` : ''}</span>
            <button className="ghost" onClick={disconnect}>{t('연결 끊기')}</button>
          </div>
        )}
        <label className="lang-pick">
          <span aria-hidden="true">🌐</span>
          <select aria-label="Language" value={lang} onChange={(e) => changeLang(e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </label>
      </header>
      <Fragment key={lang}>
      <PwaBar running={running} />

      {screen === 'connect' && (
        <BoardStep
          board={board}
          detectedId={detectedBoard?.id}
          onPickBoard={pickBoard}
          connected={!!connLabel}
          busy={busy || fw?.status === 'installing'}
          fw={fw}
          onConnect={(k) => connect(k)}
          onInstall={install}
          onNext={() => { setFw(null); setScreen(exp ? 'measure' : 'pick'); }}
        />
      )}

      {screen === 'pick' && (
        <main className="wide">
          <div className="row-head">
            <h1><span className="step-no">2</span>{t('무엇을 잴까요?')}</h1>
            {hello && hello.fw !== 'sim' && (
              <label className="switch">
                <input type="checkbox" checked={hello.demo} onChange={(e) => send(`DEMO ${e.target.checked ? 'ON' : 'OFF'}`)} />
                <span>{t('데모 데이터')}</span>
              </label>
            )}
          </div>
          {!connLabel && <p className="note warn">{t('보드가 연결되지 않았습니다.')} <button className="link" onClick={() => setScreen('connect')}>{t('1단계: 보드 연결로 가기')}</button></p>}
          <p className="lede">{t('센서를 누르면 연결 그림이 나옵니다. 그대로 꽂고 [측정 시작]을 누르면 바로 기록됩니다.')}</p>
          <p className="note board-line">
            {t('보드:')} <b>{board.name}</b>{detectedBoard ? ` (${t('자동 인식')})` : ''}
            {sensors.filter((s) => !/^(A\d|D3)$/.test(s.src) && s.src !== 'demo').length > 0 &&
              <> · {t('인식된 센서:')} {sensors.filter((s) => !/^(A\d|D3)$/.test(s.src) && s.src !== 'demo').map((s) => s.displayName).join(', ')}</>}
          </p>

          <SensorPicker board={board} connectedTypes={sensors.filter((s) => s.src !== 'demo').map((s) => s.type)} onPick={(p) => setQuick({ part: p, status: 'idle' })} />

          <div className="row-head sub">
            <h2>{t('실험으로 찾기 (교육과정)')}</h2>
            <button className="ghost" disabled={!sensors.some((s) => s.spec && s.spec.cal.kind !== 'none')} onClick={() => openCal()}>{t('센서 보정')}</button>
          </div>
          <ExperimentBrowser experiments={experiments} connectedTypes={sensors.filter((x) => x.src !== 'demo' || transportRef.current?.kind === 'sim').map((x) => x.type)} onPick={pickExperiment} />

          {hello && (
            <details className="advanced">
              <summary>{t('포트 직접 설정 (고급)')}</summary>
              <SensorSetup sensors={sensors} disabled={false} onSetPort={setPort} onRescan={rescan} pulse={board.sensorSet === 'full'} />
            </details>
          )}
        </main>
      )}

      {quick && (
        <QuickSheet
          board={board}
          boardDetected={!!detectedBoard}
          part={quick.part}
          sensors={sensors}
          connected={!!hello}
          status={quick.status}
          onStart={quickStart}
          onHelp={() => { setQuick(null); openGuide(undefined, 'help'); }}
          onClose={() => { if (quickTimer.current) clearTimeout(quickTimer.current); setQuick(null); }}
        />
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
          onOpenGuide={() => openGuide(exp.id)}
          say={say}
          onEventX={(x) => { if (transportRef.current?.kind === 'sim') send(`SIMX ${x}`); }}
          station={hello?.station}
          info={info}
          setInfo={setInfo}
        />
      )}

      {screen === 'guide' && (
        <Guide
          experiments={experiments}
          initialExpId={guideFrom.expId?.startsWith('quick-') ? undefined : guideFrom.expId}
          initialPartId={guideFrom.expId?.startsWith('quick-') ? guideFrom.expId.slice(6) : undefined}
          initialTab={guideFrom.tab}
          board={board}
          sensors={sensors}
          connected={!!hello}
          onRescan={rescan}
          onChangeBoard={() => setScreen('connect')}
          onBack={guideFrom.screen === 'measure' ? () => setScreen('measure') : undefined}
          backLabel={t('측정으로')}
        />
      )}

      {setupOpen && (
        <div className="sheet-backdrop" onClick={() => setSetupOpen(false)}>
          <div className="sheet wide-sheet" role="dialog" aria-modal="true" aria-label={t('센서 연결')} onClick={(e) => e.stopPropagation()}>
            <SensorSetup sensors={sensors} disabled={running} onSetPort={setPort} onRescan={rescan} pulse={board.sensorSet === 'full'} />
            <div className="sheet-actions"><span /><button onClick={() => setSetupOpen(false)}>{t('닫기')}</button></div>
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

      </Fragment>
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}
