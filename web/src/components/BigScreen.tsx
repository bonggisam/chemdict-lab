import { useEffect, useRef } from 'react';
import { t } from '../lib/i18n';

interface Tile { id: string; label: string; unit: string; value: string; pts: number[] }

/** 2.0: 큰 화면 — 교실 앞 화면(프로젝터·TV)에 띄우는 큰 숫자 + 작은 그래프 */
export function BigScreen({ title, tiles, running, connected, onStart, onStop, onClose }: {
  title: string; tiles: Tile[]; running: boolean; connected: boolean; onStart: () => void; onStop: () => void; onClose: () => void;
}) {
  // 새 값이 올 때마다 화면이 다시 그려지므로 닫기 함수는 ref로 (전체 화면을 한 번만 켜고 끄기)
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);
  return (
    <div className="big-screen" role="dialog" aria-modal="true" aria-label={t('큰 화면')}>
      <div className="big-head">
        <h1>{title}</h1>
        {running
          ? <button className="danger" onClick={onStop}>■ {t('정지')}</button>
          : <button className="primary" disabled={!connected} onClick={onStart}>● {t('측정 시작')}</button>}
        <button className="ghost" onClick={onClose}>✕ {t('닫기')}</button>
      </div>
      <div className={`big-grid n${Math.min(tiles.length, 3)}`}>
        {tiles.map((x) => (
          <div key={x.id} className="big-tile" aria-label={`${x.label} ${x.value} ${x.unit}`}>
            <span className="big-label">{x.label}</span>
            <span className="big-value">{x.value}<small>{x.unit}</small></span>
            <Spark pts={x.pts} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Spark({ pts }: { pts: number[] }) {
  if (pts.length < 2) return <div className="big-spark" />;
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 100},${40 - ((v - lo) / span) * 36 - 2}`).join(' ');
  return (
    <svg className="big-spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--s1)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
