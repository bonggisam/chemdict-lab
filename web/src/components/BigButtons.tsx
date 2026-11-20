import { t } from '../lib/i18n';

// 2.2 큰 버튼 화면: 큰 숫자 + 큰 버튼 (시작·정지 / 값 기록(값 입력 모드) / 지금 값 듣기 / CSV) — 애플 BigButtonMeasure와 같음

export interface BigValue { id: string; label: string; value: string; unit: string }
export interface BigEvent { label: string; unit: string; x: string; setX: (v: string) => void; onRecord: () => void }

interface Props {
  title: string;
  values: BigValue[];
  running: boolean;
  connected: boolean;
  canSpeak: boolean;
  canSave: boolean;
  event?: BigEvent;          // 값 입력 모드: 넣은 값 + [값 기록]
  onBack: () => void;
  onStart: () => void;
  onStop: () => void;
  onSpeak: () => void;
  onSave: () => void;
  onNormal: () => void;
}

export function BigButtons(p: Props) {
  return (
    <main className="wide measure big-buttons">
      <button className="ghost back" disabled={p.running} onClick={p.onBack}>← {t('실험 목록')}</button>
      <h1>{p.title}</h1>
      <div className="big-values" data-nav={t('지금 값')} data-nav-ico="🔢">
        {p.values.map((v) => (
          <div key={v.id} className="big-value" role="group" aria-label={v.label}>
            <span className="lbl">{v.label}</span>
            <span className="num" aria-live="off">{v.value}<small> {v.unit}</small></span>
          </div>
        ))}
      </div>
      <div className="big-actions" data-nav={t('측정 시작 · 정지')} data-nav-ico="⏯️">
        {!p.running
          ? <button className="primary rec big" disabled={!p.connected} onClick={p.onStart}>● {t('측정 시작')}</button>
          : <button className="danger big" onClick={p.onStop}>■ {t('정지')}</button>}
        {p.event && (
          <div className="big-event">
            <label htmlFor="big-event-x">{p.event.label}{p.event.unit ? ` (${p.event.unit})` : ''}</label>
            <input id="big-event-x" inputMode="decimal" value={p.event.x} onChange={(e) => p.event!.setX(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') p.event!.onRecord(); }} />
            <button className="primary big" disabled={!p.running} onClick={p.event.onRecord}>✚ {t('값 기록')}</button>
          </div>
        )}
        <button className="primary big" disabled={!p.canSpeak} onClick={p.onSpeak}>🔊 {t('지금 값 듣기')}</button>
        <button className="primary big" disabled={!p.canSave || p.running} onClick={p.onSave}>⬇ {t('CSV 저장')}</button>
      </div>
      {!p.connected && <p className="note warn">{t('저장된 측정을 보는 중입니다. 새로 측정하려면 보드를 연결하세요.')}</p>}
      <button className="ghost" onClick={p.onNormal}>{t('보통 화면으로')}</button>
    </main>
  );
}
