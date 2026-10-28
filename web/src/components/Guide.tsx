import { useMemo, useState } from 'react';
import type { Experiment } from '../lib/protocol';
import type { ResolvedSensor } from '../lib/sensors';
import { breadboardFor, commonRules, partById, partsFor, planned, troubles, type Board, type Part } from '../lib/guide';
import { BreadboardGuide } from './Breadboard';
import { BreadboardNote } from './PartWiring';
import { PartWiring } from './PartWiring';
import { SensorPicker } from './SensorPicker';
import { ExperimentBrowser } from './ExperimentBrowser';
import { t, tk } from '../lib/i18n';
import { areaName, courseName, levelName } from '../lib/l10n';
import { R } from './Rich';
import { ReagentNotes } from './ReagentNotes';
import { PartsHelper } from './PartsHelper';

const SET_LABEL = { full: tk('모든 센서'), lite: tk('가벼운 버전'), mini: tk('가장 가벼운 버전'), none: '' } as const;

interface Props {
  experiments: Experiment[];
  board: Board;
  initialExpId?: string;
  initialPartId?: string;        // 바로 측정에서 온 경우 그 센서 연결을 바로 보여 줌
  initialTab?: 'wire' | 'help' | 'tools';
  sensors: ResolvedSensor[];
  connected: boolean;
  onRescan: () => void;
  onChangeBoard: () => void;
  onBack?: () => void;
  backLabel?: string;
}

