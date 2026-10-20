import { useState } from 'react';
import type { Board, Part } from '../lib/guide';
import { checklist, commonMistakes } from '../lib/photoCheck';
import { t } from '../lib/i18n';
import { R } from './Rich';

interface Props { board: Board; part: Part; port?: string }

/** 연결 사진으로 점검: 찍은 사진을 연결 그림 옆에 두고, 점검 목록을 하나씩 맞춰 봅니다 (사진은 기기 밖으로 나가지 않음) */
export function PhotoCheck({ board, part, port }: Props) {
  const [preview, setPreview] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const items = checklist(board, part, port);
  const mistakes = commonMistakes(part);
  const total = items.length + 2, n = Object.values(done).filter(Boolean).length;

  const pick = (f: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : '');
    setDone({});
  };
  const toggle = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setDone({ ...done, [k]: e.target.checked });

  return (
    <details className="photo-check">
      <summary>📷 {t('연결 사진으로 점검하기')}</summary>
      <div className="pc-body">
        <p className="note"><R t={t('센서와 보드 핀이 모두 보이게 위에서, 핀 이름이 읽힐 만큼 가까이 찍습니다. 사진은 이 화면에만 보이고 어디에도 보내지 않습니다.')} /></p>
        <div className="pc-row">
          <label className="pc-file">
            <input type="file" accept="image/*" capture="environment" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
            <span>{preview ? t('다른 사진') : t('사진 찍기 · 올리기')}</span>
          </label>
          {preview && <button className="ghost" onClick={() => pick(null)}>{t('사진 지우기')}</button>}
        </div>
        {preview && (
          <div className="pc-compare">
            <figure><img src={preview} alt={t('올린 연결 사진')} /><figcaption>{t('내 사진')}</figcaption></figure>
            <p className="note">{t('위 연결 그림·표와 나란히 보며, 아래 목록의 선을 사진에서 하나씩 찾아 체크하세요. 확대하려면 사진을 길게 누르거나 두 손가락으로 벌립니다.')}</p>
          </div>
        )}

        <h3>{t('점검 목록')} <small className="note">{n}/{total}</small></h3>
        <ul className="pc-list">
          {items.map((it, i) => (
            <li key={i} className={done[String(i)] ? 'done' : ''}>
              <label>
                <input type="checkbox" checked={!!done[String(i)]} onChange={toggle(String(i))} />
                {it.color && <i className={`wire-dot ${it.color}`} aria-hidden="true" />}
                <span className="pc-term">{it.term}</span> <span aria-hidden="true">→</span> <span className="k-pin">{it.pin}</span>
                {it.note && <small className="note"> · {it.note}</small>}
              </label>
            </li>
          ))}
          <li className={done.seat ? 'done' : ''}><label><input type="checkbox" checked={!!done.seat} onChange={toggle('seat')} /><span className="pc-term">{t('점퍼선이 헐겁지 않고, 브레드보드에서는 같은 세로 줄에 꽂혀 있다')}</span></label></li>
          <li className={done.pwr ? 'done' : ''}><label><input type="checkbox" checked={!!done.pwr} onChange={toggle('pwr')} /><span className="pc-term"><R t={t('VCC(+)와 GND(−)가 바뀌지 않았다')} /></span></label></li>
        </ul>
        {n === total && <p className="ok-note">✓ {t('모두 확인했습니다. USB를 꽂고 [센서 다시 찾기]를 누르세요.')}</p>}

        <details className="advanced">
          <summary>{t('이 센서에서 자주 하는 실수 {n}가지', { n: mistakes.length })}</summary>
          <ul className="pc-mistakes">{mistakes.map((m) => <li key={m}><R t={m} /></li>)}</ul>
        </details>
      </div>
    </details>
  );
}
