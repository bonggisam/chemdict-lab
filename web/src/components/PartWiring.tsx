import { breadboard, partSupported, v33Warning, wiring, type Board, type Part } from '../lib/guide';
import { BreadboardDiagram } from './Breadboard';
import { t } from '../lib/i18n';
import { WiringDiagram } from './WiringDiagram';
import { PhotoCheck } from './PhotoCheck';
import { R } from './Rich';

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
  const v33 = v33Warning(board, part);

  return (
    <div className="part-wiring">
      {v33 && (
        <p className="caution strong">
          <R t={v33 === 'divider'
            ? t('{board}는 3.3 V 보드입니다. 이 센서는 5 V 전용이라 전원은 [5V] 핀에서 받고, 신호가 3.3 V를 넘으므로 신호선에 2:1 분압(10 kΩ+10 kΩ)을 넣은 뒤 [센서 보정]에서 배율을 2배로 맞춥니다. 분압 없이 꽂으면 보드가 망가질 수 있습니다.', { board: board.name })
            : t('{board}는 3.3 V 보드입니다. 이 센서는 전원 5 V 전용이라 VCC를 [5V] 핀에 꽂습니다 (신호는 3.3 V 이하).', { board: board.name })} />
        </p>
      )}
      {!ok && (
        <p className="caution strong">
          {board.sensorSet === 'none'
            ? t('{board}용 ChemDict 펌웨어가 아직 없습니다. 연결 방법만 참고하세요.', { board: board.name })
            : t('{board}의 가벼운 펌웨어는 이 센서를 읽지 못합니다. UNO R4 WiFi·R4 Minima·Nano R4·Mega 2560을 쓰세요.', { board: board.name })}
        </p>
      )}
      <div className="guide-cols">
        <div>
          <table className="wire-table">
            <caption>{cable ? t('케이블 하나로 연결') : t('이렇게 꽂으세요')}</caption>
            <tbody>
              {cable ? (
                <tr><td colSpan={3}>{t('보드의 Qwiic 단자 ↔ 센서의 Qwiic 단자 (Qwiic 케이블)')}</td></tr>
              ) : (
                wires.map((w) => (
                  <tr key={w.term}>
                    <td><i className={`wire-dot ${w.color}`} aria-hidden="true" />{t('센서')} <b>{w.term}</b></td>
                    <td aria-hidden="true">→</td>
                    <td>{t('보드')} <b>{w.boardPin}</b></td>
                  </tr>
                ))
              )}
              {connector.resistor && !cable && (
                <tr><td colSpan={3}>{t('저항 {value}: 보드 {a} ↔ {b}', { value: connector.resistor.value, a: b.pins[connector.resistor.between[0]], b: b.pins[connector.resistor.between[1]] })}</td></tr>
              )}
            </tbody>
          </table>
          {connector.steps.length > 0 && <ul className="wire-steps">{connector.steps.map((s) => <li key={s}><R t={s} /></li>)}</ul>}
          {!compact && (
            <>
              <h3>{t('준비물')}</h3>
              <ul>{part.items.map((x) => <li key={x}><R t={x} /></li>)}</ul>
            </>
          )}
        </div>
        <WiringDiagram board={b} part={part} />
      </div>
      <PhotoCheck board={board} part={part} port={port} />
      {connector.breadboard && !cable && <BreadboardNote need={connector.breadboard.need} why={connector.breadboard.why} circuit={connector.breadboard.circuit} />}
      {cautions.length > 0 && (compact ? (
        <details className="caution">
          <summary>{t('주의할 점 {n}가지', { n: cautions.length })}</summary>
          <ul>{cautions.map((x) => <li key={x}><R t={x} /></li>)}</ul>
        </details>
      ) : (
        <div className="caution">
          <h3>{t('주의할 점')}</h3>
          <ul>{cautions.map((x) => <li key={x}><R t={x} /></li>)}</ul>
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
      <summary><b>{need === 'required' ? t('브레드보드 필요') : t('브레드보드 있으면 편함')}</b> — {why}</summary>
      {c ? (
        <div className="guide-cols bb-cols">
          <ol className="wire-steps">{c.steps.map((s) => <li key={s}><R t={s} /></li>)}</ol>
          <BreadboardDiagram circuit={c} title={t('{name} 브레드보드 연결 그림', { name: c.name })} />
        </div>
      ) : <p className="note">{t('센서를 브레드보드에 꽂고, 같은 세로 줄에서 점퍼선으로 보드 핀에 연결합니다.')}</p>}
      <p className="note">{t('브레드보드 구조와 규칙은 ‘연결 방법 → 브레드보드’에 있습니다.')}</p>
    </details>
  );
}
