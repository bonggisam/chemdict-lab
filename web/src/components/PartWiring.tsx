import { breadboard, partSupported, wiring, type Board, type Part } from '../lib/guide';
import { BreadboardDiagram } from './Breadboard';
import { WiringDiagram } from './WiringDiagram';

interface Props {
  board: Board;
  part: Part;
  port?: string;          // 아날로그 센서를 꽂을 포트 (A0~A3)
  compact?: boolean;      // 바로 측정 창: 주의할 점을 접어 둠
}

/** 보드에 맞춘 센서 연결: 그림 + 연결표 + 주의 */
export function PartWiring({ board, part, port, compact }: Props) {
  const b = port ? { ...board, pins: { ...board.pins, A: port } } : board;
  const { connector, cable, wires } = wiring(b, part);
  const ok = partSupported(board, part);
  const cautions = [...connector.cautions, ...part.cautions];

  return (
    <div className="part-wiring">
      {!ok && (
        <p className="caution strong">
          {board.sensorSet === 'none'
            ? `${board.name}용 ChemDict 펌웨어가 아직 없습니다. 연결 방법만 참고하세요.`
            : `${board.name}의 가벼운 펌웨어는 이 센서를 읽지 못합니다. UNO R4 WiFi·R4 Minima·Nano R4·Mega 2560을 쓰세요.`}
        </p>
      )}
      <div className="guide-cols">
        <div>
          <table className="wire-table">
            <caption>{cable ? '케이블 하나로 연결' : '이렇게 꽂으세요'}</caption>
            <tbody>
              {cable ? (
                <tr><td colSpan={3}>보드의 <b>Qwiic 단자</b> ↔ 센서의 <b>Qwiic 단자</b> (Qwiic 케이블)</td></tr>
              ) : (
                wires.map((w) => (
                  <tr key={w.term}>
                    <td><i className={`wire-dot ${w.color}`} aria-hidden="true" />센서 <b>{w.term}</b></td>
                    <td aria-hidden="true">→</td>
                    <td>보드 <b>{w.boardPin}</b></td>
                  </tr>
                ))
              )}
              {connector.resistor && !cable && (
                <tr><td colSpan={3}>저항 <b>{connector.resistor.value}</b>: 보드 {b.pins[connector.resistor.between[0]]} ↔ {b.pins[connector.resistor.between[1]]}</td></tr>
              )}
            </tbody>
          </table>
          {connector.steps.length > 0 && <ul className="wire-steps">{connector.steps.map((s) => <li key={s}>{s}</li>)}</ul>}
          {!compact && (
            <>
              <h3>준비물</h3>
              <ul>{part.items.map((x) => <li key={x}>{x}</li>)}</ul>
            </>
          )}
        </div>
        <WiringDiagram board={b} part={part} />
      </div>
      {connector.breadboard && !cable && <BreadboardNote need={connector.breadboard.need} why={connector.breadboard.why} circuit={connector.breadboard.circuit} />}
      {cautions.length > 0 && (compact ? (
        <details className="caution">
          <summary>주의할 점 {cautions.length}가지</summary>
          <ul>{cautions.map((x) => <li key={x}>{x}</li>)}</ul>
        </details>
      ) : (
        <div className="caution">
          <h3>주의할 점</h3>
          <ul>{cautions.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

/** 브레드보드 필요 표시 + 회로 그림 (접어 둠) */
export function BreadboardNote({ need, why, circuit }: { need: string; why: string; circuit: string | null }) {
  const c = circuit ? breadboard.circuits.find((x) => x.id === circuit) : undefined;
  return (
    <details className={`bb-note ${need}`}>
      <summary><b>{need === 'required' ? '브레드보드 필요' : '브레드보드 있으면 편함'}</b> — {why}</summary>
      {c ? (
        <div className="guide-cols bb-cols">
          <ol className="wire-steps">{c.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <BreadboardDiagram circuit={c} title={`${c.name} 브레드보드 연결 그림`} />
        </div>
      ) : <p className="note">센서를 브레드보드에 꽂고, 같은 세로 줄에서 점퍼선으로 보드 핀에 연결합니다.</p>}
      <p className="note">브레드보드 구조와 규칙은 ‘연결 방법 → 브레드보드’에 있습니다.</p>
    </details>
  );
}
