import { useMemo, useState } from 'react';
import type { Experiment, TextbookRef } from '../lib/protocol';
import { typeInfo } from '../lib/sensors';
import { breadboardFor } from '../lib/guide';
import { t } from '../lib/i18n';
import { areaName, courseName, levelName } from '../lib/l10n';

const LEVELS = ['중학교', '고1 공통', '고2·3 선택'] as const;
const KEY = 'chemdict.expPick';

interface Props {
  experiments: Experiment[];
  connectedTypes?: string[];       // 연결된 센서 종류 → '바로 가능' 표시
  selectedId?: string;
  onPick: (e: Experiment) => void;
}

const levelOf = (e: Experiment) => e.level ?? '공통';
const sensorNames = (e: Experiment) => e.sensors.includes('*') ? t('모든 센서') : e.sensors.map((ty) => typeInfo(ty)?.name ?? ty).join(' · ');
/** 출판사 이름에서 저자 괄호를 뗀 이름 (천재교과서(임성숙) → 천재교과서) */
export const pubBase = (p: string) => p.replace(/\s*\(.*\)$/, '');
const refText = (tb: TextbookRef) => tb.activity ? `${tb.page ? `${tb.page}${/^\d/.test(tb.page) ? '쪽' : ''} ` : ''}${tb.activity}` : tb.note;

/** 교과서 단원 이름에서 대단원만: 'Ⅵ. 동물과 에너지/1. 소화와 순환' → '동물과 에너지' */
const unitName = (u?: string) => (u ?? '').split(/\s*[/>]\s*/)[0].replace(/^\s*([IVXⅠ-Ⅻ]+|\d+)\.?\s*/, '').trim();
/** 실험이 실린 과목들: 원래 과목 + 같은 활동이 실린 다른 과목 */
const placesOf = (e: Experiment) => {
  const out: { level: string; course: string; area: string }[] = [];
  if (e.course) out.push({ level: levelOf(e), course: e.course, area: e.area ?? '' });
  for (const tb of e.textbooks ?? []) {
    if (!tb.level || out.some((p) => p.course === tb.course)) continue;
    out.push({ level: tb.level, course: tb.course, area: unitName(tb.unit) });
  }
  return out;
};

type Pick = { level: string; course: string };
const loadPick = (): Pick => { try { return JSON.parse(localStorage.getItem(KEY) ?? '') as Pick; } catch { return { level: '', course: '' }; } };

