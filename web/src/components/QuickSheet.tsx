import { useState } from 'react';
import { partSupported, type Board, type Part } from '../lib/guide';
import type { ResolvedSensor } from '../lib/sensors';
import { PartWiring } from './PartWiring';

export type QuickStatus = 'idle' | 'finding' | 'notfound';

interface Props {
  board: Board;
  boardDetected: boolean;
  part: Part;
  sensors: ResolvedSensor[];
  connected: boolean;
  status: QuickStatus;
  onStart: (port?: string) => void;
  onClose: () => void;
}

const PORTS = ['A0', 'A1', 'A2', 'A3'];

/** 센서를 고르면: 연결 그림 → [연결했어요 · 측정 시작] 한 번으로 측정 */
export function QuickSheet({ board, boardDetected, part, sensors, connected, status, onStart, onClose }: Props) {
  const analog = !!part.analogType;
  // 이미 이 종류로 설정된 포트 → 비어 있는 포트 → A0
  const firstPort =
    sensors.find((s) => s.type === part.analogType && /^A\d$/.test(s.src))?.src ??
    PORTS.find((p) => !sensors.some((s) => s.src === p)) ?? 'A0';
  const [port, setPort] = useState(firstPort);
  const ok = partSupported(board, part);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet wide-sheet quick" role="dialog" aria-modal="true" aria-label={`${part.name} 바로 측정`} onClick={(e) => e.stopPropagation()}>
        <div className="quick-head">
          <h2>{part.name}</h2>
          <span className="note">보드: {board.name}{boardDetected ? ' (자동 인식)' : ''}</span>
        </div>

        {analog && (
          <div className="port-pick" role="radiogroup" aria-label="꽂을 포트">
            <span>꽂을 포트</span>
            {PORTS.map((p) => (
              <button key={p} role="radio" aria-checked={p === port} className={p === port ? 'on' : ''} onClick={() => setPort(p)}>{p}</button>
            ))}
          </div>
        )}

        <PartWiring board={board} part={part} port={analog ? port : undefined} compact />

        {status === 'notfound' && (
          <div className="caution strong" role="alert">
            <h3>센서를 찾지 못했습니다</h3>
            <ol>
              <li>USB를 뽑고 선이 위 표대로 꽂혔는지 다시 봅니다. VCC와 GND가 바뀌지 않았는지 확인합니다.</li>
              <li>점퍼선이 헐겁지 않은지 눌러 봅니다. 브레드보드는 같은 줄에 꽂혀야 이어집니다.</li>
              <li>USB를 다시 꽂고 아래 버튼을 한 번 더 누릅니다.</li>
            </ol>
          </div>
        )}

        <div className="sheet-actions">
          <button className="ghost" onClick={onClose}>닫기</button>
          <button className="primary big-action" disabled={!connected || !ok || status === 'finding'} onClick={() => onStart(analog ? port : undefined)}>
            {!connected ? '먼저 보드를 연결하세요' : status === 'finding' ? '센서를 찾는 중…' : status === 'notfound' ? '다시 찾기' : '연결했어요 · 측정 시작'}
          </button>
        </div>
      </div>
    </div>
  );
}
