import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ico } from './components/Ico';
import { ICON } from './lib/icons';
import { Measure, type Trigger } from './components/Measure';
import { RecentSessions } from './components/RecentSessions';
import { ShareSheet } from './components/ShareSheet';
import { SupplySheet } from './components/SupplySheet';
import { hasData, newSessionId, saveSession, sessionBlob, type Session } from './lib/session';
import { shareUrl, takeShareFromUrl } from './lib/share';
import type { CustomCalc } from './lib/formula';
import { SensorSetup } from './components/SensorSetup';
import { CalibrationSheet } from './components/CalibrationSheet';
import { SensorCheckSheet } from './components/SensorCheckSheet';
import { Guide } from './components/Guide';
import { SensorPicker } from './components/SensorPicker';
import { ExperimentBrowser } from './components/ExperimentBrowser';
import { QuickSheet, type QuickStatus } from './components/QuickSheet';
import { boardByName, boards, loadBoardId, partById, quickExperiment, saveBoardId, type Part } from './lib/guide';
import { BoardStep, type FwState } from './components/BoardStep';
import { loadInfo, saveInfo, type ExpInfo } from './lib/info';
import { LANGS, initialLang, loadLang, t, type Lang } from './lib/i18n';
import { relocalize } from './lib/l10n';
import { PwaBar } from './components/PwaBar';
import { DiagnosticsSheet } from './components/DiagnosticsSheet';
import { useExplore } from './lib/prefs';
import { ExperimentMaker } from './components/ExperimentMaker';
import { customId, loadCustom, saveCustom, toExperiment, valid, type CustomExp } from './lib/custom';
import { SideNav } from './components/SideNav';
import { R } from './components/Rich';
import { BUNDLED_FW, FlashError, TARGETS, boardFromUsb, flashBoard, older } from './lib/flash';
import { experiments } from './lib/experiments';
import { parseLine, type BoardMsg, type Experiment, type HelloMsg, type SensorInfo } from './lib/protocol';
import { BleTransport, SerialTransport, SimTransport, hasBluetooth, hasSerial, type Transport } from './lib/transports';
import { analogTypes, applyAppConv, boardVref, resolveSensor } from './lib/sensors';
import { ABSORB, COLOR, DeviceTransport, canUseDevice, deviceTypes, kitInterval, kitPart, type DeviceKit } from './lib/device';
import { DeviceCamera, DeviceSection, DeviceSheet } from './components/DevicePanel';
import { isStable } from './lib/analysis';
import { newRun, saveFile, type Row, type Run } from './lib/runs';
import { expName, track } from './lib/analytics';
import { VisitCounter } from './components/VisitCounter';

type Screen = 'connect' | 'pick' | 'measure' | 'guide';
type CalMsg = { id: string; slope: number; offset: number; points: number };

