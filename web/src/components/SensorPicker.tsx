import { useState } from 'react';
import { Ico } from './Ico';
import { catIcon } from '../lib/icons';
import { categories, partSupported, parts, v33Warning, type Board, type Part } from '../lib/guide';
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
  const [q, setQ] = useState('');
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const isOn = (p: Part) => !p.analogType && p.provides.every((ty) => connectedTypes.includes(ty));
  const list = parts
    .filter((p) => (cat === '전체' || p.category === cat) && (words.length === 0 || words.every((w) =>
      [p.name, p.id, ...p.items, ...p.provides.map((ty) => typeInfo(ty)?.name ?? ty)].join(' ').toLowerCase().includes(w))))
    .sort((a, b) => Number(isOn(b)) - Number(isOn(a)));

  return (
    <div className="sensor-picker">
      <input className="sensor-search" type="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder={t('센서 이름·부품 번호로 찾기 (예: MQ-3, BH1750)')} aria-label={t('센서 찾기')} />
      <div className="cat-chips" role="tablist" aria-label={t('센서 분류')}>
        {['전체', ...categories].map((c) => (
          <button key={c} role="tab" aria-selected={c === cat} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}><Ico e={catIcon(c)} />{c === '전체' ? t('전체') : catName(c)}</button>
        ))}
      </div>
      <div className="sensor-cards">
        {list.map((p) => {
          const ok = partSupported(board, p);
          const on = isOn(p);
          return (
            <button key={p.id} className={`sensor-card ${ok ? '' : 'dim'} ${on ? 'is-on' : ''}`} onClick={() => onPick(p)}>
              <span className="sc-ico" aria-hidden="true">{catIcon(p.category)}</span>
              <b>{p.name}</b>
              <span className="measures">{p.provides.map((ty) => typeInfo(ty)?.name ?? ty).join(' · ')}</span>
              <span className="badges">
                {on && <span className="badge ok">{t('✓ 연결됨')}</span>}
                {!ok && <span className="badge">{t('이 보드 미지원')}</span>}
                {ok && p.support === 'verified' && <span className="badge">{t('실제 확인')}</span>}
                {ok && v33Warning(board, p) && <span className="badge warn">{v33Warning(board, p) === 'divider' ? t('5 V 전용 · 분압 필요') : t('전원 5 V 핀')}</span>}
                {ok && (p.currentMa ?? 0) >= 100 && <span className="badge">{t('{n} mA', { n: p.currentMa ?? 0 })}</span>}
              </span>
            </button>
          );
        })}
        {list.length === 0 && <p className="muted">{t('찾는 센서가 없습니다. 아날로그 출력 센서는 \'기타 아날로그 센서\'로 잴 수 있습니다.')}</p>}
      </div>
    </div>
  );
}
