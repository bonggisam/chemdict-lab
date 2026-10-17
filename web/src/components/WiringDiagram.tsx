import { hasQwiic, wiring, type Board, type Part } from '../lib/guide';
import { t } from '../lib/i18n';

/** 보드 × 센서 배선 개념도 (protocol/guide.json의 연결 방식으로 그림, 실제 핀 위치와 다를 수 있음) */

const COLOR: Record<string, string> = {
  red: '#dc2626', black: '#27272a', yellow: '#ca8a04', blue: '#2563eb',
  green: '#16a34a', orange: '#ea580c', white: '#d4d4d8',
};

interface Props {
  board: Board;
  part: Part;
}

export function WiringDiagram({ board, part }: Props) {
  const { connector, cable, wires } = wiring(board, part);
  const hasQ = hasQwiic(board);
  const shown = cable ? [] : wires;
  const n = shown.length;

  // 배치
  const bx = 40, by = 76, bw = 250, bh = 200;
  const sx = 450, sy = 96, sw = 170;
  const sh = Math.max(140, 44 + n * 30);
  const step = n > 5 ? (bw - 70) / (n - 1) : 48;   // 6선(MAX31865)도 보드 안에
  const pinX = (i: number) => bx + 38 + i * step;
  const pinY = by + 14;
  const laneY = (i: number) => 22 + i * 10;
  const dropX = (i: number) => 418 - i * 22;
  const termY = (i: number) => sy + 32 + i * 30;
  const path = (i: number) => `M${pinX(i)} ${pinY} V${laneY(i)} H${dropX(i)} V${termY(i)} H${sx}`;
  const H = Math.max(by + bh + 34, sy + sh + 40);

  const res = connector.resistor;
  const ra = res ? shown.findIndex((w) => w.pin === res.between[0]) : -1;
  const rb = res ? shown.findIndex((w) => w.pin === res.between[1]) : -1;
  const rY = by + 40;

  return (
    <figure className="wiring">
      <svg viewBox={`0 0 640 ${H}`} role="img" aria-label={t('{board}에 {part} 연결 그림', { board: board.name, part: part.name })}>
        {/* 보드 */}
        <rect x={bx} y={by} width={bw} height={bh} rx="14" fill="#0e7c86" />
        <rect x={bx - 14} y={by + 76} width="26" height="44" rx="4" fill="#9aa5b1" />
        <text x={bx + 2} y={by + bh + 22} className="dg-small">{board.usb.split(' ')[0]}</text>
        <text x={bx + bw / 2} y={by + bh - 22} textAnchor="middle" className="dg-board">{board.name.replace(/ \(.*\)/, '')}</text>
        {hasQ && (
          <g>
            <rect x={bx + bw - 30} y={by + 102} width="30" height="22" rx="3" fill="#f4f4f5" stroke="#52525b" />
            <text x={bx + bw - 6} y={by + 142} textAnchor="end" className="dg-pin-on">Qwiic</text>
          </g>
        )}

        {/* 보드 핀 (이름이 길면 두 줄: "SDA" / "(A4)") */}
        {shown.map((w, i) => {
          const [main, ...rest] = w.boardPin.split(' ');
          return (
            <g key={`p${i}`}>
              <rect x={pinX(i) - 9} y={pinY - 9} width="18" height="18" rx="2" fill="#1f2937" stroke="#e5e7eb" />
              <text x={pinX(i)} y={pinY + 30} textAnchor="middle" className="dg-pin-on">{main}</text>
              {rest.length > 0 && <text x={pinX(i)} y={pinY + 45} textAnchor="middle" className="dg-pin-sub">{rest.join(' ')}</text>}
            </g>
          );
        })}

        {/* 센서 */}
        <rect x={sx} y={sy} width={sw} height={sh} rx="12" className="dg-part" />
        <text x={sx + sw / 2} y={sy + sh + 24} textAnchor="middle" className="dg-label">{shortName(part.name)}</text>
        {shown.map((w, i) => (
          <text key={`t${i}`} x={sx + 14} y={termY(i) + 5} className="dg-term">{w.term}</text>
        ))}

        {/* 선 */}
        {shown.map((w, i) => (
          <g key={`w${i}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={path(i)} stroke="#a1a1aa" strokeWidth="6.5" />
            <path d={path(i)} stroke={COLOR[w.color] ?? COLOR.black} strokeWidth="4" />
          </g>
        ))}

        {res && ra >= 0 && rb >= 0 && (
          <g>
            <line x1={dropX(ra)} y1={rY} x2={dropX(rb)} y2={rY} stroke="#52525b" strokeWidth="2" />
            <rect x={(dropX(ra) + dropX(rb)) / 2 - 8} y={rY - 6} width="16" height="12" rx="2" fill="#e8d3a2" stroke="#52525b" />
            <circle cx={dropX(ra)} cy={rY} r="3.5" fill="#52525b" />
            <circle cx={dropX(rb)} cy={rY} r="3.5" fill="#52525b" />
            <text x={Math.min(dropX(ra), dropX(rb)) - 10} y={rY + 4} textAnchor="end" className="dg-small">{res.value}</text>
          </g>
        )}

        {cable && (
          <g fill="none" strokeLinecap="round">
            <path d={`M${bx + bw} ${by + 113} C ${bx + bw + 70} ${by + 113}, ${sx - 70} ${sy + 70}, ${sx} ${sy + 70}`} stroke="#a1a1aa" strokeWidth="11" />
            <path d={`M${bx + bw} ${by + 113} C ${bx + bw + 70} ${by + 113}, ${sx - 70} ${sy + 70}, ${sx} ${sy + 70}`} stroke="#27272a" strokeWidth="7" />
            <rect x={sx} y={sy + 59} width="26" height="22" rx="3" fill="#f4f4f5" stroke="#52525b" />
            <text x={(bx + bw + sx) / 2} y={by + 70} textAnchor="middle" className="dg-label">{t('Qwiic 케이블')}</text>
          </g>
        )}
      </svg>
      <figcaption>{t('개념도입니다. 실제 핀 위치는 보드에 인쇄된 이름을 보고 찾으세요.')}</figcaption>
    </figure>
  );
}

function shortName(name: string) {
  return name.replace(/ \(.*\)$/, '').replace(/ \/ .*$/, '');
}
