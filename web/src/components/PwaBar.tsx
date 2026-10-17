import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '../lib/i18n';

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/** 오프라인 모드: 준비 완료 알림, 새 버전 업데이트(측정 중에는 미룸), 앱 설치 */
export function PwaBar({ running }: { running: boolean }) {
  const { offlineReady: [ready, setReady], needRefresh: [refresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, r) { if (r) setInterval(() => { r.update().catch(() => {}); }, 60 * 60 * 1000); },
  });
  const [install, setInstall] = useState<BIPEvent | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); setInstall(e as BIPEvent); };
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => { if (ready) { const id = setTimeout(() => setReady(false), 6000); return () => clearTimeout(id); } }, [ready, setReady]);

  if (!refresh && !ready && !install && online) return null;
  return (
    <div className="pwa-bar" role="status">
      {!online && <span>{t('오프라인입니다. 측정과 저장은 그대로 됩니다.')}</span>}
      {ready && <span>{t('오프라인 모드 준비 완료: 이제 인터넷 없이도 열립니다.')}</span>}
      {refresh && (
        <span>
          {t('새 버전이 있습니다.')}{' '}
          {running
            ? <span className="note">{t('측정을 마친 뒤 업데이트하세요.')}</span>
            : <button className="link" onClick={() => updateServiceWorker(true)}>{t('지금 업데이트')}</button>}
        </span>
      )}
      {install && !refresh && (
        <span>
          <button className="link" onClick={async () => { await install.prompt(); setInstall(null); }}>{t('앱으로 설치')}</button>
          <span className="note"> {t('바탕화면·홈 화면에 아이콘이 생깁니다.')}</span>
        </span>
      )}
    </div>
  );
}
