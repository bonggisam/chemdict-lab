import { useMemo } from 'react';
import { qrSvg } from '../lib/qr';
import { t } from '../lib/i18n';

/** 실험 공유: QR + 링크. 학생은 찍거나 링크를 열고 보드만 연결하면 바로 측정 */
export function ShareSheet({ url, title, onClose, say }: { url: string; title: string; onClose: () => void; say: (k: 'ok' | 'err', s: string) => void }) {
  const svg = useMemo(() => qrSvg(url, 6), [url]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); say('ok', t('링크를 복사했습니다. 클래스룸·메신저에 붙여넣으세요.')); }
    catch { say('err', t('이 브라우저에서는 복사가 막혀 있습니다. 링크를 길게 눌러 복사하세요.')); }
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet share-sheet" role="dialog" aria-modal="true" aria-label={t('실험 공유')} onClick={(e) => e.stopPropagation()}>
        <h2>{t('실험 공유')}</h2>
        <p className="note">{t('‘{title}’ 실험과 측정 간격·계산 열이 담깁니다. 학생은 QR을 찍거나 링크를 열고 보드만 연결하면 바로 측정 화면이 열립니다.', { title })}</p>
        {svg
          ? <div className="qr" role="img" aria-label={t('실험 공유 QR 코드')} dangerouslySetInnerHTML={{ __html: svg }} />
          : <p className="note warn">{t('담을 내용이 많아 QR을 만들 수 없습니다. 링크를 쓰세요.')}</p>}
        <div className="share-link">
          <input readOnly value={url} aria-label={t('공유 링크')} onFocus={(e) => e.target.select()} />
          <button className="primary" onClick={copy}>{t('링크 복사')}</button>
        </div>
        <p className="note">{t('화면에 띄우거나 인쇄해 모둠마다 나눠 주세요. 학생 이름이나 측정값은 담기지 않습니다.')}</p>
        <div className="sheet-actions">
          <button onClick={() => window.print()}>{t('인쇄')}</button>
          <button onClick={onClose}>{t('닫기')}</button>
        </div>
      </div>
    </div>
  );
}
