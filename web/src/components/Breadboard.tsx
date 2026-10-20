import { useState } from 'react';
import { breadboard, type BBCircuit } from '../lib/guide';
import { t } from '../lib/i18n';
import { courseName } from '../lib/l10n';
import { R } from './Rich';

/** 브레드보드 그림: 구조 설명용(highlight) 또는 회로(circuit) */

const COLOR: Record<string, string> = {
  red: '#dc2626', black: '#27272a', yellow: '#ca8a04', blue: '#2563eb',
  green: '#16a34a', orange: '#ea580c', white: '#d4d4d8',
};
const COLS = 20;
const ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
const colX = (c: number) => 172 + (c - 1) * 26;
const RAIL_Y: Record<string, number> = { 'T+': 40, 'T-': 56, 'B+': 304, 'B-': 320 };
const rowY = (r: string) => {
  const i = ROWS.indexOf(r);
  return i < 5 ? 88 + i * 18 : 200 + (i - 5) * 18;
};
const PIN_ORDER = ['5V', '3.3V', 'GND', 'A0', 'A1', 'A2', 'D2', 'D4'];

function hole(name: string): [number, number] {
  if (name.includes(':')) {
    const [rail, col] = name.split(':');
    return [colX(Number(col)), RAIL_Y[rail]];
  }
  const r = name[0], c = Number(name.slice(1));
  return [colX(c), rowY(r)];
}

interface Props {
  circuit?: BBCircuit;
  highlight?: boolean;     // 구조 설명: 이어진 칸 표시
  title: string;
}

