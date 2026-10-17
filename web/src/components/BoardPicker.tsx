import { boards, type Board } from '../lib/guide';

const FW_LABEL = { verified: '실제 확인', compiled: '사용 가능', none: '준비 중' } as const;

interface Props {
  board: Board;
  detectedId?: string;
  onPick: (id: string) => void;
}

/** 보드 고르기: 쓸 수 있는 보드를 먼저, 준비 중인 보드는 접어 둠 */
export function BoardPicker({ board, detectedId, onPick }: Props) {
  const main = boards.filter((b) => b.firmware !== 'none');
  const later = boards.filter((b) => b.firmware === 'none');
  const btn = (b: Board) => (
    <button key={b.id} role="radio" aria-checked={b.id === board.id} className={b.id === board.id ? 'on' : ''} disabled={b.firmware === 'none'} onClick={() => onPick(b.id)}>
      <b>{b.name}</b>
      <span className={`fw ${b.firmware}`}>{b.id === detectedId ? '✓ 연결됨' : `${b.ble ? 'USB·블루투스' : 'USB'} · ${FW_LABEL[b.firmware]}`}</span>
    </button>
  );
  return (
    <div>
      <div className="board-pick" role="radiogroup" aria-label="보드 종류">{main.map(btn)}</div>
      {later.length > 0 && (
        <details className="advanced">
          <summary>그 밖의 보드 ({later.length}종, 준비 중)</summary>
          <div className="board-pick">{later.map(btn)}</div>
        </details>
      )}
    </div>
  );
}
