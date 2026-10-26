import { useEffect, useState } from 'react';
import { t } from '../lib/i18n';
import { BUNDLED_FW, older } from '../lib/flash';
import type { HelloMsg } from '../lib/protocol';
import { R } from './Rich';

export interface LinkStats { points: number; last: number; drops: number; reconnects: number; since: number }

/** 2.0: 연결 진단 — 연결·측정 프로그램·데이터 흐름을 한눈에, 문제가 있으면 할 일 */
export function DiagnosticsSheet({ connLabel, hello, stats, running, reconnecting, intervalMs, onClose }: {
  connLabel: string; hello: HelloMsg | null; stats: () => LinkStats; running: boolean; reconnecting: boolean; intervalMs: number; onClose: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id); }, []);
  const s = stats();
  const age = s.last ? (Date.now() - s.last) / 1000 : null;
  const stalled = running && (age ?? 0) > Math.max(3, (intervalMs / 1000) * 3);
  const numericFw = !!hello && /^\d/.test(hello.fw);
  const outdated = numericFw && older(hello!.fw, BUNDLED_FW);
  const rate = running && s.points > 2 ? (Date.now() - s.since) / 1000 / s.points : null;
  const advice: string[] = [];
  if (!connLabel) advice.push(t('먼저 [보드 연결]에서 보드를 연결하거나 [보드 없이 체험]을 누르세요.'));
  if (reconnecting) advice.push(t('보드 전원과 거리를 확인하세요. 3번 실패하면 연결이 끊기고 그때까지의 기록은 ‘이어서 하기’에 남습니다.'));
  if (stalled) advice.push(t('값이 들어오지 않습니다. 보드 전원·USB 케이블을 확인하고 [정지] 뒤 다시 [측정 시작]을 누르세요.'));
  if (outdated) advice.push(t('보드의 측정 프로그램이 오래되었습니다. USB로 연결하면 1단계 화면에서 업데이트할 수 있습니다.'));
  if (hello && hello.sensors.length === 0) advice.push(t('센서가 하나도 보이지 않습니다. 선을 확인하고 [센서 다시 찾기]를 누르세요.'));
  const Row = ({ k, v, ok }: { k: string; v: string; ok: boolean }) => (
    <tr><td aria-hidden="true">{ok ? '✅' : '⚠️'}</td><th scope="row">{k}</th><td className="mono">{v}</td></tr>
  );
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('연결 진단')} onClick={(e) => e.stopPropagation()}>
        <h2>🩺 {t('연결 진단')}</h2>
        <table className="diag">
          <tbody>
            <Row k={t('연결 방법')} v={connLabel || t('연결 안 됨')} ok={!!connLabel} />
            {reconnecting && <Row k={t('상태')} v={t('다시 연결하는 중…')} ok={false} />}
            {hello && <Row k={t('보드')} v={hello.board} ok />}
            {numericFw && <Row k={t('측정 프로그램')} v={outdated ? `${hello!.fw} → ${BUNDLED_FW}` : `${hello!.fw} ✓`} ok={!outdated} />}
            {hello && <Row k={t('인식된 센서')} v={String(hello.sensors.length)} ok={hello.sensors.length > 0} />}
            <Row k={t('받은 점')} v={String(s.points)} ok={s.points > 0 || !running} />
            {age !== null && <Row k={t('마지막 값')} v={t('{n}초 전', { n: age.toFixed(0) })} ok={!stalled} />}
            {rate !== null && <Row k={t('실제 간격')} v={t('{n}초', { n: rate.toFixed(2) })} ok={rate < (intervalMs / 1000) * 1.5} />}
            <Row k={t('끊김 · 다시 연결')} v={`${s.drops} · ${s.reconnects}`} ok={s.drops === s.reconnects} />
          </tbody>
        </table>
        {advice.length > 0 && (<><h3>{t('이렇게 해 보세요')}</h3><ul>{advice.map((a) => <li key={a}><R t={a} /></li>)}</ul></>)}
        <div className="sheet-actions"><span /><button onClick={onClose}>{t('닫기')}</button></div>
      </div>
    </div>
  );
}
