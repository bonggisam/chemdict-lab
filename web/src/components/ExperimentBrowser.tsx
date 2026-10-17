import { useMemo, useState } from 'react';
import type { Experiment } from '../lib/protocol';
import { typeInfo } from '../lib/sensors';
import { breadboardFor } from '../lib/guide';
import { t } from '../lib/i18n';
import { areaName, courseName, levelName } from '../lib/l10n';

const LEVELS = ['전체', '중학교', '고1 공통', '고2·3 선택'] as const;
type Level = typeof LEVELS[number];
const KEY = 'chemdict.expLevel';

interface Props {
  experiments: Experiment[];
  connectedTypes?: string[];       // 연결된 센서 종류 → '바로 가능' 표시
  selectedId?: string;
  onPick: (e: Experiment) => void;
}

const levelOf = (e: Experiment) => e.level ?? '공통';
const sensorNames = (e: Experiment) => e.sensors.includes('*') ? t('모든 센서') : e.sensors.map((ty) => typeInfo(ty)?.name ?? ty).join(' · ');

/** 실험으로 찾기: 학교급 → 과목 → 검색. 교과서(출판사) 표시 */
export function ExperimentBrowser({ experiments, connectedTypes, selectedId, onPick }: Props) {
  const [level, setLevel] = useState<Level>(() => { try { return (localStorage.getItem(KEY) as Level) ?? '전체'; } catch { return '전체'; } });
  const [course, setCourse] = useState('전체');
  const [q, setQ] = useState('');
  const pickLevel = (l: Level) => { setLevel(l); setCourse('전체'); try { localStorage.setItem(KEY, l); } catch { /* noop */ } };

  const byLevel = experiments.filter((e) => level === '전체' || levelOf(e) === level || levelOf(e) === '공통');
  const courses = useMemo(() => {
    const out: string[] = [];
    for (const e of byLevel) if (e.course && !out.includes(e.course)) out.push(e.course);
    return out;
  }, [byLevel]);
  const query = q.trim().toLowerCase();
  const list = byLevel
    .filter((e) => course === '전체' || e.course === course)
    .filter((e) => !query || [e.title, e.subject, e.course, e.area, courseName(e.course), areaName(e.area), e.summary, ...e.standards, ...(e.textbooks ?? []).map((t) => t.publisher), sensorNames(e)]
      .some((s) => s?.toLowerCase().includes(query)));

  const ready = (e: Experiment) => !!connectedTypes && (e.sensors.includes('*') || e.sensors.every((t) => connectedTypes.includes(t)));

  return (
    <div className="exp-browser">
      <div className="seg level-seg" role="tablist" aria-label={t('학교급')}>
        {LEVELS.map((l) => (
          <button key={l} role="tab" aria-selected={l === level} className={l === level ? 'on' : ''} onClick={() => pickLevel(l)}>{l === '전체' ? t('전체') : levelName(l)}</button>
        ))}
      </div>
      <div className="exp-filter">
        {courses.length > 1 && (
          <div className="cat-chips" role="tablist" aria-label={t('과목')}>
            {['전체', ...courses].map((c) => (
              <button key={c} role="tab" aria-selected={c === course} className={c === course ? 'on' : ''} onClick={() => setCourse(c)}>{c === '전체' ? t('전체') : courseName(c)}</button>
            ))}
          </div>
        )}
        <input type="search" className="exp-search" placeholder={t('실험·센서·성취기준·출판사 찾기')} aria-label={t('실험 찾기')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="note">{t('{n}개 실험', { n: list.length })}</p>
      <div className="cards">
        {list.map((e) => (
          <button key={e.id} className={`card exp-card ${e.id === selectedId ? 'on' : ''}`} onClick={() => onPick(e)}>
            <span className="subject">{e.course ? courseName(e.course) : e.subject}{e.area ? ` · ${areaName(e.area)}` : ''}{e.mode === 'event' ? ` · ${t('값 입력')}` : ''}</span>
            <b>{e.title}</b>
            {e.summary && <span className="sum">{e.summary}</span>}
            <span className="need">{sensorNames(e)}</span>
            {e.standards.length > 0 && <span className="codes">{e.standards.map((s) => `[${s}]`).join(' ')}</span>}
            <span className="badges">
              {connectedTypes && (ready(e) ? <span className="badge ok">{t('✓ 바로 측정')}</span> : <span className="badge">{t('센서 연결 필요')}</span>)}
              {breadboardFor(e)?.need === 'required' && <span className="badge bb">{t('브레드보드')}</span>}
              {e.textbooks?.length ? <span className="badge pub" title={e.textbooks.map((tb) => `${tb.publisher} ${tb.course}: ${tb.note}`).join('\n')}>{t('교과서 {list}', { list: [...new Set(e.textbooks.map((tb) => tb.publisher))].join('·') })}</span> : null}
            </span>
          </button>
        ))}
      </div>
      {!list.length && <p className="note">{t("찾는 실험이 없습니다. 검색어를 바꾸거나 '전체'를 눌러 보세요.")}</p>}
    </div>
  );
}
