// 연결 사진 점검: 사진을 올려 두고 연결표에서 만든 점검 목록과 하나씩 대조합니다 (사진은 기기 밖으로 나가지 않음).
import { wiring, type Board, type Part } from './guide';
import { t } from './i18n';

export interface CheckItem { term: string; pin: string; color?: string; note?: string }

/** 연결표를 점검 목록으로 */
export function checklist(board: Board, part: Part, port?: string): CheckItem[] {
  const b = port ? { ...board, pins: { ...board.pins, A: port } } : board;
  const { connector, cable, wires } = wiring(b, part);
  if (cable) return [{ term: t('센서 Qwiic 단자'), pin: t('보드 Qwiic 단자'), note: t('케이블 하나 (방향 없음)') }];
  const out: CheckItem[] = wires.map((w) => ({ term: w.term, pin: w.boardPin, color: w.color }));
  if (connector.resistor) out.push({ term: t('저항 {v}', { v: connector.resistor.value }), pin: `${b.pins[connector.resistor.between[0]]} ↔ ${b.pins[connector.resistor.between[1]]}` });
  return out;
}

/** 연결 방식별로 자주 하는 실수 (사진과 대조할 때 눈여겨볼 곳) */
export function commonMistakes(part: Part): string[] {
  const base = [
    t('VCC와 GND를 바꿔 꽂음 — 모듈이 뜨거워지거나 망가집니다.'),
    t('점퍼선이 핀 구멍에 끝까지 안 들어가 헐거움 — 값이 0이나 튀는 값으로 나옵니다.'),
    t('옆 핀(예: A0 대신 A1, 5V 대신 3.3V)에 꽂음 — 핀 이름을 보드 글씨로 확인합니다.'),
  ];
  const by: Record<string, string[]> = {
    analog: [t('신호선(AO·OUT)을 DO(디지털 출력) 핀에 꽂음 — 아날로그 모듈은 AO를 씁니다.'), t('앱의 포트(A0~A3)와 실제 꽂은 핀이 다름 — [꽂을 포트]를 사진과 맞춥니다.')],
    'analog-3v3': [t('3.3 V 센서를 5V에 꽂음 — 센서가 망가질 수 있습니다. [3.3V] 핀을 씁니다.')],
    'analog-divider': [t('저항을 센서와 같은 세로 줄에 꽂지 않음 — 브레드보드에서 한 줄에 이어야 회로가 됩니다.'), t('저항이 GND가 아니라 5V 쪽에 붙음 — 값이 거꾸로 나옵니다.')],
    onewire: [t('4.7 kΩ 저항이 DATA–5V가 아니라 DATA–GND 사이에 있음.'), t('방수 센서 선 색이 제품마다 달라 DATA·VCC가 바뀜 — 설명서를 확인합니다.'), t('센서 2개 이상일 때 DATA 선을 서로 다른 핀에 꽂음 — 모두 D2 한 줄에 나란히 꽂습니다.')],
    dht: [t('핀 4개짜리 센서에서 비어 있는(NC) 핀에 선을 꽂음 — 1·2·4번 핀을 씁니다.'), t('DATA를 D4가 아닌 핀에 꽂음.')],
    i2c: [t('SDA와 SCL을 서로 바꿔 꽂음 — 인식되지 않습니다.'), t('5 V 전용 모듈을 Qwiic(3.3 V)에, 3.3 V 전용 모듈을 5V에 연결함.'), t('같은 주소의 I2C 센서 2개를 한 버스에 꽂음 — 하나만 인식됩니다.')],
    qwiic: [t('Qwiic 케이블이 끝까지 안 꽂힘 — "딸깍" 소리가 날 때까지 밀어 넣습니다.')],
    hx711: [t('로드셀 4선(빨강·검정·흰색·초록)을 HX711의 E+·E−·A−·A+ 순서와 다르게 납땜·연결함.'), t('DT와 SCK를 서로 바꿔 꽂음 (DT=D5, SCK=D6).')],
    ultrasonic: [t('TRIG와 ECHO를 바꿔 꽂음 (TRIG=D7, ECHO=D8).'), t('3.3 V 보드에서 ECHO를 바로 연결함 — 저항으로 전압을 낮춰야 합니다.')],
    'spi-tc': [t('SO·SCK·CS 세 선 중 둘이 바뀜 — 보드 D12·D13·D10 글씨와 맞춥니다.'), t('열전대 +·− 극이 바뀜 — 온도가 거꾸로 움직입니다.')],
    uart: [t('TX를 TX에, RX를 RX에 꽂음 — 서로 엇갈려(TX→RX, RX→TX) 연결해야 합니다.')],
    'uart-3v3': [t('TX·RX를 엇갈리지 않게 꽂음.'), t('3.3 V 센서의 전원을 5V에 연결함.')],
    pulse: [t('신호선을 D3가 아닌 핀에 꽂음 — 펄스 입력은 D3 하나뿐입니다.')],
    probe: [t('(+)·(−) 극이 바뀜 — 음의 전압은 읽지 못합니다.'), t('5 V가 넘는 전압(건전지 4개 이상)을 바로 잼 — 보드가 망가집니다.')],
    'digital-out': [t('DO 대신 AO에 꽂음 — 이 센서는 켜짐/꺼짐만 읽습니다.')],
    'spi-rtd': [t('PT100 2선·3선·4선 설정 점퍼가 센서 선 수와 다름.')],
  };
  return [...(by[part.connector] ?? []), ...base];
}
