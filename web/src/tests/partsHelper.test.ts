import { describe, expect, it } from 'vitest';
import { boards, partById, type Part } from '../lib/guide';
import { bestDivider, checkTogether, dividerOut, findParts, ledResistor, modelTokens } from '../lib/partsHelper';

const uno = boards.find((b) => b.id === 'uno-r4-wifi')!;
const P = (id: string) => partById(id) as Part;

describe('부품 찾기', () => {
  it('모델명 낱말', () => {
    expect(modelTokens('초음파 거리 센서 HC-SR04')).toEqual(['HCSR04']);
    expect(modelTokens('가스 센서 MQ-2 / MQ-3 / MQ-135 (상대값)')).toEqual(['MQ2', 'MQ3', 'MQ135']);
  });
  it('사진 글자 → 부품', () => {
    expect(findParts('HC-SR04')[0]?.id).toBe('hcsr04');
    expect(findParts('Ultrasonic Sensor\nHC SR04')[0]?.id).toBe('hcsr04');
    expect(findParts('DHT22 AM2302')[0]?.id).toBe('dht');
    expect(findParts('DS18B20')[0]?.id).toBe('ds18b20');
    expect(findParts('MQ-135')[0]?.name).toContain('MQ-135');
    expect(findParts('SCD41')[0]?.id).toBe('scd4x');
    expect(findParts('안녕하세요')).toEqual([]);
  });
});

describe('저항 계산', () => {
  it('LED 저항', () => {
    const r = ledResistor(5, 2, 10)!;
    expect(r.r).toBeCloseTo(300);
    expect(r.std).toBe(330);
    expect(r.actualMa).toBeLessThan(10);
  });
  it('전압 나누기', () => {
    expect(dividerOut(5, 10000, 10000)).toBeCloseTo(2.5);
    const d = bestDivider(5, 3.3)!;
    expect(d.vout).toBeLessThanOrEqual(3.3 * 1.005);
    expect(d.vout).toBeGreaterThan(3.1);
    expect(bestDivider(5, 6)).toBeNull();
  });
});

describe('센서 함께 쓰기 검사', () => {
  it('문제없는 조합', () => {
    const c = checkTogether(uno, [P('ds18b20'), P('dht'), P('bme280')]);
    expect(c.errors).toEqual([]);
  });
  it('I2C 주소가 겹치면 오류 (SHT40 ↔ SHT30)', () => {
    const c = checkTogether(uno, [P('sht40'), P('sht3x')]);
    expect(c.errors.some((e) => e.key.includes('I2C'))).toBe(true);
  });
  it('같은 부품 두 개는 오류, DS18B20은 여러 개 가능', () => {
    expect(checkTogether(uno, [P('dht'), P('dht')]).errors.length).toBeGreaterThan(0);
    expect(checkTogether(uno, [P('ds18b20'), P('ds18b20')]).errors).toEqual([]);
  });
  it('아날로그 포트는 4개까지', () => {
    const analog = ['lm35', 'tmp36', 'ph', 'ec', 'tds'].map(P).filter(Boolean);
    const c = checkTogether(uno, analog);
    expect(Object.keys(c.ports).length).toBe(4);
    expect(c.errors.some((e) => e.key.includes('아날로그'))).toBe(true);
  });
  it('UART 센서 둘은 같은 핀', () => {
    const uarts = ['mhz19', 'pms7003'].map(P).filter(Boolean);
    if (uarts.length === 2) expect(checkTogether(uno, uarts).errors.some((e) => e.key.includes('같은 핀'))).toBe(true);
  });
});

it('5 V 선을 나눠 쓰는 아날로그 센서 둘은 겹침 아님 (애플 MultiPlan과 같음)', () => {
  expect(checkTogether(uno, [P('lm35'), P('mpx5700')]).errors).toEqual([]);
  expect(checkTogether(uno, [P('hcsr04'), P('mq-2')]).errors).toEqual([]);
});
