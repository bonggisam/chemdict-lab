import { useMemo, useState } from 'react';
import { analogTypes, digitalTypes } from '../lib/sensors';
import { t } from '../lib/i18n';
import { customId, type CustomExp } from '../lib/custom';

/** 2.0: 선생님이 실험 만들기 — 제목·센서·간격·순서를 정하고 저장, 링크·QR로 나눔 */
export function ExperimentMaker({ initial, onSave, onShare, onClose }: {
  initial?: CustomExp; onSave: (x: CustomExp) => void; onShare: (x: CustomExp) => void; onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.t ?? '');
  const [sens, setSens] = useState<string[]>(initial?.s ?? []);
  const [iv, setIv] = useState(initial?.iv ?? 1000);
  const [steps, setSteps] = useState((initial?.st ?? []).join('\n'));
  const [mode, setMode] = useState<'time' | 'event'>(initial?.m ?? 'time');
  // 숫자 칸은 글자 그대로 두고 저장할 때 바꿈 (0.5·-2 같은 값을 칠 수 있게)
  const [ev, setEv] = useState(() => {
    const e = initial?.ev ?? { l: t('넣은 양'), u: 'mL', s: 0, d: 1 };
    return { l: e.l, u: e.u, s: String(e.s), d: String(e.d) };
  });
  const evNum = { l: ev.l.trim(), u: ev.u.trim(), s: Number(ev.s), d: Number(ev.d) };
  const evOk = !!evNum.l && Number.isFinite(evNum.s) && Number.isFinite(evNum.d) && evNum.d > 0;
  const [q, setQ] = useState('');
  const all = useMemo(() => [...digitalTypes, ...analogTypes].filter((s) => s.type !== 'OFF'), []);
  const found = all.filter((s) => !q || `${s.name} ${s.type} ${s.unit}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const x: CustomExp = { t: title.trim(), s: sens, iv, st: steps.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 30), ...(mode === 'event' ? { m: 'event' as const, ev: evNum } : {}) };
  const ok = x.t.length > 0 && sens.length > 0 && (mode === 'time' || evOk);
  const toggle = (ty: string) => setSens((a) => (a.includes(ty) ? a.filter((v) => v !== ty) : a.length < 8 ? [...a, ty] : a));
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet wide-sheet" role="dialog" aria-modal="true" aria-label={t('실험 만들기')} onClick={(e) => e.stopPropagation()}>
        <h2>✏️ {t('실험 만들기')}</h2>
        <p className="note">{t('만든 실험은 이 기기에 저장되고, 링크·QR로 학생에게 나눌 수 있습니다. 학생 이름 같은 정보는 담기지 않습니다.')}</p>
        <label className="field"><span>{t('실험 제목')}</span>
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder={t('예: 손난로 속 철가루의 산화 반응')} />
        </label>
        <div className="field"><span>{t('쓸 센서 (최대 8개)')}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('센서 이름으로 찾기')} aria-label={t('센서 찾기')} />
          <div className="chip-row">
            {sens.map((ty) => <button key={ty} className="on" onClick={() => toggle(ty)}>✓ {all.find((s) => s.type === ty)?.name ?? ty}</button>)}
          </div>
          <div className="chip-row scroll">
            {found.filter((s) => !sens.includes(s.type)).map((s) => <button key={s.type} onClick={() => toggle(s.type)}>{s.name}{s.unit ? ` (${s.unit})` : ''}</button>)}
          </div>
        </div>
        <div className="field-row">
          <label className="field"><span>{t('기록 방법')}</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as 'time' | 'event')}>
              <option value="time">{t('시간 기록 모드')}</option>
              <option value="event">{t('값 입력 모드')}</option>
            </select>
          </label>
          {mode === 'time' ? (
            <label className="field"><span>{t('측정 간격')}</span>
              <select value={iv} onChange={(e) => setIv(Number(e.target.value))}>
                {[100, 200, 500, 1000, 2000, 5000, 10000, 60000].map((m) => <option key={m} value={m}>{t('{n}초', { n: m / 1000 })}</option>)}
              </select>
            </label>
          ) : (
            <>
              <label className="field"><span>{t('입력값 이름')}</span><input value={ev.l} onChange={(e) => setEv({ ...ev, l: e.target.value })} /></label>
              <label className="field"><span>{t('단위')}</span><input value={ev.u} onChange={(e) => setEv({ ...ev, u: e.target.value })} /></label>
              <label className="field"><span>{t('시작')}</span><input inputMode="decimal" value={ev.s} onChange={(e) => setEv({ ...ev, s: e.target.value })} /></label>
              <label className="field"><span>{t('간격')}</span><input inputMode="decimal" value={ev.d} aria-invalid={!(Number(ev.d) > 0)} onChange={(e) => setEv({ ...ev, d: e.target.value })} /></label>
            </>
          )}
        </div>
        <label className="field"><span>{t('실험 순서 (한 줄에 하나)')}</span>
          <textarea rows={6} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={t('예: [측정 시작]을 누르고 시약을 넣습니다.')} />
        </label>
        <div className="sheet-actions">
          <button className="ghost" onClick={onClose}>{t('닫기')}</button>
          <button disabled={!ok} onClick={() => onShare(x)}>🔗 {t('저장하고 링크·QR')}</button>
          <button className="primary" disabled={!ok} onClick={() => onSave(x)}>{t('저장')}</button>
        </div>
        <p className="note">id: {ok ? customId(x) : '—'}</p>
      </div>
    </div>
  );
}