/** 3단계: 센서 연결 방법 + 문제 해결 */
export function Guide({ experiments, board, initialExpId, initialPartId, initialTab, sensors, connected, onRescan, onChangeBoard, onBack, backLabel }: Props) {
  const [tab, setTab] = useState<'wire' | 'help' | 'tools'>(initialTab ?? 'wire');
  const [by, setBy] = useState<'sensor' | 'exp' | 'bb'>(initialExpId && !initialPartId ? 'exp' : 'sensor');
  const [partId, setPartId] = useState<string | undefined>(initialPartId);
  const [expId, setExpId] = useState(initialExpId ?? experiments.find((e) => e.setup)?.id ?? experiments[0]?.id);
  const exp = experiments.find((e) => e.id === expId) ?? experiments[0];
  const setup = exp?.setup;
  const expParts = useMemo(() => (exp ? partsFor(exp.sensors.filter((s) => s !== '*'), setup?.parts) : []), [exp, setup]);
  const [expPart, setExpPart] = useState<string | undefined>();
  const chosenExpPart = setup?.choose ? (expParts.find((p) => p.id === expPart) ?? expParts[0]) : undefined;

  const shown: Part[] = by === 'bb' ? [] : by === 'sensor'
    ? [partById(partId ?? '')].filter((p): p is Part => !!p)
    : chosenExpPart ? [chosenExpPart] : expParts;

  const connectedTypes = sensors.filter((s) => s.src !== 'demo').map((s) => s.type);

  return (
    <main className="wide guide step-page">
      <div className="row-head">
        <h1><span className="step-no">3</span>{t('연결 방법 · 문제 해결')}</h1>
        {onBack && <button className="ghost" onClick={onBack}>← {backLabel}</button>}
      </div>
      <div className="seg big-seg" role="tablist" aria-label={t('도움말')}>
        <button role="tab" aria-selected={tab === 'wire'} className={tab === 'wire' ? 'on' : ''} onClick={() => setTab('wire')}>{t('센서 연결 방법')}</button>
        <button role="tab" aria-selected={tab === 'help'} className={tab === 'help' ? 'on' : ''} onClick={() => setTab('help')}>{t('문제 해결')}</button>
        <button role="tab" aria-selected={tab === 'tools'} className={tab === 'tools' ? 'on' : ''} onClick={() => setTab('tools')}>🧰 {t('부품 도우미')}</button>
      </div>

      {tab === 'tools' && <PartsHelper board={board} onOpenPart={(p) => { setTab('wire'); setBy('sensor'); setPartId(p.id); setTimeout(() => document.querySelector('.part-wiring')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }} />}

      {tab === 'help' && (
        <section className="guide-block troubles">
          <p className="note">{t('증상을 누르면 차례로 해 볼 일이 나옵니다.')}</p>
          {troubles.map((tr) => (
            <details key={tr.id} className="trouble">
              <summary>{tr.title}</summary>
              <ol>{tr.steps.map((s) => <li key={s}><R t={s} /></li>)}</ol>
            </details>
          ))}
        </section>
      )}

      {tab === 'wire' && <>
      <section className="guide-block">
        <div className="row-head sub">
          <h2>{t('보드: {name}', { name: board.name })}</h2>
          <button className="ghost" onClick={onChangeBoard}>{t('보드 바꾸기 (1단계)')}</button>
        </div>
        <details className="advanced">
          <summary>{t('보드 정보')}</summary>
          <dl className="board-facts">
            <div><dt>USB</dt><dd>{board.usb}</dd></div>
            <div><dt>{t('블루투스')}</dt><dd>{board.ble ? t('있음') : t('없음 (USB만)')}</dd></div>
            <div><dt>{t('핀 전압')}</dt><dd>{board.logic}</dd></div>
            <div><dt>{t('아날로그')}</dt><dd>{board.adc}</dd></div>
            <div><dt>Qwiic</dt><dd>{board.qwiic}</dd></div>
            <div><dt>{t('I2C 핀')}</dt><dd>{board.pins.SDA} · {board.pins.SCL}</dd></div>
          </dl>
          <p className={`note ${board.firmware === 'verified' ? '' : 'warn'}`}>
            {board.firmwareNote}{board.sensorSet !== 'none' && board.sensorSet !== 'full' ? ` (${t(SET_LABEL[board.sensorSet])})` : ''}
          </p>
          {board.notes.length > 0 && <ul className="board-notes">{board.notes.map((n) => <li key={n}><R t={n} /></li>)}</ul>}
        </details>
      </section>

      <section className="guide-block">
        <h2>{t('연결 전 공통 규칙')}</h2>
        <ul className="rules">{commonRules.map((r) => <li key={r}><R t={r} /></li>)}</ul>
      </section>

      <section className="guide-block">
        <div className="row-head sub">
          <h2>{t('센서 고르기')}</h2>
          <div className="seg" role="tablist" aria-label={t('찾는 방법')}>
            <button role="tab" aria-selected={by === 'sensor'} className={by === 'sensor' ? 'on' : ''} onClick={() => setBy('sensor')}>{t('센서로 찾기')}</button>
            <button role="tab" aria-selected={by === 'exp'} className={by === 'exp' ? 'on' : ''} onClick={() => setBy('exp')}>{t('실험으로 찾기')}</button>
            <button role="tab" aria-selected={by === 'bb'} className={by === 'bb' ? 'on' : ''} onClick={() => setBy('bb')}>{t('브레드보드')}</button>
          </div>
        </div>
        {by === 'bb' ? (
          <BreadboardGuide experiments={experiments.flatMap((e) => { const b = breadboardFor(e); return b ? [{ id: e.id, title: e.title, why: b.why, need: b.need, course: e.course }] : []; }).sort((a, b) => (a.need === b.need ? 0 : a.need === 'required' ? -1 : 1))} />
        ) : by === 'sensor' ? (
          <SensorPicker board={board} connectedTypes={connectedTypes} onPick={(p) => setPartId(p.id)} />
        ) : (
          <>
            <ExperimentBrowser experiments={experiments.filter((e) => !e.sensors.includes('*'))} selectedId={exp?.id} onPick={(e) => { setExpId(e.id); setExpPart(undefined); setTimeout(() => document.getElementById('exp-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }} />
            {exp && (
              <div className="exp-detail" id="exp-detail">
                <h3>{exp.title}</h3>
                <p className="note">{[levelName(exp.level), courseName(exp.course), areaName(exp.area)].filter(Boolean).join(' · ')}</p>
                {exp.standards.map((s, i) => <p key={s} className="std"><b>[{s}]</b> {exp.standardTexts?.[i] ?? ''}</p>)}
                {(() => { const b = breadboardFor(exp); return b ? <BreadboardNote need={b.need} why={b.why} circuit={b.circuit} /> : null; })()}
                {exp.textbooks?.length ? (
                  <ul className="pubs">{exp.textbooks.map((tb, i) => <li key={i}><b>{tb.publisher}</b> {tb.course} — {tb.note}{tb.sure !== 'confirmed' ? ` (${tb.sure === 'mentioned' ? t('자료 언급') : t('비슷한 활동')})` : ''}</li>)}</ul>
                ) : null}
                {exp.textbooks?.length || exp.standards.length ? <p className="note">{t('교과서 쪽수·활동 이름은 수업 준비를 돕는 참고 정보입니다. 각 출판사와 관계없는 독립 앱입니다. 성취기준: 2022 개정 교육과정(교육부 고시).')}</p> : null}
              </div>
            )}
            {setup?.choose && (
              <div className="part-pick" role="radiogroup" aria-label={t('센서 종류')}>
                <span className="note">{t('가진 센서를 고르세요')}</span>
                {expParts.map((p) => (
                  <button key={p.id} role="radio" aria-checked={p.id === chosenExpPart?.id} className={p.id === chosenExpPart?.id ? 'on' : ''} onClick={() => setExpPart(p.id)}>{p.name}</button>
                ))}
              </div>
            )}
          </>
        )}
        {by === 'sensor' && !partId && <p className="note">{t('위에서 센서를 누르면 아래에 연결 방법이 나옵니다.')}</p>}
        {by !== 'bb' && <p className="note">{t('준비 중: {list}', { list: planned.join(', ') })}</p>}
      </section>

      {shown.map((p, i) => {
        const found = p.analogType ? null : p.provides.every((ty) => connectedTypes.includes(ty));
        return (
          <section key={p.id} className="guide-block" id={`part-${p.id}`}>
            <h2>{t('{name} 연결', { name: p.name })}</h2>
            <PartWiring board={board} part={p} />
            {found !== null && (
              <div className="detect">
                {connected
                  ? (found ? <span className="ok-note">{t('✓ 인식됨')}</span> : <span className="warn-text">{t('아직 인식되지 않았습니다.')}</span>)
                  : <span className="note">{t('보드를 연결하면 인식 여부가 여기에 표시됩니다.')}</span>}
                {connected && <button onClick={onRescan}>{t('센서 다시 찾기')}</button>}
              </div>
            )}
            {p.analogType && <p className="note">{t("아날로그 센서는 '실험' 화면에서 이 센서를 누르면 포트가 자동으로 설정됩니다.")}</p>}
          </section>
        );
      })}

      {by === 'exp' && setup && (
        <section className="guide-block">
          <h2>{t('실험 장치에 붙이기')}</h2>
          {setup.materials.length > 0 && <><h3>{t('준비물')}</h3><ul>{setup.materials.map((m) => <li key={m}><R t={m} /></li>)}</ul><ReagentNotes materials={setup.materials} /></>}
          <ol>{setup.attach.map((s) => <li key={s}><R t={s} /></li>)}</ol>
          {setup.cautions.length > 0 && (
            <div className="caution">
              <h3>{t('실험할 때 주의')}</h3>
              <ul>{setup.cautions.map((x) => <li key={x}><R t={x} /></li>)}</ul>
            </div>
          )}
        </section>
      )}
      </>}
    </main>
  );
}
