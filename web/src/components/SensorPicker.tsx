import { useState } from 'react';
import { categories, partSupported, parts, type Board, type Part } from '../lib/guide';
import { typeInfo } from '../lib/sensors';
import { t } from '../lib/i18n';
import { catName } from '../lib/l10n';

interface Props {
  board: Board;
  connectedTypes: string[];     // 지금 인식된 센서 종류
  onPick: (p: Part) => void;
}

/** 센서 카드: 분류별로 보여 주고, 누르면 바로 측정 창 */
export function SensorPicker({ board, connectedTypes, onPick }: Props) {
  const [cat, setCat] = useState<string>('전체');
  const list = parts.filter((p) => cat === '전체' || p.category === cat);

  return (
    <div className="sensor-picker">
      <div className="cat-chips" role="tablist" aria-label={t('센서 분류')}>
        {['전체', ...categories].map((c) => (
          <button key={c} role="tab" aria-selected={c === cat} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c === '전체' ? t('전체') : catName(c)}</button>
        ))}
      </div>
      <div className="sensor-cards">
        {list.map((p) => {
          const ok = partSupported(board, p);
          const on = !p.analogType && p.provides.every((ty) => connectedTypes.includes(ty));
          return (
            <button key={p.id} className={`sensor-card ${ok ? '' : 'dim'}`} onClick={() => onPick(p)}>
              <b>{p.name}</b>
              <span className="measures">{p.provides.map((ty) => typeInfo(ty)?.name ?? ty).join(' · ')}</span>
              <span className="badges">
                {on && <span className="badge ok">{t('✓ 연결됨')}</span>}
                {!ok && <span className="badge">{t('이 보드 미지원')}</span>}
                {ok && p.support === 'verified' && <span className="badge">{t('실제 확인')}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
