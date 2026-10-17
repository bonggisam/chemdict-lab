import { useMemo, useState } from 'react';
import type { Experiment } from '../lib/protocol';
import type { ResolvedSensor } from '../lib/sensors';
import { commonRules, partById, partsFor, planned, troubles, type Board, type Part } from '../lib/guide';
import { PartWiring } from './PartWiring';
import { SensorPicker } from './SensorPicker';
import { ExperimentBrowser } from './ExperimentBrowser';

const SET_LABEL = { full: '모든 센서', lite: '가벼운 버전', mini: '가장 가벼운 버전', none: '' } as const;

interface Props {
  experiments: Experiment[];
  board: Board;
  initialExpId?: string;
  initialPartId?: string;        // 바로 측정에서 온 경우 그 센서 연결을 바로 보여 줌
  initialTab?: 'wire' | 'help';
  sensors: ResolvedSensor[];
  connected: boolean;
  onRescan: () => void;
  onChangeBoard: () => void;
  onBack?: () => void;
  backLabel?: string;
}

/** 3단계: 센서 연결 방법 + 문제 해결 */
export function Guide({ experiments, board, initialExpId, initialPartId, initialTab, sensors, connected, onRescan, onChangeBoard, onBack, backLabel }: Props) {
  const [tab, setTab] = useState<'wire' | 'help'>(initialTab ?? 'wire');
  const [by, setBy] = useState<'sensor' | 'exp'>(initialExpId && !initialPartId ? 'exp' : 'sensor');
  const [partId, setPartId] = useState<string | undefined>(initialPartId);
  const [expId, setExpId] = useState(initialExpId ?? experiments.find((e) => e.setup)?.id ?? experiments[0]?.id);
  const exp = experiments.find((e) => e.id === expId) ?? experiments[0];
  const setup = exp?.setup;
  const expParts = useMemo(() => (exp ? partsFor(exp.sensors.filter((s) => s !== '*'), setup?.parts) : []), [exp, setup]);
  const [expPart, setExpPart] = useState<string | undefined>();
  const chosenExpPart = setup?.choose ? (expParts.find((p) => p.id === expPart) ?? expParts[0]) : undefined;

  const shown: Part[] = by === 'sensor'
    ? [partById(partId ?? '')].filter((p): p is Part => !!p)
    : chosenExpPart ? [chosenExpPart] : expParts;

  const connectedTypes = sensors.filter((s) => s.src !== 'demo').map((s) => s.type);

  return (
    <main className="wide guide step-page">
      <div className="row-head">
        <h1><span className="step-no">3</span>연결 방법 · 문제 해결</h1>
        {onBack && <button className="ghost" onClick={onBack}>← {backLabel}</button>}
      </div>
      <div className="seg big-seg" role="tablist" aria-label="도움말">
        <button role="tab" aria-selected={tab === 'wire'} className={tab === 'wire' ? 'on' : ''} onClick={() => setTab('wire')}>센서 연결 방법</button>
        <button role="tab" aria-selected={tab === 'help'} className={tab === 'help' ? 'on' : ''} onClick={() => setTab('help')}>문제 해결</button>
      </div>

      {tab === 'help' && (
        <section className="guide-block troubles">
          <p className="note">증상을 누르면 차례로 해 볼 일이 나옵니다.</p>
          {troubles.map((t) => (
            <details key={t.id} className="trouble">
              <summary>{t.title}</summary>
              <ol>{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            </details>
          ))}
        </section>
      )}

      {tab === 'wire' && <>
      <section className="guide-block">
        <div className="row-head sub">
          <h2>보드: {board.name}</h2>
          <button className="ghost" onClick={onChangeBoard}>보드 바꾸기 (1단계)</button>
        </div>
        <details className="advanced">
          <summary>보드 정보</summary>
          <dl className="board-facts">
            <div><dt>USB</dt><dd>{board.usb}</dd></div>
            <div><dt>블루투스</dt><dd>{board.ble ? '있음' : '없음 (USB만)'}</dd></div>
            <div><dt>핀 전압</dt><dd>{board.logic}</dd></div>
            <div><dt>아날로그</dt><dd>{board.adc}</dd></div>
            <div><dt>Qwiic</dt><dd>{board.qwiic}</dd></div>
            <div><dt>I2C 핀</dt><dd>{board.pins.SDA} · {board.pins.SCL}</dd></div>
          </dl>
          <p className={`note ${board.firmware === 'verified' ? '' : 'warn'}`}>
            {board.firmwareNote}{board.sensorSet !== 'none' && board.sensorSet !== 'full' ? ` (${SET_LABEL[board.sensorSet]})` : ''}
          </p>
          {board.notes.length > 0 && <ul className="board-notes">{board.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
        </details>
      </section>

      <section className="guide-block">
        <h2>연결 전 공통 규칙</h2>
        <ul className="rules">{commonRules.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>

      <section className="guide-block">
        <div className="row-head sub">
          <h2>센서 고르기</h2>
          <div className="seg" role="tablist" aria-label="찾는 방법">
            <button role="tab" aria-selected={by === 'sensor'} className={by === 'sensor' ? 'on' : ''} onClick={() => setBy('sensor')}>센서로 찾기</button>
            <button role="tab" aria-selected={by === 'exp'} className={by === 'exp' ? 'on' : ''} onClick={() => setBy('exp')}>실험으로 찾기</button>
          </div>
        </div>
        {by === 'sensor' ? (
          <SensorPicker board={board} connectedTypes={connectedTypes} onPick={(p) => setPartId(p.id)} />
        ) : (
          <>
            <ExperimentBrowser experiments={experiments.filter((e) => !e.sensors.includes('*'))} selectedId={exp?.id} onPick={(e) => { setExpId(e.id); setExpPart(undefined); setTimeout(() => document.getElementById('exp-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }} />
            {exp && (
              <div className="exp-detail" id="exp-detail">
                <h3>{exp.title}</h3>
                <p className="note">{[exp.level, exp.course, exp.area].filter(Boolean).join(' · ')}</p>
                {exp.standards.map((s, i) => <p key={s} className="std"><b>[{s}]</b> {exp.standardTexts?.[i] ?? ''}</p>)}
                {exp.textbooks?.length ? (
                  <ul className="pubs">{exp.textbooks.map((t, i) => <li key={i}><b>{t.publisher}</b> {t.course} — {t.note}{t.sure !== 'confirmed' ? ` (${t.sure === 'mentioned' ? '자료 언급' : '비슷한 활동'})` : ''}</li>)}</ul>
                ) : null}
              </div>
            )}
            {setup?.choose && (
              <div className="part-pick" role="radiogroup" aria-label="센서 종류">
                <span className="note">가진 센서를 고르세요</span>
                {expParts.map((p) => (
                  <button key={p.id} role="radio" aria-checked={p.id === chosenExpPart?.id} className={p.id === chosenExpPart?.id ? 'on' : ''} onClick={() => setExpPart(p.id)}>{p.name}</button>
                ))}
              </div>
            )}
          </>
        )}
        {by === 'sensor' && !partId && <p className="note">위에서 센서를 누르면 아래에 연결 방법이 나옵니다.</p>}
        <p className="note">준비 중: {planned.join(', ')}</p>
      </section>

      {shown.map((p, i) => {
        const found = p.analogType ? null : p.provides.every((t) => connectedTypes.includes(t));
        return (
          <section key={p.id} className="guide-block" id={`part-${p.id}`}>
            <h2>{p.name} 연결</h2>
            <PartWiring board={board} part={p} />
            {found !== null && (
              <div className="detect">
                {connected
                  ? (found ? <span className="ok-note">✓ 인식됨</span> : <span className="warn-text">아직 인식되지 않았습니다.</span>)
                  : <span className="note">보드를 연결하면 인식 여부가 여기에 표시됩니다.</span>}
                {connected && <button onClick={onRescan}>센서 다시 찾기</button>}
              </div>
            )}
            {p.analogType && <p className="note">아날로그 센서는 '실험' 화면에서 이 센서를 누르면 포트가 자동으로 설정됩니다.</p>}
          </section>
        );
      })}

      {by === 'exp' && setup && (
        <section className="guide-block">
          <h2>실험 장치에 붙이기</h2>
          {setup.materials.length > 0 && <><h3>준비물</h3><ul>{setup.materials.map((m) => <li key={m}>{m}</li>)}</ul></>}
          <ol>{setup.attach.map((s) => <li key={s}>{s}</li>)}</ol>
          {setup.cautions.length > 0 && (
            <div className="caution">
              <h3>실험할 때 주의</h3>
              <ul>{setup.cautions.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}
        </section>
      )}
      </>}
    </main>
  );
}
