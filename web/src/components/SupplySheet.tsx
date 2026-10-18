import { useMemo, useState } from 'react';
import type { Experiment } from '../lib/protocol';
import { categories, partSupported, parts, partsFor, type Board, type Part } from '../lib/guide';
import { saveFile, toTSV } from '../lib/runs';
import { t } from '../lib/i18n';

interface Line { item: string; total: string }

/** "방수 DS18B20 1개" → 모둠 수를 곱한 전체 수량 */
function multiply(item: string, groups: number): string {
  const m = /(\d+(?:\.\d+)?)\s*(개|가닥|장|세트|pcs?)(?![A-Za-z])/i.exec(item);
  if (!m) return `× ${groups}`;
  const n = Number(m[1]) * groups;
  const num = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return /^[A-Za-z]/.test(m[2]) ? `${num} ${m[2]}` : `${num}${m[2]}`;
}

/** 준비물 목록: 실험 또는 센서를 고르면 모둠 수에 맞춘 목록 (인쇄·복사·CSV) */
export function SupplySheet({ board, experiments, initialExp, onClose, say }: {
  board: Board; experiments: Experiment[]; initialExp?: Experiment; onClose: () => void; say: (k: 'ok' | 'err', s: string) => void;
}) {
  const [groups, setGroups] = useState(6);
  const [expId, setExpId] = useState(initialExp?.id && !initialExp.id.startsWith('quick-') ? initialExp.id : '');
  const [picked, setPicked] = useState<string[]>(() => (initialExp?.id.startsWith('quick-') ? [initialExp.id.slice(6)] : []));
  const [q, setQ] = useState('');
  const exp = experiments.find((e) => e.id === expId);
  const withSetup = experiments.filter((e) => e.setup?.parts.length || e.sensors.some((s) => s !== '*'));

  const chosenParts: Part[] = useMemo(() => {
    const fromExp = exp ? (exp.setup?.choose ? partsFor([], exp.setup.parts).slice(0, 1) : partsFor(exp.sensors.filter((s) => s !== '*'), exp.setup?.parts)) : [];
    const extra = picked.map((id) => parts.find((p) => p.id === id)).filter((p): p is Part => !!p);
    return [...fromExp, ...extra.filter((p) => !fromExp.includes(p))];
  }, [exp, picked]);

  const lines: Line[] = useMemo(() => {
    const out: Line[] = [
      { item: t('{board} 보드', { board: board.name }), total: t('{n}개', { n: groups }) },
      { item: t('USB 케이블 ({usb})', { usb: board.usb }), total: t('{n}개', { n: groups }) },
    ];
    for (const p of chosenParts) {
      out.push({ item: `■ ${p.name}`, total: '' });
      for (const it of p.items) out.push({ item: `   ${it}`, total: multiply(it, groups) });
    }
    if (exp?.setup?.materials.length) {
      out.push({ item: `■ ${t('실험 재료')}`, total: '' });
      for (const m of exp.setup.materials) out.push({ item: `   ${m}`, total: `× ${groups}` });
    }
    return out;
  }, [board, chosenParts, exp, groups]);

  const unsupported = chosenParts.filter((p) => !partSupported(board, p));
  const table = [[t('준비물'), t('전체 ({n}모둠)', { n: groups })], ...lines.map((l) => [l.item.replace(/^■ /, '').trim(), l.total])];
  const title = exp ? exp.title : t('센서 준비물');

  const copy = async () => {
    try { await navigator.clipboard.writeText(toTSV(table)); say('ok', t('표를 복사했습니다. 엑셀·한글·Numbers에 붙여넣으세요.')); }
    catch { say('err', t('이 브라우저에서는 복사가 막혀 있습니다. CSV로 저장하세요.')); }
  };
  const csv = () => {
    const q2 = (x: string) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
    saveFile(new Blob(['﻿' + [[title], ...table].map((r) => r.map(q2).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }), 'chemdict_supplies.csv');
  };

  const shown = parts.filter((p) => !q || `${p.name} ${p.category}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet wide-sheet supply-sheet" role="dialog" aria-modal="true" aria-label={t('준비물 목록')} onClick={(e) => e.stopPropagation()}>
        <h2>{t('준비물 목록')}</h2>
        <div className="supply-form">
          <label>{t('실험')}
            <select value={expId} onChange={(e) => setExpId(e.target.value)}>
              <option value="">{t('(센서만 고르기)')}</option>
              {withSetup.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </label>
          <label>{t('모둠 수')}
            <input type="number" min={1} max={40} inputMode="numeric" value={groups} onChange={(e) => setGroups(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} />
          </label>
        </div>
        <details className="supply-pick">
          <summary>{t('센서 더하기 ({n}개 고름)', { n: picked.length })}</summary>
          <input className="sensor-search" placeholder={t('센서 이름 검색')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="supply-parts">
            {categories.map((c) => {
              const ps = shown.filter((p) => p.category === c);
              if (!ps.length) return null;
              return (
                <fieldset key={c}>
                  <legend>{c}</legend>
                  {ps.map((p) => (
                    <label key={p.id}>
                      <input type="checkbox" checked={picked.includes(p.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id)))} /> {p.name}
                    </label>
                  ))}
                </fieldset>
              );
            })}
          </div>
        </details>
        {unsupported.length > 0 && <p className="note warn">{t('{board}에서 쓸 수 없는 센서: {list}', { board: board.name, list: unsupported.map((p) => p.name).join(', ') })}</p>}
        <div className="ana-table supply-table print-area">
          <h3 className="print-only">{title}</h3>
          <table>
            <thead><tr><th>{t('준비물')}</th><th>{t('전체 ({n}모둠)', { n: groups })}</th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className={l.item.startsWith('■') ? 'group' : ''}>
                  <td>{l.item.startsWith('■') ? <b>{l.item.slice(2)}</b> : l.item.trim()}</td>
                  <td>{l.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">{t('가격은 판매처마다 달라 넣지 않았습니다. 수량은 부품 설명에 적힌 개수 × 모둠 수입니다. 여유분(10%)을 더 준비하세요.')}</p>
        <div className="sheet-actions">
          <button onClick={copy}>{t('표 복사')}</button>
          <button onClick={csv}>CSV</button>
          <button onClick={() => window.print()}>{t('인쇄')}</button>
          <button className="primary" onClick={onClose}>{t('닫기')}</button>
        </div>
      </div>
    </div>
  );
}
