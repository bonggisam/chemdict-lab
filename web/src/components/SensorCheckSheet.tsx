import { useEffect, useState } from 'react';
import { c, t } from '../lib/i18n';
import type { ResolvedSensor } from '../lib/sensors';
import { fmtValue } from '../lib/sensors';
import { checkFor, checkKey, isPoint, judge, stats, type RefSituation } from '../lib/sensorChecks';
import { R } from './Rich';

interface Props {
  sensors: ResolvedSensor[];
  initialId?: string;
  recent: (id: string) => number[];      // 최근 값 (최신이 마지막)
  running: boolean;
  onOpenCal: (id: string) => void;
  onClose: () => void;
}

/** 센서 점검: 사양 → 지금 값(평균·흔들림) → 기준 상황과 비교해 오차·통과 → 정상 작동 테스트 */
export function SensorCheckSheet({ sensors, initialId, recent, running, onOpenCal, onClose }: Props) {
  const list = sensors.filter((s) => checkKey(s.type));
  const [id, setId] = useState(initialId && list.some((s) => s.id === initialId) ? initialId : list[0]?.id ?? '');
  const [refIdx, setRefIdx] = useState(0);
  const [custom, setCustom] = useState({ expect: '', tol: '' });
  const [done, setDone] = useState<Record<number, boolean>>({});
  useEffect(() => { setRefIdx(0); setCustom({ expect: '', tol: '' }); setDone({}); }, [id]);

  const s = list.find((x) => x.id === id);
  const chk = s ? checkFor(s.type) : null;
  const key = s ? checkKey(s.type) : null;
  const unit = s?.displayUnit ?? '';
  const dec = s?.decimals ?? 2;

  if (!s || !chk || !key) {
    return (
      <div className="sheet-backdrop" onClick={onClose}>
        <div className="sheet" role="dialog" aria-modal="true" aria-label={t('센서 점검')} onClick={(e) => e.stopPropagation()}>
          <h2>{t('센서 점검')}</h2>
          <p>{t('점검 정보가 있는 센서가 연결되어 있지 않습니다.')}</p>
          <div className="sheet-actions"><span /><button onClick={onClose}>{t('닫기')}</button></div>
        </div>
      </div>
    );
  }

  const k = `check.${key}`;
  const vals = recent(id);
  const st = stats(vals);
  const f = (x: number | undefined) => fmtValue(x, dec);
  const refs: RefSituation[] = chk.refs;
  const cx = Number(custom.expect), ct = Number(custom.tol);
  const customRef: RefSituation | null = custom.expect !== '' && Number.isFinite(cx) ? { situation: t('직접 입력'), expect: cx, tol: custom.tol !== '' && Number.isFinite(ct) ? ct : 0 } : null;
  const ref: RefSituation | null = refIdx === -1 ? customRef : refs[refIdx] ?? null;
  const v = st && ref ? judge(st.mean, ref, dec) : null;
  const hasCal = !!(s.spec && s.spec.cal.kind !== 'none');
  const tests = chk.test.map((x, i) => c(`${k}.test.${i}`, x));
  const nDone = Object.values(done).filter(Boolean).length;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet sheet-wide check-sheet" role="dialog" aria-modal="true" aria-label={t('센서 점검')} onClick={(e) => e.stopPropagation()}>
        <h2>🔎 {t('센서 점검 · 오차')}</h2>
        <label className="field">
          <span>{t('센서')}</span>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            {list.map((x) => <option key={x.id} value={x.id}>{x.displayName}</option>)}
          </select>
        </label>

        <dl className="spec-grid">
          <dt>{t('측정 범위')}</dt><dd>{c(`${k}.range`, chk.range)}</dd>
          <dt>{t('정확도')}</dt><dd><b>{c(`${k}.accuracy`, chk.accuracy)}</b></dd>
          <dt>{t('분해능')}</dt><dd>{c(`${k}.resolution`, chk.resolution)}</dd>
          <dt>{t('반응 시간')}</dt><dd>{c(`${k}.response`, chk.response)}</dd>
        </dl>

        <div className="cal-live">
          <span>{t('지금 값')}</span>
          <b>{f(st?.mean)}{unit ? ` ${unit}` : ''}</b>
          {st && st.n > 1 ? <span className="note">{t('최근 {n}개 평균 · 흔들림 ±{sd}', { n: st.n, sd: f(st.sd) })} ({f(st.min)} ~ {f(st.max)})</span>
            : running ? <span className="note">{t('값을 모으는 중…')}</span> : <span className="note">{t('측정을 시작해야 값이 보입니다')}</span>}
        </div>

        <h3>{t('기준 상황과 비교')}</h3>
        <p className="note"><R t={t('센서를 아래 상황 중 하나에 두고 값이 안정되면 고르세요. 오차 = 측정값 − 기준값.')} /></p>
        <ul className="ref-list">
          {refs.map((r, i) => (
            <li key={i} className={refIdx === i ? 'on' : ''}>
              <label>
                <input type="radio" name="ref" checked={refIdx === i} onChange={() => setRefIdx(i)} />
                <span className="ref-sit">{c(`${k}.ref.${i}`, r.situation)}</span>
                <span className="ref-val k-num">{isPoint(r) ? `${r.expect} ± ${r.tol}` : `${r.min} ~ ${r.max}`}{unit ? ` ${unit}` : ''}</span>
                {r.note && <small className="note">{c(`${k}.ref.${i}.note`, r.note)}</small>}
              </label>
            </li>
          ))}
          <li className={refIdx === -1 ? 'on' : ''}>
            <label>
              <input type="radio" name="ref" checked={refIdx === -1} onChange={() => setRefIdx(-1)} />
              <span className="ref-sit">{t('직접 입력')}</span>
              <span className="ref-input">
                <input inputMode="decimal" placeholder={t('기준값')} value={custom.expect} onFocus={() => setRefIdx(-1)} onChange={(e) => setCustom({ ...custom, expect: e.target.value })} aria-label={t('기준값')} />
                ±
                <input inputMode="decimal" placeholder={t('허용 오차')} value={custom.tol} onFocus={() => setRefIdx(-1)} onChange={(e) => setCustom({ ...custom, tol: e.target.value })} aria-label={t('허용 오차')} />
                {unit}
              </span>
            </label>
          </li>
        </ul>

        {v && st && ref && (
          <div className={`verdict ${v.pass ? 'pass' : 'fail'}`} role="status">
            <div className="verdict-head">{v.pass ? '✓ ' + t('통과 — 허용 오차 안입니다') : '✗ ' + t('허용 오차를 벗어났습니다')}</div>
            <dl>
              <dt>{t('측정 평균')}</dt><dd>{f(st.mean)} {unit}</dd>
              <dt>{t('기준')}</dt><dd>{v.target} {unit}</dd>
              <dt>{t('오차')}</dt><dd><b>{v.err > 0 ? '+' : ''}{f(v.err)} {unit}</b>{v.rel !== undefined && Math.abs(v.rel) < 1000 ? ` (${v.rel > 0 ? '+' : ''}${v.rel.toFixed(1)} %)` : ''}</dd>
              <dt>{t('흔들림')}</dt><dd>±{f(st.sd)} {unit}</dd>
            </dl>
            {!v.pass && (
              <p className="note">
                <R t={t('기준 상황이 맞는지(온도 평형·안정 시간) 먼저 확인하고, 그래도 벗어나면 [센서 보정]을 하거나 연결·센서를 확인하세요.')} />
                {hasCal && <> <button className="link" onClick={() => onOpenCal(id)}>{t('센서 보정')}</button></>}
              </p>
            )}
          </div>
        )}
        <p className="note"><R t={c(`${k}.errorNote`, chk.errorNote)} /></p>

        <h3>{t('정상 작동 테스트')} <small className="note">{nDone}/{tests.length}</small></h3>
        <ol className="check-steps">
          {tests.map((x, i) => (
            <li key={i} className={done[i] ? 'done' : ''}>
              <label><input type="checkbox" checked={!!done[i]} onChange={(e) => setDone({ ...done, [i]: e.target.checked })} /> <R t={x} /></label>
            </li>
          ))}
        </ol>
        {nDone === tests.length && <p className="ok-note">✓ {t('모든 테스트를 통과했습니다. 측정을 시작하세요.')}</p>}

        <details className="advanced">
          <summary>{t('고장 신호와 원인')}</summary>
          <ul className="pc-mistakes">{chk.fail.map((x, i) => <li key={i}><R t={c(`${k}.fail.${i}`, x)} /></li>)}</ul>
        </details>

        <div className="sheet-actions">
          {hasCal ? <button className="ghost" onClick={() => onOpenCal(id)}>{t('센서 보정')}</button> : <span />}
          <button onClick={onClose}>{t('닫기')}</button>
        </div>
      </div>
    </div>
  );
}