export function BreadboardDiagram({ circuit, highlight, title }: Props) {
  const pins = circuit
    ? PIN_ORDER.filter((p) => circuit.wires.some((w) => w.a === `pin:${p}` || w.b === `pin:${p}`))
    : [];
  const pinY = (p: string) => 70 + pins.indexOf(p) * 40;
  const hasBat = !!circuit?.wires.some((w) => w.a.startsWith('bat:'));
  const probes = circuit?.parts.filter((p) => p.kind === 'probe') ?? [];
  const H = probes.length || hasBat ? 430 : 350;
  const batX = 230, batY = 372;
  const pt = (name: string): [number, number] => {
    if (name.startsWith('pin:')) return [118, pinY(name.slice(4))];
    if (name === 'bat:+') return [batX + 24, batY];
    if (name === 'bat:-') return [batX + 76, batY];
    return hole(name);
  };

  return (
    <figure className="bb-figure">
      <svg viewBox={`0 0 720 ${H}`} role="img" aria-label={title}>
        {/* 보드 핀 */}
        {pins.length > 0 && (
          <g>
            <rect x="14" y="40" width="104" height={Math.max(80, pins.length * 40 + 20)} rx="10" className="bb-board" />
            <text x="66" y="34" textAnchor="middle" className="bb-label">{t('보드')}</text>
            {pins.map((p) => (
              <g key={p}>
                <rect x="96" y={pinY(p) - 7} width="22" height="14" rx="2" className="bb-pin" />
                <text x="88" y={pinY(p) + 4} textAnchor="end" className="bb-pin-text">{p}</text>
              </g>
            ))}
          </g>
        )}

        {/* 브레드보드 판 */}
        <rect x="150" y="22" width="550" height="314" rx="8" className="bb-body" />
        <rect x="150" y="178" width="550" height="6" className="bb-gap" />
        {(['T+', 'T-', 'B+', 'B-'] as const).map((r) => (
          <g key={r}>
            <line x1="160" x2="690" y1={RAIL_Y[r] + (r.endsWith('+') ? -8 : 8)} y2={RAIL_Y[r] + (r.endsWith('+') ? -8 : 8)} stroke={r.endsWith('+') ? '#dc2626' : '#2563eb'} strokeWidth="1.5" />
            <text x="158" y={RAIL_Y[r] + 4} textAnchor="end" className="bb-rail-text" fill={r.endsWith('+') ? '#dc2626' : '#2563eb'}>{r.endsWith('+') ? '+' : '−'}</text>
          </g>
        ))}
        {highlight && (
          <>
            <rect x={colX(5) - 9} y={rowY('a') - 9} width="18" height={rowY('e') - rowY('a') + 18} rx="4" className="bb-hl" />
            <rect x={colX(1) - 9} y={RAIL_Y['T+'] - 9} width={colX(COLS) - colX(1) + 18} height="18" rx="4" className="bb-hl rail" />
            <rect x={colX(12) - 9} y={rowY('f') - 9} width="18" height={rowY('j') - rowY('f') + 18} rx="4" className="bb-hl" />
          </>
        )}
        {/* 구멍 */}
        {Array.from({ length: COLS }, (_, i) => i + 1).map((c) => (
          <g key={c}>
            {ROWS.map((r) => <rect key={r} x={colX(c) - 3} y={rowY(r) - 3} width="6" height="6" rx="1" className="bb-hole" />)}
            {['T+', 'T-', 'B+', 'B-'].map((r) => <rect key={r} x={colX(c) - 3} y={RAIL_Y[r] - 3} width="6" height="6" rx="1" className="bb-hole" />)}
            {(c === 1 || c % 5 === 0) && <text x={colX(c)} y="76" textAnchor="middle" className="bb-num">{c}</text>}
          </g>
        ))}
        {ROWS.map((r) => <text key={r} x="164" y={rowY(r) + 4} textAnchor="end" className="bb-num">{r}</text>)}
        {highlight && (
          <>
            <text x={colX(5) + 16} y={rowY('c') + 4} className="bb-note">{t('a~e 세로 5칸이 한 줄로 이어짐')}</text>
            <text x={colX(12) + 16} y={rowY('h') + 4} className="bb-note">{t('f~j도 따로 한 줄 (가운데 홈 건너편과는 안 이어짐)')}</text>
            <text x={colX(8)} y={RAIL_Y['T+'] - 13} className="bb-note">{t('+ 줄은 가로로 길게 이어짐 (보드 5V)')}</text>
            <text x={colX(8)} y={RAIL_Y['T-'] + 20} className="bb-note">{t('− 줄 (보드 GND)')}</text>
          </>
        )}

        {/* 전지 */}
        {hasBat && (
          <g>
            <rect x={batX} y={batY} width="100" height="34" rx="6" className="bb-bat" />
            <text x={batX + 50} y={batY + 22} textAnchor="middle" className="bb-label">{t('전지')}</text>
            <text x={batX + 24} y={batY - 4} textAnchor="middle" className="bb-pin-text">+</text>
            <text x={batX + 76} y={batY - 4} textAnchor="middle" className="bb-pin-text">−</text>
          </g>
        )}

        {/* 부품 */}
        {circuit?.parts.map((p, k) => {
          const legs = p.legs.map(hole);
          if (p.kind === 'probe') {
            const i = probes.indexOf(p);
            const bx = 430 + i * 130, byy = 380;
            const cols = ['black', 'red', 'yellow'];
            return (
              <g key={k}>
                {legs.map(([x, y], j) => <path key={j} d={`M${x} ${y} C${x} ${y + 120} ${bx + 20 + j * 30} ${byy - 60} ${bx + 20 + j * 30} ${byy}`} stroke={COLOR[cols[j]]} strokeWidth="3" fill="none" strokeLinecap="round" />)}
                {legs.map(([x, y], j) => <circle key={`c${j}`} cx={x} cy={y} r="3.5" fill={COLOR[cols[j]]} />)}
                <rect x={bx} y={byy} width="100" height="30" rx="6" className="bb-probe" />
                <text x={bx + 50} y={byy + 20} textAnchor="middle" className="bb-label">{p.label}</text>
              </g>
            );
          }
          const [x1, y1] = legs[0], [x2, y2] = legs[legs.length - 1];
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
          return (
            <g key={k}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ca3af" strokeWidth="2" />
              {legs.map(([x, y], j) => <circle key={j} cx={x} cy={y} r="3" fill="#6b7280" />)}
              {p.kind === 'resistor' && (
                <g>
                  <rect x={mx - 20} y={my - 6} width="40" height="12" rx="5" fill="#e9d5a1" stroke="#a16207" />
                  {[-10, -3, 4, 12].map((dx, j) => <rect key={j} x={mx + dx - 1.5} y={my - 6} width="3" height="12" fill={['#7c2d12', '#111', '#ea580c', '#ca8a04'][j]} />)}
                </g>
              )}
              {p.kind === 'sensor' && <circle cx={mx} cy={my} r="11" fill="#fde68a" stroke="#b45309" />}
              {p.kind === 'led' && <path d={`M${mx - 10} ${my + 7} L${mx + 10} ${my + 7} L${mx + 10} ${my - 3} A10 10 0 0 0 ${mx - 10} ${my - 3} Z`} fill="#f87171" stroke="#b91c1c" />}
              {p.kind === 'cap' && <rect x={mx - 10} y={my - 11} width="20" height="22" rx="4" fill="#1e3a8a" stroke="#1e40af" />}
              {p.kind === 'pot' && <rect x={mx - 12} y={my - 12} width="24" height="24" rx="4" fill="#3b82f6" stroke="#1d4ed8" />}
              <text x={mx} y={my - 16} textAnchor="middle" className="bb-part">{p.label}</text>
              {p.kind === 'led' && <text x={x1} y={y1 + 16} textAnchor="middle" className="bb-num">{t('긴 다리 +')}</text>}
              {p.kind === 'cap' && <text x={x2} y={y2 + 16} textAnchor="middle" className="bb-num">{t('띠 −')}</text>}
            </g>
          );
        })}

        {/* 선 */}
        {circuit?.wires.map((w, k) => {
          const [ax, ay] = pt(w.a), [bx, by] = pt(w.b);
          const d = w.a.startsWith('pin:')
            ? `M${ax} ${ay} C${ax + 40} ${ay} ${bx} ${Math.min(ay, by) - 30} ${bx} ${by}`
            : w.a.startsWith('bat:')
              ? `M${ax} ${ay} C${ax} ${ay - 80} ${bx} ${by + 120} ${bx} ${by}`
              : `M${ax} ${ay} Q${(ax + bx) / 2} ${Math.min(ay, by) - 14} ${bx} ${by}`;
          return (
            <g key={`w${k}`}>
              <path d={d} stroke={COLOR[w.color] ?? '#555'} strokeWidth="3" fill="none" strokeLinecap="round" />
              <circle cx={bx} cy={by} r="3.5" fill={COLOR[w.color] ?? '#555'} />
            </g>
          );
        })}
      </svg>
      <figcaption className="note">{t('개념도입니다. 열 번호는 예시이며, 같은 줄 관계만 지키면 다른 열에 꽂아도 됩니다.')}</figcaption>
    </figure>
  );
}

