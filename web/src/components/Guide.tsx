import { useEffect, useMemo, useState } from 'react';
import type { Experiment } from '../lib/protocol';
import type { ResolvedSensor } from '../lib/sensors';
import { boardByName, boards, commonRules, loadBoardId, partsFor, saveBoardId } from '../lib/guide';
import { WiringDiagram } from './WiringDiagram';

interface Props {
  experiments: Experiment[];
  initialExpId?: string;
  boardName?: string;            // 연결된 보드가 hello로 알려 준 이름
  sensors: ResolvedSensor[];
  connected: boolean;
  onRescan: () => void;
  onBack: () => void;
  backLabel: string;
}

const FW_LABEL = { supported: '펌웨어 지원', partial: '펌웨어 시험용', none: '펌웨어 미지원' } as const;

/** 보드·실험별 센서 연결과 부착 방법, 주의할 점 */
export function Guide({ experiments, initialExpId, boardName, sensors, connected, onRescan, onBack, backLabel }: Props) {
  const detected = boardByName(boardName);
  const [boardId, setBoardId] = useState(() => detected?.id ?? loadBoardId());
  const [expId, setExpId] = useState(initialExpId ?? experiments.find((e) => e.setup)?.id ?? experiments[0]?.id);

  useEffect(() => { if (detected) setBoardId(detected.id); }, [detected?.id]);

  const board = boards.find((b) => b.id === boardId) ?? boards[0];
  const exp = experiments.find((e) => e.id === expId) ?? experiments[0];
  const setup = exp?.setup;
  const parts = useMemo(() => (exp ? partsFor(exp.sensors.filter((s) => s !== '*'), setup?.parts) : []), [exp, setup]);

  const pickBoard = (id: string) => { setBoardId(id); saveBoardId(id); };

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
        </dl>
        <p className={`note ${board.firmware === 'supported' ? '' : 'warn'}`}>{board.firmwareNote}</p>
      </section>

      <section className="guide-block">
        <h2>2. 연결 전 공통 규칙</h2>
        <ul className="rules">{commonRules.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>

      <section className="guide-block">
        <div className="row-head sub">
          <h2>3. 실험 고르기</h2>
          <select value={exp?.id} onChange={(e) => setExpId(e.target.value)} aria-label="실험">
            {experiments.map((e) => (
              <option key={e.id} value={e.id}>{e.title}{e.setup ? '' : ' (안내 준비 중)'}</option>
            ))}
          </select>
        </div>
        {!setup && <p className="note">이 실험의 부착 안내는 준비 중입니다. 아래 센서 연결 방법은 그대로 쓸 수 있습니다.</p>}
      </section>

      {parts.map((p, i) => {
        const c = board.connectors[p.connector];
        const found = p.provides.filter((t) => sensors.some((s) => s.type === t && s.src !== 'demo'));
        return (
          <section key={p.id} className="guide-block">
            <h2>{4 + i}. {p.name} 연결</h2>
            <div className="guide-cols">
              <div>
                <h3>준비물</h3>
                <ul>{[...p.items, ...(i === 0 ? setup?.materials ?? [] : [])].map((x) => <li key={x}>{x}</li>)}</ul>
                <h3>연결 순서</h3>
                <ol>{c.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                <div className="detect">
                  {connected ? (
                    found.length === p.provides.length ? (
                      <span className="ok-note">✓ 인식됨</span>
                    ) : (
                      <span className="warn-text">아직 인식되지 않았습니다.</span>
                    )
                  ) : (
                    <span className="note">보드를 연결하면 인식 여부가 여기에 표시됩니다.</span>
                  )}
                  {connected && <button onClick={onRescan}>센서 다시 찾기</button>}
                </div>
              </div>
              <WiringDiagram board={board} connector={p.connector} partName={p.name} />
            </div>
            <div className={`caution ${c.level === 'warn' ? 'strong' : ''}`}>
              <h3>주의할 점</h3>
              <ul>{[...c.cautions, ...p.cautions].map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </section>
        );
      })}

      {setup && (
        <section className="guide-block">
          <h2>{4 + parts.length}. 실험 장치에 붙이기</h2>
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
