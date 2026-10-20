import { Fragment, type ReactNode } from 'react';

/**
 * 안내 문장의 중요한 낱말에 색을 넣는다 (docs/DESIGN.md "핵심어 색").
 * - [버튼 이름]            → 초록: 누를 것
 * - 핀·단자 (5V, GND, A0…) → 파랑: 꽂을 곳
 * - 주의 낱말 (주의·금지…) → 주황: 조심할 것
 * - 숫자+단위 (30초, 25 °C) → 굵게
 * 색만으로 뜻을 전하지 않도록 낱말 자체는 그대로 남긴다.
 */
const RULES: { cls: string; re: string }[] = [
  { cls: 'k-btn', re: String.raw`\[[^\]\n]{1,40}\]` },
  { cls: 'k-pin', re: String.raw`(?<![\w가-힣])(?:5 ?V|3\.3 ?V|GND|VCC|VIN|SDA|SCL|TX|RX|AREF|IOREF|Qwiic|A[0-5]|D(?:1[0-3]|[0-9]))(?![\w])` },
  { cls: 'k-warn', re: String.raw`주의|경고|금지|절대|반드시|뽑지 마세요|만지지 마세요|화상|합선|감전|Warning|Caution|Do not|never|must` },
  { cls: 'k-num', re: String.raw`(?<![\w.])\d+(?:\.\d+)?\s?(?:초|분|시간|°C|℃|mL|mm|cm|kΩ|Ω|%|mA|ms|s\b|g\b|L\b)` },
];
const RE = new RegExp(RULES.map((r) => `(${r.re})`).join('|'), 'g');

export function rich(text: string): ReactNode {
  if (!text) return text;
  const out: ReactNode[] = [];
  let last = 0, k = 0;
  for (const m of text.matchAll(RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push(text.slice(last, i));
    const g = m.slice(1).findIndex((x) => x !== undefined);
    out.push(<span key={k++} className={RULES[g].cls}>{m[0]}</span>);
    last = i + m[0].length;
  }
  if (!out.length) return text;
  if (last < text.length) out.push(text.slice(last));
  return <Fragment>{out}</Fragment>;
}

/** <R t="문장" /> — 핵심어에 색을 넣은 문장 */
export function R({ t }: { t: string }) {
  return <>{rich(t)}</>;
}
