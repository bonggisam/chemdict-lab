import { useEffect, useRef, useState } from 'react';
import { Chart, fmt, type Series } from './Chart';
import { t } from '../lib/i18n';
import { R } from './Rich';

/** 2.0: 영상과 맞춰 보기 — 실험 영상을 움직이면 그래프의 같은 시각에 선이 따라감 (영상은 이 기기 안에서만) */
export function VideoSync({ charts, onClose }: {
  charts: { id: string; label: string; unit: string; series: Series[]; decimals: number }[];
  onClose: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [offset, setOffset] = useState(0);
  const vref = useRef<HTMLVideoElement>(null);
  useEffect(() => () => { if (src) URL.revokeObjectURL(src); }, [src]);
  const tt = now - offset;
  const valueAt = (s: Series) => {
    let best: number | undefined, d = Infinity;
    for (const [x, y] of s.pts) { const dd = Math.abs(x - tt); if (dd < d) { d = dd; best = y; } }
    return best;
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet wide-sheet" role="dialog" aria-modal="true" aria-label={t('영상과 맞춰 보기')} onClick={(e) => e.stopPropagation()}>
        <h2>🎬 {t('영상과 맞춰 보기')}</h2>
        {!src ? (
          <>
            <p className="note"><R t={t('측정할 때 찍은 영상을 고르면, 영상을 움직일 때 그래프의 같은 시각에 선이 따라갑니다. 영상은 앱 밖으로 보내지 않습니다.')} /></p>
            <label className="field"><span>{t('영상 고르기')}</span>
              <input type="file" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) setSrc(URL.createObjectURL(f)); }} />
            </label>
          </>
        ) : (
          <>
            <video ref={vref} className="sync-video" src={src} controls playsInline onTimeUpdate={(e) => setNow((e.target as HTMLVideoElement).currentTime)} onSeeked={(e) => setNow((e.target as HTMLVideoElement).currentTime)} />
            <label className="field"><span>{t('영상에서 측정을 시작한 시각')}: {offset.toFixed(1)} s</span>
              <input type="range" min={-60} max={60} step={0.1} value={offset} onChange={(e) => setOffset(Number(e.target.value))} />
            </label>
            <div className="field-row">
              <button onClick={() => setOffset(now)}>{t('지금 장면 = 측정 시작')}</button>
              <span className="note">{t('측정을 시작한 장면에서 영상을 멈추고 누르세요.')}</span>
            </div>
            <p className="mono"><b>t = {tt.toFixed(1)} s</b>{charts.map((c) => { const v = c.series[0] ? valueAt(c.series[0]) : undefined; return v === undefined ? null : <span key={c.id}> · {c.label} {fmt(v)} {c.unit}</span>; })}</p>
            {charts.map((c) => (
              <Chart key={c.id} title={c.label} unit={c.unit} series={c.series} xLabel={t('시간')} xUnit="s" markers={[tt]} selection={null} onSelect={() => {}} height={170} exportName={`video_sync_${c.id}`} />
            ))}
          </>
        )}
        <div className="sheet-actions"><span /><button onClick={onClose}>{t('닫기')}</button></div>
      </div>
    </div>
  );
}
