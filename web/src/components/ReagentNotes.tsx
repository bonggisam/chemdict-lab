import { useState } from 'react';
import { reagentsFor, type Reagent } from '../lib/reagents';
import { c, t } from '../lib/i18n';
import { R } from './Rich';

/** 실험 준비물에 들어 있는 시약의 설명·주의·조제 방법 (교사용) */
export function ReagentNotes({ materials }: { materials: string[] }) {
  const list = reagentsFor(materials);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!list.length) return null;
  return (
    <section className="reagents" data-nav={t('시약·약품')}>
      <h2><span className="ico" aria-hidden="true">🧪</span>{t('시약·약품')} <small className="note">{t('{n}가지 · 교사용: 위험·조제·보관·폐기', { n: list.length })}</small></h2>
      <div className="reagent-chips" role="tablist">
        {list.map((r) => (
          <button key={r.id} role="tab" aria-selected={openId === r.id} className={`chip-btn ${openId === r.id ? 'on' : ''} ${(r.hazard?.length ?? 0) > 0 ? 'haz' : ''}`} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
            {r.ghs ? <span className="ghs" aria-hidden="true">⚠</span> : null}{c(`reagent.${r.id}.name`, r.name)}{r.formula ? <small> {r.formula}</small> : null}
          </button>
        ))}
      </div>
      {list.filter((r) => r.id === openId).map((r) => <ReagentCard key={r.id} r={r} />)}
      <p className="note">{t('농도와 조제법은 학교 과학실 안전 매뉴얼과 시약의 MSDS를 함께 확인하세요. 학생은 묽은 용액만 다루고, 진한 산·염기는 교사가 조제합니다.')}</p>
    </section>
  );
}

function ReagentCard({ r }: { r: Reagent }) {
  const k = `reagent.${r.id}`;
  const L = (field: string, arr?: string[]) => (arr ?? []).map((x, i) => c(`${k}.${field}.${i}`, x));
  const hazard = L('hazard', r.hazard), ppe = L('ppe', r.ppe), handling = L('handling', r.handling);
  const steps = L('prep.steps', r.prep?.steps), notes = L('prep.notes', r.prep?.notes);
  const fa = r.firstAid;
  return (
    <div className="reagent-card" role="tabpanel">
      <div className="reagent-head">
        <b>{c(`${k}.name`, r.name)}</b>{r.formula && <code>{r.formula}</code>}
        {r.ghs && <span className="badge ghs-badge">{c(`${k}.ghs`, r.ghs)}</span>}
        {r.studentLimit && <span className="badge limit">{c(`${k}.studentLimit`, r.studentLimit)}</span>}
      </div>
      {r.useIn && <p className="note">{c(`${k}.useIn`, r.useIn)}</p>}
      <div className="reagent-grid">
        {hazard.length ? <div><h4>{t('위험')}</h4><ul>{hazard.map((x) => <li key={x}><R t={x} /></li>)}</ul></div> : null}
        {ppe.length ? <div><h4>{t('보호구')}</h4><ul>{ppe.map((x) => <li key={x}>{x}</li>)}</ul></div> : null}
        {steps.length ? (
          <div className="wide">
            <h4>{t('조제 방법')}{r.prep?.target ? ` — ${c(`${k}.prep.target`, r.prep.target)}` : ''}</h4>
            <ol>{steps.map((x) => <li key={x}><R t={x} /></li>)}</ol>
            {notes.length ? <ul className="note-list">{notes.map((x) => <li key={x}><R t={x} /></li>)}</ul> : null}
          </div>
        ) : null}
        {handling.length ? <div><h4>{t('다룰 때')}</h4><ul>{handling.map((x) => <li key={x}><R t={x} /></li>)}</ul></div> : null}
        {(r.storage || r.disposal) && (
          <div><h4>{t('보관·폐기')}</h4><ul>
            {r.storage && <li><b>{t('보관')}</b> <R t={c(`${k}.storage`, r.storage)} /></li>}
            {r.disposal && <li><b>{t('폐기')}</b> <R t={c(`${k}.disposal`, r.disposal)} /></li>}
          </ul></div>
        )}
        {fa && (
          <div className="wide"><h4>{t('응급 처치')}</h4><ul>
            {fa.skin && <li><b>{t('피부')}</b> {c(`${k}.firstAid.skin`, fa.skin)}</li>}
            {fa.eye && <li><b>{t('눈')}</b> {c(`${k}.firstAid.eye`, fa.eye)}</li>}
            {fa.swallow && <li><b>{t('삼킴')}</b> {c(`${k}.firstAid.swallow`, fa.swallow)}</li>}
            {fa.inhale && <li><b>{t('흡입')}</b> {c(`${k}.firstAid.inhale`, fa.inhale)}</li>}
          </ul></div>
        )}
      </div>
    </div>
  );
}