/** 실험으로 찾기: 왼쪽 과정 → 과목 나무, 오른쪽 단원별 실험 (출판사·쪽수) */
export function ExperimentBrowser({ experiments, connectedTypes, selectedId, onPick }: Props) {
  const [pick, setPickState] = useState<Pick>(loadPick);
  const setPick = (p: Pick) => { setPickState(p); try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* noop */ } };
  const [pub, setPub] = useState('');          // '' = 모든 출판사
  const [onlyBook, setOnlyBook] = useState(false);
  const [q, setQ] = useState('');

  // 과정 → 과목 (실험 수)
  const tree = useMemo(() => LEVELS.map((lv) => {
    const courses: { name: string; n: number }[] = [];
    for (const e of experiments) {
      for (const pl of placesOf(e)) {
        if (pl.level !== lv) continue;
        const c = courses.find((x) => x.name === pl.course);
        if (c) c.n++; else courses.push({ name: pl.course, n: 1 });
      }
    }
    return { level: lv, courses, n: experiments.filter((e) => placesOf(e).some((p) => p.level === lv)).length };
  }), [experiments]);
  const publishers = useMemo(() => [...new Set(experiments.flatMap((e) => (e.textbooks ?? []).map((tb) => pubBase(tb.publisher))))].sort(), [experiments]);

  const query = q.trim().toLowerCase();
  const refsOf = (e: Experiment) => (e.textbooks ?? [])
    .filter((tb) => !pub || pubBase(tb.publisher) === pub)
    .sort((a, b) => Number(b.course === pick.course) - Number(a.course === pick.course));
  const placeIn = (e: Experiment) => placesOf(e).find((p) => (!pick.level || p.level === pick.level) && (!pick.course || p.course === pick.course));
  const list = experiments
    .filter((e) => !pick.level ? true : !!placeIn(e) || (levelOf(e) === '공통' && !pick.course))
    .filter((e) => (!pub && !onlyBook) || refsOf(e).some((tb) => tb.sure !== 'similar'))
    .filter((e) => !query || [e.title, e.subject, e.course, e.area, courseName(e.course), areaName(e.area), e.summary, ...e.standards, ...(e.textbooks ?? []).flatMap((tb) => [tb.publisher, tb.activity ?? '', tb.note]), sensorNames(e)]
      .some((s) => s?.toLowerCase().includes(query)));

  // 단원(area)별로 묶기 — 과목을 고르지 않았으면 과목 · 단원으로
  const groups: { key: string; title: string; items: Experiment[] }[] = [];
  for (const e of list) {
    const pl = placeIn(e) ?? { course: e.course ?? '', area: e.area ?? '' };
    const area = pl.area === e.area ? areaName(e.area) : pl.area;
    const key = pick.course ? area : `${pl.course}|${area}`;
    const title = pick.course ? area || t('기타') : [courseName(pl.course), area].filter(Boolean).join(' · ') || t('기타');
    const g = groups.find((x) => x.key === key);
    if (g) g.items.push(e); else groups.push({ key, title, items: [e] });
  }

  const ready = (e: Experiment) => !!connectedTypes && (e.sensors.includes('*') || e.sensors.every((ty) => connectedTypes.includes(ty)));
  const here = pick.course ? courseName(pick.course) : pick.level ? levelName(pick.level) : t('전체');

  return (
    <div className="exp-browser two-pane">
      <nav className="exp-tree" aria-label={t('과정·과목')}>
        <button className={!pick.level ? 'on' : ''} aria-current={!pick.level ? 'true' : undefined} onClick={() => setPick({ level: '', course: '' })}>
          <span>{t('전체')}</span><small>{experiments.length}</small>
        </button>
        {tree.map((lv) => (
          <div key={lv.level} className="exp-tree-lv">
            <button className={`lv ${pick.level === lv.level && !pick.course ? 'on' : ''}`} aria-expanded={pick.level === lv.level}
              onClick={() => setPick({ level: lv.level, course: '' })}>
              <span>{levelName(lv.level)}</span><small>{lv.n}</small>
            </button>
            {pick.level === lv.level && (
              <ul>
                {lv.courses.map((c) => (
                  <li key={c.name}>
                    <button className={pick.course === c.name ? 'on' : ''} aria-current={pick.course === c.name ? 'true' : undefined}
                      onClick={() => setPick({ level: lv.level, course: c.name })}>
                      <span>{courseName(c.name)}</span><small>{c.n}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </nav>

      <div className="exp-main">
        <div className="exp-filter">
          <div className="cat-chips" role="radiogroup" aria-label={t('출판사')}>
            {['', ...publishers].map((p) => (
              <button key={p || 'all'} role="radio" aria-checked={pub === p} className={pub === p ? 'on' : ''} onClick={() => setPub(p)}>{p || t('모든 출판사')}</button>
            ))}
          </div>
          <label className="switch">
            <input type="checkbox" checked={onlyBook} onChange={(e) => setOnlyBook(e.target.checked)} />
            <span>{t('교과서에 실린 실험만')}</span>
          </label>
          <input type="search" className="exp-search" placeholder={t('실험·센서·성취기준·출판사 찾기')} aria-label={t('실험 찾기')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="note"><b>{here}</b> · {t('{n}개 실험', { n: list.length })}</p>

        {groups.map((g) => (
          <section key={g.key} className="exp-group">
            <h3>{g.title} <small>{g.items.length}</small></h3>
            <div className="cards">
              {g.items.map((e) => {
                const refs = refsOf(e);
                return (
                  <button key={e.id} className={`card exp-card ${e.id === selectedId ? 'on' : ''}`} onClick={() => onPick(e)}>
                    <span className="subject">{e.course ? courseName(e.course) : e.subject}{e.mode === 'event' ? ` · ${t('값 입력')}` : ''}</span>
                    <b>{e.title}</b>
                    {e.summary && <span className="sum">{e.summary}</span>}
                    <span className="need">{sensorNames(e)}</span>
                    {e.standards.length > 0 && <span className="codes">{e.standards.map((s) => `[${s}]`).join(' ')}</span>}
                    {refs.length > 0 && (
                      <ul className="tb-refs">
                        {refs.slice(0, 3).map((tb, i) => (
                          <li key={i} className={tb.sure}>
                            <b>{tb.publisher}</b> {refText(tb)}{tb.uses ? <span className="tb-sensor"> · {t('센서 사용')}</span> : null}
                          </li>
                        ))}
                        {refs.length > 3 && <li className="more">{t('외 {n}곳', { n: refs.length - 3 })}</li>}
                      </ul>
                    )}
                    <span className="badges">
                      {connectedTypes && (ready(e) ? <span className="badge ok">{t('✓ 바로 측정')}</span> : <span className="badge">{t('센서 연결 필요')}</span>)}
                      {breadboardFor(e)?.need === 'required' && <span className="badge bb">{t('브레드보드')}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {!list.length && <p className="note">{t("찾는 실험이 없습니다. 검색어를 바꾸거나 '전체'를 눌러 보세요.")}</p>}
      </div>
    </div>
  );
}
