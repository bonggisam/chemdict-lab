import { useState } from 'react';
import raw from '../../../protocol/analysis_methods.json';
import type { ModelId } from '../lib/fit';
import type { CalcId } from '../lib/calc';
import type { ChartTool } from './Chart';
import { c, t } from '../lib/i18n';
import { R } from './Rich';

interface Method { tool: string; why: string; example: string }
interface SensorGuide { name: string; graph: string; methods: Method[]; tips: string[] }
const data = raw as { bySensor: Record<string, SensorGuide>; aliases?: Record<string, string> };
/** 센서 type → 안내 키 (변형 코드는 aliases로 가족 코드에 묶음) */
export function guideKey(type: string): string | null {
  const base = type.replace(/_.*$/, '');
  for (const k of [type, base, data.aliases?.[type] ?? '', data.aliases?.[base] ?? '']) if (k && k in data.bySensor) return k;
  return null;
}

/** 도구 이름(한국어) → 앱 조작 */
export type Apply = { fit?: ModelId; tool?: ChartTool; area?: boolean; deriv?: boolean; plateau?: boolean; eq?: boolean; calc?: CalcId };
export function applyFor(tool: string): Apply | null {
  const s = tool.replace(/\s/g, '');
  if (s.startsWith('평탄')) return { plateau: true };
  if (s.startsWith('당량점')) return { eq: true };
  if (s.startsWith('접선')) return { tool: 'tangent' };
  if (s.startsWith('넓이')) return { area: true };
  if (s.startsWith('변화율')) return { deriv: true };
  if (s.startsWith('값읽기')) return { tool: 'read' };
  if (s.startsWith('구간선택')) return { tool: 'select' };
  if (s.startsWith('계산열')) {
    const m = s.replace(/^계산열→?/, '');
    const map: [string, CalcId][] = [['처음값', 'delta'], ['Δ', 'delta'], ['변화율', 'rate'], ['역수', 'inv'], ['1/', 'inv'], ['자연로그', 'ln'], ['ln', 'ln'], ['상용로그', 'log'], ['log', 'log'], ['제곱', 'sq'], ['절대온도', 'kelvin']];
    const hit = map.find(([k]) => m.startsWith(k));
    return { calc: hit ? hit[1] : 'custom' };
  }
  if (s.startsWith('함수찾기')) {
    const m = s.replace(/^함수찾기→?/, '');
    const map: [string, ModelId][] = [['직선', 'linear'], ['비례', 'prop'], ['반비례', 'inverse'], ['지수접근', 'approach'], ['지수', 'exp'], ['거듭제곱', 'power'], ['로그', 'log'], ['2차', 'quad'], ['3차', 'cubic'], ['자동', 'auto']];
    const hit = map.find(([k]) => m.startsWith(k));
    return { fit: hit ? hit[1] : 'auto' };
  }
  return null;
}

/** 지금 해석하는 센서에 맞는 그래프·해석 방법 안내 (교육용 측정 프로그램의 표준 분석을 참고) */
export function SensorTips({ type, onApply }: { type: string; onApply: (a: Apply) => void }) {
  const [open, setOpen] = useState(false);
  const key = guideKey(type);
  if (!key) return null;
  const g = data.bySensor[key];
  const k = `ana.${key}`;
  return (
    <details className="sensor-tips" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>💡 {t('{name} 그래프, 이렇게 해석하세요', { name: c(`${k}.name`, g.name) })}</summary>
      <p className="st-graph"><b>{t('추천 그래프')}</b> <R t={c(`${k}.graph`, g.graph)} /></p>
      <ul className="st-methods">
        {g.methods.map((m, i) => {
          const a = applyFor(m.tool);
          return (
            <li key={i}>
              <div className="st-head">
                <b className="k-btn">{c(`${k}.m.${i}.tool`, m.tool)}</b>
                {a && <button className="link" onClick={() => onApply(a)}>{t('적용')}</button>}
              </div>
              <span><R t={c(`${k}.m.${i}.why`, m.why)} /></span>
              <small className="note">{t('예')}: {c(`${k}.m.${i}.ex`, m.example)}</small>
            </li>
          );
        })}
      </ul>
      {g.tips.length > 0 && (
        <ul className="st-tips">{g.tips.map((x, i) => <li key={i}><R t={c(`${k}.tip.${i}`, x)} /></li>)}</ul>
      )}
    </details>
  );
}
