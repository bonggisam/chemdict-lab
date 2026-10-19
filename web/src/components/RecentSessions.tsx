import { useRef, useState } from 'react';
import { Ico } from './Ico';
import { ICON } from '../lib/icons';
import { listSessions, readSessionFile, removeSession, sessionSummary, type Session } from '../lib/session';
import { t } from '../lib/i18n';

/** 최근 측정(자동 저장)과 측정 파일 열기 */
export function RecentSessions({ onOpen, say, compact }: { onOpen: (s: Session) => void; say: (k: 'ok' | 'err', s: string) => void; compact?: boolean }) {
  const [list, setList] = useState(listSessions);
  const fileRef = useRef<HTMLInputElement>(null);
  const openFile = async (f?: File) => {
    if (!f) return;
    try { onOpen(await readSessionFile(f)); }
    catch { say('err', t('ChemDict Lab 측정 파일(.chemdict)이 아닙니다.')); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const fmtWhen = (d: Date) => d.toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (compact && !list.length) {
    return (
      <p className="note recent-empty">
        <button className="link" onClick={() => fileRef.current?.click()}><Ico e={ICON.open} />{t('측정 파일 열기')}</button>
        <input ref={fileRef} type="file" accept=".chemdict,.json,application/json" hidden onChange={(e) => openFile(e.target.files?.[0])} />
      </p>
    );
  }
  return (
    <section className="recent">
      <div className="row-head sub">
        <h2><Ico e={ICON.recent} />{t('이어서 하기')}</h2>
        <button className="ghost" onClick={() => fileRef.current?.click()}><Ico e={ICON.open} />{t('측정 파일 열기')}</button>
        <input ref={fileRef} type="file" accept=".chemdict,.json,application/json" hidden onChange={(e) => openFile(e.target.files?.[0])} />
      </div>
      {list.length
        ? (
          <ul className="recent-list">
            {list.map((s) => {
              const m = sessionSummary(s);
              return (
                <li key={s.id}>
                  <button className="recent-open" onClick={() => onOpen(s)}>
                    <b><Ico e="📈" />{m.title}</b>
                    <span className="note">{fmtWhen(m.when)} · {t('측정 {n}개', { n: m.runs })} · {t('{n}점', { n: m.points })}</span>
                  </button>
                  <button className="x" aria-label={t('{name} 지우기', { name: m.title })} onClick={() => { removeSession(s.id); setList(listSessions()); }}>×</button>
                </li>
              );
            })}
          </ul>
        )
        : <p className="note">{t('측정한 데이터는 이 기기에 자동으로 저장됩니다 (최근 5개). 창을 닫거나 새로고침해도 여기서 다시 열 수 있습니다.')}</p>}
    </section>
  );
}
