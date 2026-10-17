import { useEffect, useState } from 'react';
import type { ResolvedSensor } from '../lib/sensors';
import { fmtValue } from '../lib/sensors';

interface Props {
  sensors: ResolvedSensor[];
  initialId?: string;
  live: (id: string) => number | undefined;
  stable: (id: string) => boolean | null;
  running: boolean;
  lastCal: { id: string; slope: number; offset: number; points: number } | null;
  send: (cmd: string) => void;
  onClear: (id: string) => void;
  onClose: () => void;
}

/** 센서 종류에 맞는 보정 (2점: pH·전도도, 1점: 온도·압력) */
export function CalibrationSheet({ sensors, initialId, live, stable, running, lastCal, send, onClear, onClose }: Props) {
  const calSensors = sensors.filter((s) => s.spec && s.spec.cal.kind !== 'none');
  const [id, setId] = useState(initialId && calSensors.some((s) => s.id === initialId) ? initialId : calSensors[0]?.id ?? '');
  const s = calSensors.find((x) => x.id === id);
  const kind = s?.spec?.cal.kind ?? 'none';
  const refs = s?.spec?.cal.refs ?? [];
  const [ref1, setRef1] = useState(String(refs[0] ?? ''));
  const [ref2, setRef2] = useState(String(refs[1] ?? ''));
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const r = s?.spec?.cal.refs ?? [];
    setRef1(String(r[0] ?? '')); setRef2(String(r[1] ?? '')); setStep(1); setDone(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (lastCal && lastCal.id === id) setDone(true);
  }, [lastCal, id]);

  if (!calSensors.length) {
    return (
      <div className="sheet-backdrop" onClick={onClose}>
        <div className="sheet" role="dialog" aria-modal="true" aria-label="센서 보정" onClick={(e) => e.stopPropagation()}>
          <h2>보정</h2>
          <p>보정이 필요한 센서가 연결되어 있지 않습니다.</p>
          <div className="sheet-actions"><span /><button onClick={onClose}>닫기</button></div>
        </div>
      </div>
    );
  }

  const v = live(id);
  const st = stable(id);
  const unit = s?.displayUnit ?? '';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="센서 보정" onClick={(e) => e.stopPropagation()}>
        <h2>센서 보정</h2>
        <label className="field">
          <span>센서</span>
          <select id="cal-sensor" value={id} onChange={(e) => setId(e.target.value)}>
            {calSensors.map((x) => <option key={x.id} value={x.id}>{x.displayName}{x.cal ? ' (보정됨)' : ''}</option>)}
          </select>
        </label>

        <div className="cal-live">
          <span>지금 값</span>
          <b>{fmtValue(v, s?.decimals)}{unit ? ` ${unit}` : ''}</b>
          {running ? <span className={`stable ${st ? 'on' : ''}`}>{st ? '안정' : '변하는 중'}</span>
            : <span className="note">측정을 시작해야 값이 보입니다</span>}
        </div>

        {kind === 'two-point' && (
          <ol className="cal-steps">
            <li className={step === 1 ? 'on' : 'done'}>
              <p>센서를 증류수로 헹구고 첫 번째 {s?.spec?.cal.hint ?? '기준'}에 담그세요. 값이 '안정'이 되면 기록합니다.</p>
              <div className="row">
                <input id="cal-ref1" inputMode="decimal" value={ref1} onChange={(e) => setRef1(e.target.value)} aria-label="첫 번째 기준값" />
                <button className="primary" disabled={step !== 1 || !running || ref1 === ''} onClick={() => { send(`CAL ${id} 1 ${ref1}`); setStep(2); }}>첫 번째 기록</button>
              </div>
            </li>
            <li className={step === 2 ? 'on' : step > 2 || done ? 'done' : ''}>
              <p>다시 헹군 뒤 두 번째 {s?.spec?.cal.hint ?? '기준'}에 담그세요. 값이 '안정'이 되면 기록합니다.</p>
              <div className="row">
                <input id="cal-ref2" inputMode="decimal" value={ref2} onChange={(e) => setRef2(e.target.value)} aria-label="두 번째 기준값" />
                <button className="primary" disabled={step !== 2 || !running || ref2 === ''} onClick={() => { send(`CAL ${id} 2 ${ref2}`); setStep(3); }}>두 번째 기록</button>
              </div>
            </li>
          </ol>
        )}

        {kind === 'one-point' && (
          <ol className="cal-steps">
            <li className="on">
              <p>센서를 {s?.spec?.cal.hint ?? '기준 상태'}에 두고 값이 '안정'이 되면, 실제 값을 입력해 맞춥니다.</p>
              <div className="row">
                <input id="cal-ref" inputMode="decimal" value={ref1} onChange={(e) => setRef1(e.target.value)} aria-label="기준값" />
                <button className="primary" disabled={!running || ref1 === ''} onClick={() => send(`CAL ${id} OFS ${ref1}`)}>이 값으로 맞추기</button>
              </div>
            </li>
          </ol>
        )}

        {kind === 'scale' && (
          <ol className="cal-steps">
            <li className="on">
              <p>센서를 {s?.spec?.cal.hint ?? '기준 상태'}에 두고 값이 '안정'이 되면, 그때의 실제 값을 입력해 맞춥니다.</p>
              <div className="row">
                <input id="cal-scale" inputMode="decimal" value={ref1} onChange={(e) => setRef1(e.target.value)} aria-label="기준값" />
                <button className="primary" disabled={!running || ref1 === ''} onClick={() => send(`CAL ${id} SCL ${ref1}`)}>이 값으로 맞추기</button>
              </div>
            </li>
          </ol>
        )}

        {kind === 'tare-scale' && (
          <ol className="cal-steps">
            <li className={step === 1 ? 'on' : 'done'}>
              <p>접시를 비우고 값이 '안정'이 되면 영점을 맞춥니다.</p>
              <div className="row">
                <button className="primary" disabled={step !== 1 || !running} onClick={() => { send(`CAL ${id} OFS 0`); setStep(2); }}>영점 맞추기 (0 g)</button>
              </div>
            </li>
            <li className={step === 2 ? 'on' : step > 2 || done ? 'done' : ''}>
              <p>무게를 아는 추를 올리고 값이 '안정'이 되면, 추의 질량을 입력합니다.</p>
              <div className="row">
                <input id="cal-mass" inputMode="decimal" value={ref2} onChange={(e) => setRef2(e.target.value)} aria-label="추의 질량 (g)" />
                <button className="primary" disabled={step !== 2 || !running || ref2 === ''} onClick={() => { send(`CAL ${id} SCL ${ref2}`); setStep(3); }}>이 질량으로 맞추기</button>
              </div>
            </li>
          </ol>
        )}

        {done && lastCal && <p className="ok-text">보정 완료 · 보드에 저장했습니다 (기울기 {lastCal.slope}, 절편 {lastCal.offset}).</p>}

        <div className="sheet-actions">
          <button className="ghost" onClick={() => { onClear(id); setStep(1); setDone(false); }}>보정 지우기</button>
          <button onClick={onClose}>{done ? '완료' : '닫기'}</button>
        </div>
      </div>
    </div>
  );
}
