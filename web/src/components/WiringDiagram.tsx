import type { Board, ConnectorKind } from '../lib/guide';

/** 보드 × 연결 방식별 배선 개념도 (실제 핀 위치와 다를 수 있음) */

const WIRE = { red: '#dc2626', black: '#27272a', yellow: '#ca8a04', blue: '#2563eb', green: '#16a34a' };
type Wire = { pin: string; term: string; color: string };

interface Props {
  board: Board;
  connector: ConnectorKind;
  partName: string;
}

export function WiringDiagram({ board, connector, partName }: Props) {
  const hasQwiic = !board.qwiic.startsWith('없음');
  const low = board.id === 'uno-q'; // 3.3 V 보드
  const pwr = low ? '3.3V' : '5V';

  let wires: Wire[] = [];
  let cable = false;
  let resistor = false;
  if (connector === 'qwiic') {
    if (hasQwiic) cable = true;
    else {
      const sda = board.id === 'uno-r3' ? 'A4' : 'SDA';
      const scl = board.id === 'uno-r3' ? 'A5' : 'SCL';
      wires = [
        { pin: 'GND', term: 'GND', color: WIRE.black },
        { pin: '3.3V', term: '3.3V', color: WIRE.red },
        { pin: sda, term: 'SDA', color: WIRE.blue },
        { pin: scl, term: 'SCL', color: WIRE.yellow },
      ];
    }
  } else if (connector === 'onewire') {
    wires = [
      { pin: 'GND', term: 'GND', color: WIRE.black },
      { pin: pwr, term: 'VCC', color: WIRE.red },
      { pin: 'D2', term: 'DATA', color: WIRE.yellow },
    ];
    resistor = true;
  } else {
    wires = [
      { pin: 'GND', term: 'GND', color: WIRE.black },
      { pin: pwr, term: 'VCC', color: WIRE.red },
      { pin: 'A0', term: 'OUT', color: WIRE.green },
    ];
  }

  // 배치
  const bx = 40, by = 70, bw = 250, bh = 190;
  const sx = 450, sy = 96, sw = 160, sh = 140;
  const pinX = (i: number) => bx + 40 + i * 46;
  const pinY = by + 14;
  const laneY = (i: number) => 26 + i * 11;
  const dropX = (i: number) => 414 - i * 26;
  const termY = (i: number) => sy + 30 + i * 28;

  const path = (i: number) => {
    const x = pinX(i), y = laneY(i), d = dropX(i), t = termY(i);
    return `M${x} ${pinY} V${y} H${d} V${t} H${sx}`;
  };

  const rY = by + 48; // 저항: 전원선과 DATA선 사이

  return (
    <figure className="wiring">
      <svg viewBox="0 0 640 300" role="img" aria-label={`${board.name}에 ${partName} 연결 그림`}>
        {/* 보드 */}
        <rect x={bx} y={by} width={bw} height={bh} rx="14" fill="#0e7c86" />
        <rect x={bx - 14} y={by + 70} width="26" height="44" rx="4" fill="#9aa5b1" />
        <text x={bx + 2} y={by + bh + 22} className="dg-small">{board.usb.split(' ')[0]}</text>
        <text x={bx + bw / 2} y={by + bh - 22} textAnchor="middle" className="dg-board">{board.name.replace(/ \(.*\)/, '')}</text>
        {hasQwiic && (
          <g>
            <rect x={bx + bw - 30} y={by + 96} width="30" height="22" rx="3" fill="#f4f4f5" stroke="#52525b" />
            <text x={bx + bw - 6} y={by + 136} textAnchor="end" className="dg-pin-on">Qwiic</text>
          </g>
        )}

        {/* 핀 */}
        {wires.map((w, i) => (
          <g key={w.pin}>
            <rect x={pinX(i) - 9} y={pinY - 9} width="18" height="18" rx="2" fill="#1f2937" stroke="#e5e7eb" />
            <text x={pinX(i)} y={pinY + 30} textAnchor="middle" className="dg-pin-on">{w.pin}</text>
          </g>
        ))}

        {/* 센서 */}
        <rect x={sx} y={sy} width={sw} height={sh} rx="12" className="dg-part" />
        <text x={sx + sw / 2} y={sy + sh + 24} textAnchor="middle" className="dg-label">{partName.replace(/ \(.*\)/, '')}</text>
        {connector === 'onewire' && (
          <g>
            <rect x={sx + sw} y={sy + 58} width="20" height="26" rx="3" fill="#9aa5b1" />
            <text x={sx + sw - 8} y={sy + 50} textAnchor="end" className="dg-small">금속 끝 →</text>
          </g>
        )}
        {wires.map((w, i) => (
          <text key={w.term} x={sx + 14} y={termY(i) + 5} className="dg-term">{w.term}</text>
        ))}

        {/* 선 */}
        {wires.map((w, i) => (
          <g key={`w${i}`} fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={path(i)} stroke="#a1a1aa" strokeWidth="6.5" />
            <path d={path(i)} stroke={w.color} strokeWidth="4" />
          </g>
        ))}

        {resistor && (
          <g>
            <line x1={dropX(2)} y1={rY} x2={dropX(1)} y2={rY} stroke="#52525b" strokeWidth="2" />
            <rect x={(dropX(2) + dropX(1)) / 2 - 8} y={rY - 6} width="16" height="12" rx="2" fill="#e8d3a2" stroke="#52525b" />
            <circle cx={dropX(2)} cy={rY} r="3.5" fill="#52525b" />
            <circle cx={dropX(1)} cy={rY} r="3.5" fill="#52525b" />
            <text x={dropX(2) - 10} y={rY + 4} textAnchor="end" className="dg-small">4.7 kΩ</text>
          </g>
        )}

        {cable && (
          <g fill="none" strokeLinecap="round">
            <path d={`M${bx + bw} ${by + 107} C ${bx + bw + 70} ${by + 107}, ${sx - 70} ${sy + 70}, ${sx} ${sy + 70}`} stroke="#a1a1aa" strokeWidth="11" />
            <path d={`M${bx + bw} ${by + 107} C ${bx + bw + 70} ${by + 107}, ${sx - 70} ${sy + 70}, ${sx} ${sy + 70}`} stroke="#27272a" strokeWidth="7" />
            <rect x={sx} y={sy + 59} width="26" height="22" rx="3" fill="#f4f4f5" stroke="#52525b" />
            <text x={(bx + bw + sx) / 2} y={by + 70} textAnchor="middle" className="dg-label">Qwiic 케이블</text>
          </g>
        )}
      </svg>
      <figcaption>개념도입니다. 실제 핀 위치는 보드에 인쇄된 이름을 보고 찾으세요.</figcaption>
    </figure>
  );
}