export default function App() {
  const transportRef = useRef<Transport | null>(null);
  // 2.0: 이 기기 센서 (하나를 계속 씀 — 카메라 미리보기를 연결 전에도 보여 주려고)
  const deviceRef = useRef<DeviceTransport | null>(null);
  const dev = () => (deviceRef.current ??= new DeviceTransport());
  const [devKit, setDevKit] = useState<DeviceKit | null>(null);
  const [explore, setExplore] = useExplore();   // 2.0: 쉬운 화면 / 탐구 화면
  // 2.0: 선생님이 만든 실험 (이 기기에 저장, 링크·QR로 나눔)
  const [mine, setMine] = useState<CustomExp[]>(loadCustom);
  const [maker, setMaker] = useState<{ x?: CustomExp } | null>(null);
  const [shareCustom, setShareCustom] = useState<{ url: string; title: string } | null>(null);
  const keepMine = (x: CustomExp) => setMine((list) => { const n = [...list.filter((y) => customId(y) !== customId(x)), x]; saveCustom(n); return n; });
  const dropMine = (x: CustomExp) => setMine((list) => { const n = list.filter((y) => customId(y) !== customId(x)); saveCustom(n); return n; });
  const isDevice = () => transportRef.current?.kind === 'device';
  const [screen, setScreen] = useState<Screen>('connect');
  const [busy, setBusy] = useState(false);
  const [connLabel, setConnLabel] = useState('');
  const [hello, setHello] = useState<HelloMsg | null>(null);
  const [exp, setExp] = useState<Experiment | null>(null);
  const [running, setRunning] = useState(false);
  const [intervalMs, setIntervalMs] = useState(1000);
  const intervalRef = useRef(1000);
  intervalRef.current = intervalMs;
  const [runs, setRunsState] = useState<Run[]>([]);
  const [activeId, setActiveIdState] = useState('');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [cal, setCal] = useState<{ id?: string } | null>(null);
  const [check, setCheck] = useState<{ id?: string } | null>(null);   // 센서 점검(오차·테스트) 화면
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
  // 자동 저장·측정 파일·공유·조건 시작·준비물
  const sessionIdRef = useRef(newSessionId());
  const [savedSensors, setSavedSensors] = useState<SensorInfo[]>([]);
  const [custom, setCustom] = useState<CustomCalc | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [supplyOpen, setSupplyOpen] = useState(false);
  const [sharedTitle, setSharedTitle] = useState('');
  const [waiting, setWaiting] = useState<{ value?: number } | null>(null);
  const triggerRef = useRef<Trigger | null>(null);
  const tOffsetRef = useRef(0);
  // 2.0 안정성: 다시 연결한 뒤 시간 이어 붙이기 · 연결 진단 값
  const shiftRef = useRef(0);
  const gapRef = useRef<number | null>(null);
  const lostAtRef = useRef<number | null>(null);
  const resyncRef = useRef(false);        // 다시 연결 뒤 보드가 START를 받기 전의 줄(옛 시계)은 버림
  const reconnectingRef = useRef(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  // 2.0: 측정 시간 정하기 — 시간이 되면 정지하고 (다른 창을 보고 있으면) 알림
  const [autoStopMin, setAutoStopMinState] = useState(0);
  const autoStopTimer = useRef<number | null>(null);
  const setAutoStopMin = (m: number) => {
    setAutoStopMinState(m);
    if (m > 0 && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  };
  const notify = (title: string, body: string) => {
    try { if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body, icon: 'logo-256.png' }); } catch { /* noop */ }
  };
  const statsRef = useRef({ points: 0, last: 0, drops: 0, reconnects: 0, since: Date.now() });
  // 언어: 처음에는 저장된 언어(없으면 브라우저 언어)로
  const [lang, setLangState] = useState<Lang>('ko');
  const changeLang = async (l: Lang) => { track('lang', l); await loadLang(l); relocalize(); setLangState(l); };
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
  const lastHelloRef = useRef<HelloMsg | null>(null);   // 앱 변환 센서(저항 등)에 쓸 센서 목록·보드
  const handleMsg = useCallback((m: BoardMsg) => {
    switch (m.type) {
      case 'hello':
        track('board', /^[\x20-\x7E]+$/.test(m.board ?? '') ? m.board : (transportRef.current?.kind ?? 'other')); // 시뮬레이터·이 기기는 한글 이름 → 연결 종류로
        lastHelloRef.current = m;
        setHello(m);
        helloRef.current?.(m);
        break;
      case 'd': {
        const h = lastHelloRef.current;
        const dv = applyAppConv(m.v, h?.sensors, boardVref(boardByName(h?.board)?.logic));
        let row = { t: m.t, v: dv };
        const trig = triggerRef.current;
        if (recordingRef.current && trig) {
          const v = dv[trig.id];
          const met = typeof v === 'number' && (trig.dir === 'up' ? v >= trig.value : v <= trig.value);
          if (!met) { setWaiting({ value: typeof v === 'number' ? v : undefined }); break; }
          triggerRef.current = null;
          tOffsetRef.current = m.t;
          setWaiting(null);
          say('ok', t('조건이 맞아 기록을 시작했습니다.'));
        }
        if (tOffsetRef.current) row = { t: Number((m.t - tOffsetRef.current).toFixed(3)), v: dv };
        if (recordingRef.current && resyncRef.current) break;
        if (recordingRef.current) {
          const id = activeIdRef.current;
          statsRef.current.points += 1; statsRef.current.last = Date.now();
          setRunsState((rs) => rs.map((r) => {
            if (r.id !== id) return r;
            // 다시 연결한 뒤 첫 점: 보드 시간이 0부터 다시 시작하므로 끊긴 시간만큼 이어 붙임
            if (gapRef.current !== null) {
              shiftRef.current = (r.rows[r.rows.length - 1]?.t ?? 0) + gapRef.current - row.t;
              gapRef.current = null;
            }
            const rr = shiftRef.current ? { t: Number((row.t + shiftRef.current).toFixed(3)), v: row.v } : row;
            return { ...r, rows: [...r.rows, rr] };
          }));
        } else if (calibratingRef.current) {
          setCalRows((rs) => [...rs.slice(-40), row]);
        }
        break;
      }
      case 'ack':
        if (m.cmd === 'START') resyncRef.current = false;
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

  const connect = async (kind: 'serial' | 'ble' | 'sim' | 'device', reuse?: SerialPort) => {
    track('app', `connect-${kind}`);
    const tr: Transport = kind === 'serial' ? new SerialTransport(reuse) : kind === 'ble' ? new BleTransport() : kind === 'device' ? dev() : new SimTransport();
    tr.onLine = (line) => { const m = parseLine(line); if (m) handleMsg(m); };
    tr.onLost = () => {
      lostAtRef.current = Date.now();
      statsRef.current.drops += 1;
      reconnectingRef.current = true;
      setReconnecting(true);
      say('err', t('블루투스 연결이 끊어졌습니다. 다시 연결하는 중… (최대 3번)'));
    };
    tr.onReconnected = () => {
      reconnectingRef.current = false;
      setReconnecting(false);
      statsRef.current.reconnects += 1;
      const gap = lostAtRef.current ? (Date.now() - lostAtRef.current) / 1000 : 0;
      lostAtRef.current = null;
      if (recordingRef.current) {
        const id = activeIdRef.current;
        setRunsState((rs) => rs.map((r) => (r.id === id ? { ...r, markers: [...r.markers, { t: r.rows[r.rows.length - 1]?.t ?? 0, note: t('연결 끊김 {n}초', { n: gap.toFixed(0) }) }] } : r)));
        gapRef.current = gap;
        resyncRef.current = true;
        tr.send(`START ${intervalRef.current}`);
      } else {
        tr.send('STOP');   // 끊긴 동안 [정지]를 눌렀거나 정한 시간이 됨: 보드도 멈춤
      }
      tr.send('HELLO');
      say('ok', t('다시 연결했습니다. 측정을 이어 갑니다.'));
    };
    tr.onClose = () => {
      reconnectingRef.current = false;
      resyncRef.current = false;
      setReconnecting(false);
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
      if (runningRef.current) notify(t('측정 중 연결이 끊어졌습니다'), t('지금까지 기록은 ‘이어서 하기’에 저장했습니다. 보드 전원과 케이블을 확인하세요.'));
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
  escRef.current = () => { if (maker) setMaker(null); else if (shareCustom) setShareCustom(null); else if (devKit) closeDevKit(); else if (quick) setQuick(null); else if (check) closeCheck(); else if (cal) closeCal(); else if (setupOpen) setSetupOpen(false); };
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

  const detectedBoard = boardByName(hello?.board);
  const board = detectedBoard ?? boards.find((b) => b.id === boardId) ?? boards[0];
  const sensors = useMemo(() => (hello?.sensors ?? (exp ? savedSensors : [])).map(resolveSensor), [hello, exp, savedSensors]);
  const allExperiments = useMemo(() => [...experiments, ...mine.map(toExperiment)], [mine, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 자동 저장: 측정 데이터가 바뀌면 3초 안에 이 기기에 저장 (최근 5개)
  const saveTimer = useRef<number | null>(null);
  const currentSession = (): Session | null => (exp ? {
    app: 'chemdict-lab', v: 1, id: sessionIdRef.current, savedAt: new Date().toISOString(),
    exp, runs, intervalMs, sensors: hello?.sensors ?? savedSensors, info, custom,
  } : null);
  const sessionRef = useRef(currentSession);
  sessionRef.current = currentSession;
  useEffect(() => {
    if (!exp || !hasData(runs) || saveTimer.current) return;
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      const s = sessionRef.current();
      if (s) saveSession(s);
    }, running ? 1000 : 3000);   // 측정 중에는 1초마다 저장
  }, [runs, exp, custom]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const flush = () => { const s = sessionRef.current(); if (s) saveSession(s); };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const openSession = (s: Session) => {
    if (running) { say('err', t('측정 중입니다. 먼저 [정지]를 누르세요.')); return; }
    sessionIdRef.current = s.id;
    setSavedSensors(s.sensors);
    setExp(s.exp);
    setIntervalMs(s.intervalMs);
    setRuns(() => s.runs.length ? s.runs : [newRun(s.exp.mode ?? 'time', 0)]);
    setActiveId((s.runs[s.runs.length - 1] ?? { id: '' }).id);
    setCustom(s.custom ?? null);
    if (s.info) setInfoState(s.info);
    setScreen('measure');
    say('ok', t('‘{title}’ 측정을 열었습니다.', { title: s.exp.title }));
  };
  const saveSessionFile = () => {
    const s = currentSession();
    if (!s) return;
    const z = (n: number) => String(n).padStart(2, '0'), d = new Date();
    saveFile(sessionBlob(s), `chemdict_${s.exp.id}_${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.chemdict`);
  };

  // ---- 공유 링크로 열기: 실험을 미리 골라 두고, 보드를 연결하면 바로 측정 화면으로
  useEffect(() => {
    const sp = takeShareFromUrl();
    if (!sp) return;
    if (sp.x && valid(sp.x)) keepMine(sp.x);   // 선생님이 만든 실험을 이 기기에도 저장
    const e = sp.x && valid(sp.x) ? toExperiment(sp.x)
      : sp.e.startsWith('quick-') ? (() => { const pt = partById(sp.e.slice(6)); return pt ? quickExperiment(pt) : undefined; })() : experiments.find((x) => x.id === sp.e);
    if (!e) { say('err', t('공유받은 실험을 찾지 못했습니다. 앱을 새로고침해 보세요.')); return; }
    if (sp.b && boards.some((b) => b.id === sp.b)) pickBoard(sp.b);
    pickExperiment(e);
    if (sp.i) setIntervalMs(sp.i);
    if (sp.c) setCustom(sp.c);
    setScreen('connect');
    setSharedTitle(e.title);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const mineOf = (id?: string) => mine.find((x) => customId(x) === id);
  const shareLink = exp ? shareUrl({ e: exp.id, i: intervalMs, b: board.id, ...(custom?.expr ? { c: custom } : {}), ...(mineOf(exp.id) ? { x: mineOf(exp.id) } : {}) }) : '';

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
    track('exp', expName(e.id));
    const mode = e.mode ?? 'time';
    const r = newRun(mode, 0);
    sessionIdRef.current = newSessionId();
    setSavedSensors([]);
    setCustom(null);
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

  const start = (trigger?: Trigger) => {
    if (!exp) return;
    track('app', 'measure-start');
    for (const ty of exp.sensors) track('sensor', ty);
    triggerRef.current = trigger ?? null;
    tOffsetRef.current = 0;
    setWaiting(trigger ? {} : null);
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
    shiftRef.current = 0; gapRef.current = null;
    statsRef.current = { points: 0, last: 0, drops: 0, reconnects: 0, since: Date.now() };
    if (transportRef.current) transportRef.current.autoReconnect = true;
    if (autoStopTimer.current) clearTimeout(autoStopTimer.current);
    if (autoStopMin > 0 && (exp.mode ?? 'time') === 'time') autoStopTimer.current = window.setTimeout(() => {
      if (!recordingRef.current) return;
      stopRef.current();
      say('ok', t('정한 시간이 되어 측정을 멈췄습니다.'));
      notify(t('측정을 마쳤습니다'), t('정한 시간이 되어 측정을 멈췄습니다. 앱을 열어 그래프를 확인하세요.'));
    }, autoStopMin * 60000);
    if (transportRef.current?.kind === 'sim') send(exp.mode === 'event' ? `SIMX ${exp.event?.start ?? 0}` : 'SIMX');
    syncWanted();
    send(`START ${exp.mode === 'event' ? exp.intervalMs : intervalMs}`);
  };
  const stopRef = useRef<() => void>(() => {});
  const stop = () => {
    if (autoStopTimer.current) { clearTimeout(autoStopTimer.current); autoStopTimer.current = null; }
    recordingRef.current = false;
    if (transportRef.current) transportRef.current.autoReconnect = false;
    triggerRef.current = null;
    setWaiting(null);
    if (reconnectingRef.current) { setRunning(false); return; }   // 보드에 닿지 않음: 다시 연결되면 STOP을 보냄
    send('STOP');
  };
  stopRef.current = stop;

  // ---- 이 기기 센서: 지금 실험이 쓰는 장치만 켬 (마이크·카메라 권한을 필요할 때만)
  function syncWanted() {
    if (!isDevice()) return;
    const ts = (exp?.sensors ?? []).filter((s) => s !== '*');
    dev().wanted = new Set(ts.some((s) => deviceTypes().includes(s)) ? ts : []);
  }
  /** 기기 센서로 바꿔 연결 (다른 보드는 끊음) */
  const useDevice = async () => {
    if (isDevice()) return;
    const board = transportRef.current && transportRef.current.kind !== 'sim';
    if (transportRef.current) await disconnect();
    await connect('device');
    if (board) say('ok', t('보드 연결을 끊고 이 기기 센서로 잽니다. 보드는 ‘1 보드 연결’에서 다시 연결할 수 있습니다.'));
  };
  const startDevice = async (k: DeviceKit) => {
    setDevKit(null);
    if (running) stop();
    await useDevice();
    autoStartRef.current = true;
    pickExperiment({ ...quickExperiment(kitPart(k)), intervalMs: kitInterval(k) });
  };
  const closeDevKit = () => {
    setDevKit(null);
    if (!(isDevice() && screen === 'measure')) dev().stopCamera();
  };
  /** 실험 카드: 보드에 센서가 없고 이 기기로 되는 실험이면 '이 기기'로 바꿔 연결 */
  const pickAny = async (e: Experiment) => {
    const have = sensors.filter((x) => x.src !== 'demo' || transportRef.current?.kind === 'sim').map((x) => x.type);
    const ready = e.sensors.includes('*') || e.sensors.every((ty) => have.includes(ty));
    if (!ready && canUseDevice(e.sensors)) await useDevice();
    pickExperiment(e);
  };

  // ---- 보정 화면: 측정 중이 아니면 미리보기 측정을 켬
  const openCal = (id?: string) => {
    track('tool', 'calibration');
    setLastCal(null);
    setCal({ id });
    if (!recordingRef.current) {
      calibratingRef.current = true;
      setCalRows([]);
      syncWanted();
      send('START 500');
    }
  };
  const closeCal = () => {
    setCal(null);
    if (calibratingRef.current && !check) { calibratingRef.current = false; send('STOP'); }
  };
  // ---- 센서 점검 화면: 보정과 같은 미리보기 측정을 씀
  const openCheck = (id?: string) => {
    track('tool', 'sensor-check');
    setCheck({ id });
    if (!recordingRef.current && !calibratingRef.current) {
      calibratingRef.current = true;
      setCalRows([]);
      syncWanted();
      send('START 500');
    }
  };
  const closeCheck = () => {
    setCheck(null);
    if (calibratingRef.current && !cal) { calibratingRef.current = false; send('STOP'); }
  };
  const calSource: Row[] = recordingRef.current ? (runs.find((r) => r.id === activeId)?.rows ?? []) : calRows;
  const recentValues10 = (id: string) => calSource.slice(-12).map((r) => r.v[id]).filter((v): v is number => typeof v === 'number');
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
    <div className="app layout">
      <SideNav
        screen={screen}
        expTitle={exp?.title}
        connected={!!hello}
        boardName={hello?.fw === 'device' ? t('이 기기') : board.name}
        running={running}
        onGo={(sc) => {
          if (running) { say('err', t('측정 중입니다. 먼저 [정지]를 누르세요.')); return; }
          if (sc === 'guide') openGuide(screen === 'measure' ? exp?.id : undefined);
          else if (sc === 'measure') setScreen(exp ? 'measure' : 'pick');
          else setScreen(sc);
        }}
        footer={<>
          {connLabel ? (
            <div className="conn">
              <span className="dot" aria-hidden="true" />
              <span className="conn-t">{reconnecting ? t('다시 연결하는 중…') : connLabel}{hello?.station ? ` · ${t('모둠 {n}', { n: hello.station })}` : ''}</span>
              <button className="ghost" aria-label={t('연결 진단')} title={t('연결 진단')} onClick={() => setDiagOpen(true)}>🩺</button>
              <button className="ghost" onClick={disconnect}>{t('연결 끊기')}</button>
            </div>
          ) : <p className="note conn-off">○ {t('보드가 연결되지 않았습니다.')}</p>}
          <label className="lang-pick">
            <span aria-hidden="true">🌐</span>
            <select aria-label="Language" value={lang} onChange={(e) => changeLang(e.target.value as Lang)}>
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </label>
          <a className="about-link" href="about.html" target="_blank" rel="noopener">ℹ️ {t('앱 정보 · 사용법 · 만든 사람')}</a>
          <VisitCounter />
        </>}
      />
      <div id="content" className="content">
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
          deviceSlot={<div className="connect-device"><DeviceSection compact onOpen={setDevKit} /></div>}
        />
      )}
      {screen === 'connect' && sharedTitle && (
        <p className="shared-bar" role="status">🔗 {t('공유받은 실험: ‘{title}’ — 보드를 연결하면 바로 측정 화면이 열립니다.', { title: sharedTitle })}</p>
      )}
      {screen === 'connect' && <div className="wide connect-recent"><RecentSessions compact onOpen={openSession} say={say} /></div>}

      {screen === 'pick' && (
        <main className="wide">
          <div className="row-head">
            <h1><span className="step-no">2</span>{t('무엇을 잴까요?')}</h1>
            <div className="mode-switch" role="radiogroup" aria-label={t('화면')}>
              <button role="radio" aria-checked={!explore} className={!explore ? 'on' : ''} onClick={() => setExplore(false)}>{t('쉬운 화면')}</button>
              <button role="radio" aria-checked={explore} className={explore ? 'on' : ''} onClick={() => setExplore(true)} title={t('탐구 화면은 조건 시작·예측 그리기·그래프 보기 같은 도구를 더 보여 줍니다')}>{t('탐구 화면')}</button>
            </div>
            {hello && hello.fw !== 'sim' && hello.fw !== 'device' && (
              <label className="switch">
                <input type="checkbox" checked={hello.demo} onChange={(e) => send(`DEMO ${e.target.checked ? 'ON' : 'OFF'}`)} />
                <span>{t('데모 데이터')}</span>
              </label>
            )}
          </div>
          {!connLabel && <p className="note warn">{t('보드가 연결되지 않았습니다.')} <button className="link" onClick={() => setScreen('connect')}>{t('1단계: 보드 연결로 가기')}</button></p>}
          <p className="lede"><R t={t('센서를 누르면 연결 그림이 나옵니다. 그대로 꽂고 [측정 시작]을 누르면 바로 기록됩니다.')} /></p>
          <p className="note board-line">
            {t('보드:')} <b>{board.name}</b>{detectedBoard ? ` (${t('자동 인식')})` : ''}
            {sensors.filter((s) => !/^(A\d|D3)$/.test(s.src) && s.src !== 'demo').length > 0 &&
              <> · {t('인식된 센서:')} {sensors.filter((s) => !/^(A\d|D3)$/.test(s.src) && s.src !== 'demo').map((s) => s.displayName).join(', ')}</>}
          </p>

          <RecentSessions onOpen={openSession} say={say} />

          <DeviceSection onOpen={setDevKit} activeId={isDevice() ? exp?.id : undefined} collapsed={!!connLabel && !isDevice()} />

          <div data-nav={t('센서로 바로 측정')}><SensorPicker board={board} connectedTypes={sensors.filter((s) => s.src !== 'demo').map((s) => s.type)} onPick={(p) => { track('parts', `card-${p.id}`); setQuick({ part: p, status: 'idle' }); }} /></div>

          <div className="row-head sub">
            <h2><Ico e={ICON.experiment} />{t('실험으로 찾기 (교육과정)')}</h2>
            <button className="ghost" onClick={() => { track('tool', 'experiment-maker'); setMaker({}); }}>✏️ {t('실험 만들기')}</button>
            <button className="ghost" onClick={() => { track('tool', 'supply-list'); setSupplyOpen(true); }}><Ico e={ICON.supply} />{t('준비물 목록')}</button>
            <button className="ghost" disabled={!sensors.some((s) => s.spec && s.spec.cal.kind !== 'none')} onClick={() => openCal()}><Ico e={ICON.cal} />{t('센서 보정')}</button>
            <button className="ghost" disabled={!hello || !sensors.length} onClick={() => openCheck()}><Ico e={ICON.test} />{t('센서 점검')}</button>
          </div>
          {mine.length > 0 && (
            <div className="chip-row mine" aria-label={t('내가 만든 실험')}>
              <b>{t('내가 만든 실험')}</b>
              {mine.map((x) => (
                <span key={customId(x)} className="mine-chip">
                  <button onClick={() => pickAny(toExperiment(x))}>{x.t}</button>
                  <button aria-label={t('{name} 고치기', { name: x.t })} onClick={() => setMaker({ x })}>✏️</button>
                  <button aria-label={t('{name} 링크·QR', { name: x.t })} onClick={() => setShareCustom({ url: shareUrl({ e: customId(x), i: x.iv, x }), title: x.t })}>🔗</button>
                  <button aria-label={t('{name} 지우기', { name: x.t })} onClick={() => dropMine(x)}>×</button>
                </span>
              ))}
            </div>
          )}
          <ExperimentBrowser experiments={allExperiments} connectedTypes={[...sensors.filter((x) => x.src !== 'demo' || transportRef.current?.kind === 'sim').map((x) => x.type), ...deviceTypes()]} onPick={pickAny} />

          {hello && explore && (
            <details className="advanced" data-nav={t('포트 직접 설정 (고급)')}>
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

      {devKit && <DeviceSheet kit={devKit} dev={dev()} onStart={() => startDevice(devKit)} onClose={closeDevKit} say={say} />}

      {screen === 'measure' && exp && isDevice() && exp.sensors.some((s) => COLOR.includes(s)) && (
        <div className="wide device-measure-cam">
          <DeviceCamera dev={dev()} absorbance={exp.sensors.some((s) => ABSORB.includes(s))} running={running} say={say} />
        </div>
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
          autoStopMin={autoStopMin}
          setAutoStopMin={setAutoStopMin}
          onStart={start}
          onStop={stop}
          connected={!!hello}
          waiting={waiting}
          custom={custom}
          setCustom={setCustom}
          onShare={() => { track('tool', 'qr-share'); setShareOpen(true); }}
          onSaveFile={saveSessionFile}
          onBack={() => setScreen('pick')}
          onOpenSetup={() => setSetupOpen(true)}
          onOpenCal={openCal}
          onOpenCheck={openCheck}
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

      {diagOpen && <DiagnosticsSheet connLabel={connLabel} hello={hello} stats={() => statsRef.current} running={running} reconnecting={reconnecting} intervalMs={intervalMs} onClose={() => setDiagOpen(false)} />}
      {maker && (
        <ExperimentMaker
          initial={maker.x}
          onSave={(x) => { if (maker.x && customId(maker.x) !== customId(x)) dropMine(maker.x); keepMine(x); setMaker(null); say('ok', t('‘{title}’ 실험을 저장했습니다. 실험 목록의 ‘내가 만든 실험’에 있습니다.', { title: x.t })); }}
          onShare={(x) => { if (maker.x && customId(maker.x) !== customId(x)) dropMine(maker.x); keepMine(x); setMaker(null); setShareCustom({ url: shareUrl({ e: customId(x), i: x.iv, x }), title: x.t }); }}
          onClose={() => setMaker(null)}
        />
      )}
      {shareCustom && <ShareSheet url={shareCustom.url} title={shareCustom.title} say={say} onClose={() => setShareCustom(null)} />}
      {shareOpen && exp && <ShareSheet url={shareLink} title={exp.title} say={say} onClose={() => setShareOpen(false)} />}
      {supplyOpen && <SupplySheet board={board} experiments={allExperiments} initialExp={exp ?? undefined} say={say} onClose={() => setSupplyOpen(false)} />}

      {check && (
        <SensorCheckSheet
          sensors={sensors}
          initialId={check.id}
          recent={recentValues10}
          running={running || calibratingRef.current}
          onOpenCal={(id) => openCal(id)}
          onClose={closeCheck}
        />
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

      {screen !== 'measure' && (
        <footer className="site-foot note">
          <p>{t('© 2026 ChemDict 화학사전 · 학교·개인 비상업 사용 무료 · 무단 판매·재배포 금지')}</p>
          <p>{t('Arduino는 Arduino SA의 상표이며, 이 앱은 Arduino 공식 제품이 아닙니다.')}</p>
          <p><a href="about.html">{t('앱 정보 · 사용법 · 만든 사람')}</a> · <a href="mailto:bbongssem@naver.com">bbongssem@naver.com</a> · <a href="https://www.youtube.com/@chemdict">YouTube @chemdict</a> · <a href="https://www.instagram.com/chemdict_official">Instagram @chemdict_official</a> · <a href="https://www.instagram.com/chemdict_off">@chemdict_off</a> · <a href="https://apps.apple.com/app/id6826865197">App Store</a> · <a href="privacy.html">{t('개인정보 처리방침')}</a></p>
        </footer>
      )}
      </Fragment>
      </div>
      {toast && <div className={`toast ${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}
