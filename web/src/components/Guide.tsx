import { useEffect, useMemo, useState } from 'react';
import type { Experiment } from '../lib/protocol';
import type { ResolvedSensor } from '../lib/sensors';
import { boardByName, boards, commonRules, loadBoardId, partById, partsFor, planned, saveBoardId, type Part } from '../lib/guide';
import { PartWiring } from './PartWiring';
import { SensorPicker } from './SensorPicker';

interface Props {
  experiments: Experiment[];
  initialExpId?: string;
  initialPartId?: string;        // 바로 측정에서 온 경우 그 센서 연결을 바로 보여 줌
  boardName?: string;            // 연결된 보드가 hello로 알려 준 이름
  sensors: ResolvedSensor[];
  connected: boolean;
  onRescan: () => void;
  onBack: () => void;
  backLabel: string;
}

const FW_LABEL = { verified: '실제 확인', compiled: '펌웨어 지원', none: '펌웨어 준비 중' } as const;
const SET_LABEL = { full: '모든 센서', lite: '가벼운 버전', mini: '가장 가벼운 버전', none: '' } as const;

/** 보드 → 센서(또는 실험) → 연결 그림·주의 */
export function Guide({ experiments, initialExpId, initialPartId, boardName, sensors, connected, onRescan, onBack, backLabel }: Props) {
  const detected = boardByName(boardName);
  const [boardId, setBoardId] = useState(() => detected?.id ?? loadBoardId());
  useEffect(() => { if (detected) setBoardId(detected.id); }, [detected?.id]);
  const board = boards.find((b) => b.id === boardId) ?? boards[0];
  const pickBoard = (id: string) => { setBoardId(id); saveBoardId(id); };

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
    <main className="wide guide">
      <div className="row-head">
        <h1>연결 안내</h1>
        <button className="ghost" onClick={onBack}>← {backLabel}</button>
      </div>

      <section className="guide-block">
        <h2>1. 보드 고르기</h2>
        <div className="board-pick" role="radiogroup" aria-label="보드 종류">
          {boards.map((b) => (
            <button key={b.id} role="radio" aria-checked={b.id === board.id} className={b.id === board.id ? 'on' : ''} onClick={() => pickBoard(b.id)}>
              <b>{b.name}</b>
              <span className={`fw ${b.firmware}`}>{FW_LABEL[b.firmware]}</span>
            </button>
          ))}
        </div>
        {detected && <p className="note ok-note">연결된 보드: {detected.name} (자동 선택)</p>}
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
      </section>

      <section className="guide-block">
        <h2>2. 연결 전 공통 규칙</h2>
        <ul className="rules">{commonRules.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>

      <section className="guide-block">
        <div className="row-head sub">
          <h2>3. 센서 고르기</h2>
          <div className="seg" role="tablist" aria-label="찾는 방법">
            <button role="tab" aria-selected={by === 'sensor'} className={by === 'sensor' ? 'on' : ''} onClick={() => setBy('sensor')}>센서로 찾기</button>
            <button role="tab" aria-selected={by === 'exp'} className={by === 'exp' ? 'on' : ''} onClick={() => setBy('exp')}>실험으로 찾기</button>
          </div>
        </div>
        {by === 'sensor' ? (
          <SensorPicker board={board} connectedTypes={connectedTypes} onPick={(p) => setPartId(p.id)} />
        ) : (
          <>
            <select value={exp?.id} onChange={(e) => { setExpId(e.target.value); setExpPart(undefined); }} aria-label="실험">
              {experiments.map((e) => <option key={e.id} value={e.id}>{e.title}{e.setup ? '' : ' (부착 안내 준비 중)'}</option>)}
            </select>
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
            <h2>{4 + i}. {p.name} 연결</h2>
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
          <h2>{4 + shown.length}. 실험 장치에 붙이기</h2>
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
    </main>
  );
}
