import { partSupported, wiring, type Board, type Part } from '../lib/guide';
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