/** 브레드보드 사용법 + 자주 쓰는 회로 */
export function BreadboardGuide({ initial, experiments }: { initial?: string; experiments?: { id: string; title: string; why: string; need: string; course?: string }[] }) {
  const [cid, setCid] = useState(initial ?? breadboard.circuits[0].id);
  const c = breadboard.circuits.find((x) => x.id === cid) ?? breadboard.circuits[0];
  return (
    <div className="bb-guide">
      <p><R t={breadboard.intro} /></p>
      <h3>{t('브레드보드의 구조')}</h3>
      <BreadboardDiagram highlight title={t('브레드보드 구조: 이어진 칸')} />
      <ul>{breadboard.structure.map((s) => <li key={s}><R t={s} /></li>)}</ul>
      <div className="caution">
        <h3>{t('꽂을 때 규칙')}</h3>
        <ul>{breadboard.rules.map((s) => <li key={s}><R t={s} /></li>)}</ul>
      </div>
      <h3>{t('자주 쓰는 저항')}</h3>
      <table className="wire-table bb-res">
        <thead><tr><th>{t('값')}</th><th>{t('색띠 (4줄)')}</th><th>{t('쓰는 곳')}</th></tr></thead>
        <tbody>{breadboard.resistors.map((r) => <tr key={r.value}><td><b>{r.value}</b></td><td>{r.bands}</td><td>{r.use}</td></tr>)}</tbody>
      </table>

      <h3 id="bb-circuits">{t('회로 만들기')}</h3>
      <div className="cat-chips" role="tablist" aria-label={t('회로')}>
        {breadboard.circuits.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === cid} className={x.id === cid ? 'on' : ''} onClick={() => setCid(x.id)}>{x.name.split(' (')[0]}</button>
        ))}
      </div>
      <h4>{c.name}</h4>
      <p className="note"><R t={c.what} /></p>
      <div className="guide-cols bb-cols">
        <ol className="wire-steps">{c.steps.map((s) => <li key={s}><R t={s} /></li>)}</ol>
        <BreadboardDiagram circuit={c} title={t('{name} 브레드보드 연결 그림', { name: c.name })} />
      </div>
      {c.caution && <p className="caution strong"><R t={c.caution} /></p>}

      {experiments && experiments.length > 0 && (
        <>
          <h3>{t('브레드보드가 필요한 실험 ({n}개)', { n: experiments.length })}</h3>
          <ul className="bb-exps">
            {experiments.map((e) => (
              <li key={e.id}><span className={`badge ${e.need === 'required' ? 'need' : ''}`}>{e.need === 'required' ? t('필요') : t('있으면 편함')}</span> <b>{e.title}</b>{e.course ? <span className="note"> · {courseName(e.course)}</span> : null} — {e.why}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
