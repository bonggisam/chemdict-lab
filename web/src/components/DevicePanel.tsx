import { useEffect, useRef, useState } from 'react';
import { catIcon } from '../lib/icons';
import { typeInfo } from '../lib/sensors';
import { t } from '../lib/i18n';
import { availableKits, kitUsesCamera, kitUsesMic, ABSORB, type DeviceKit, type DeviceTransport } from '../lib/device';
import { R } from './Rich';

/** 2.0: 보드 없이 이 기기의 센서로 측정하는 카드 */
export function DeviceSection({ onOpen, activeId, compact }: { onOpen: (k: DeviceKit) => void; activeId?: string; compact?: boolean }) {
  const kits = availableKits();
  if (!kits.length) return null;
  return (
    <section className={`device-section ${compact ? 'compact' : ''}`} data-nav={t('이 기기 센서')}>
      <h2>📱 {t('이 기기 센서로 측정')}</h2>
      <p className="note"><R t={t('보드가 없어도 됩니다. 카드를 누르고 [측정 시작]을 누르면 이 기기의 센서로 바로 기록합니다.')} /></p>
      <div className="sensor-cards">
        {kits.map((k) => (
          <button key={k.id} className={`sensor-card ${activeId === `quick-${k.id}` ? 'is-on' : ''}`} onClick={() => onOpen(k)}>
            <span className="sc-ico" aria-hidden="true">{catIcon(k.category)}</span>
            <b>{k.name}</b>
            <span className="measures">{k.provides.map((ty) => typeInfo(ty)?.name ?? ty).join(' · ')}</span>
            {activeId === `quick-${k.id}` && <span className="badges"><span className="badge ok">{t('✓ 측정 중인 카드')}</span></span>}
          </button>
        ))}
      </div>
    </section>
  );
}

/** 카메라 미리보기 + 가운데 사각형 + 지금 색 + [0 맞추기] */
export function DeviceCamera({ dev, absorbance, running, say }: { dev: DeviceTransport; absorbance: boolean; running: boolean; say: (k: 'ok' | 'err', s: string) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(dev.videoStream);
  const [rgb, setRgb] = useState(dev.color);
  const [blank, setBlank] = useState(dev.hasBlank);
  useEffect(() => {
    dev.onVideo = setStream;
    dev.startCamera();
    const id = window.setInterval(() => setRgb(dev.color), 250);
    // 이 창을 닫을 때 측정 중이 아니면 카메라를 끔 (불빛·배터리)
    return () => { clearInterval(id); dev.onVideo = () => {}; if (!dev.running) dev.stopCamera(); };
  }, [dev]);
  useEffect(() => { if (ref.current && stream) { ref.current.srcObject = stream; ref.current.play().catch(() => {}); } }, [stream]);
  return (
    <div className="device-camera">
      <div className="cam-box">
        <video ref={ref} muted playsInline aria-label={t('카메라 미리보기. 가운데 사각형 안의 색을 잽니다.')} />
        <span className="cam-target" aria-hidden="true" />
        {!stream && <span className="cam-wait">{t('카메라를 켜는 중…')}</span>}
      </div>
      <div className="cam-row">
        {rgb && <span className="swatch" style={{ background: `rgb(${rgb.r},${rgb.g},${rgb.b})` }} aria-hidden="true" />}
        {rgb && <span className="mono">R {rgb.r.toFixed(0)} · G {rgb.g.toFixed(0)} · B {rgb.b.toFixed(0)}</span>}
        {absorbance && (
          <button className="ghost" disabled={running} onClick={() => {
            if (dev.setBlank()) { setBlank(true); dev.lockExposure(); say('ok', t('지금 색을 0(빈 용액)으로 맞췄습니다.')); }
            else say('err', t('카메라가 아직 준비되지 않았습니다. 잠시 뒤 다시 누르세요.'));
          }}>{blank ? t('0 맞춤 ✓ (다시 맞추기)') : t('0 맞추기 (물·빈 용액을 비춘 채로)')}</button>
        )}
      </div>
    </div>
  );
}

/** 카드를 누르면: 측정 방법 → (카메라면 미리보기·0 맞추기) → [측정 시작] */
export function DeviceSheet({ kit, dev, onStart, onClose, say }: {
  kit: DeviceKit; dev: DeviceTransport; onStart: () => void; onClose: () => void; say: (k: 'ok' | 'err', s: string) => void;
}) {
  const cam = kitUsesCamera(kit);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet wide-sheet quick" role="dialog" aria-modal="true" aria-label={kit.name} onClick={(e) => e.stopPropagation()}>
        <div className="quick-head">
          <h2>{kit.name}</h2>
          <span className="note">{t('보드: 이 기기 (연결할 선이 없습니다)')}</span>
        </div>
        {cam && <DeviceCamera dev={dev} absorbance={kit.provides.some((p) => ABSORB.includes(p))} running={false} say={say} />}
        <h3>{t('측정 방법')}</h3>
        <ol>{kit.how.map((s, i) => <li key={i}><R t={s} /></li>)}</ol>
        {kit.cautions.length > 0 && (
          <div className="caution"><h3>{t('주의')}</h3><ul>{kit.cautions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        )}
        {kit.ideas.length > 0 && (<><h3>{t('이런 실험에 써요')}</h3><ul className="note">{kit.ideas.map((s, i) => <li key={i}>{s}</li>)}</ul></>)}
        {(cam || kitUsesMic(kit)) && (
          <p className="note">{kitUsesMic(kit) ? t('처음 쓸 때 마이크 허락을 묻습니다. 소리는 녹음하지 않고 크기와 진동수만 기록합니다.')
            : t('처음 쓸 때 카메라 허락을 묻습니다. 사진은 저장하지 않고 색 값만 기록합니다.')}</p>
        )}
        <div className="sheet-actions">
          <button className="ghost" onClick={onClose}>{t('닫기')}</button>
          <button className="primary big-action" onClick={onStart}>{t('측정 시작')}</button>
        </div>
      </div>
    </div>
  );
}
