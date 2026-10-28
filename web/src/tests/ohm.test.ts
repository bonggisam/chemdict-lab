// 2.0 저항 재기 (OHM): 보드는 전압을 보내고 앱이 저항으로 바꿈 — 애플 SensorCatalog.appConvert와 같은 값
import { expect, it } from 'vitest';
import { appConvValue, applyAppConv, boardVref, typeInfo } from '../lib/sensors';
import { partById } from '../lib/guide';

it('OHM 카탈로그·연결 안내', () => {
  expect(typeInfo('OHM')?.app).toEqual({ kind: 'divider', r: 10000 });
  expect(partById('ohm-meter')?.connector).toBe('analog-divider');
});
it('전압 → 저항 (5 V 보드)', () => {
  const c = { kind: 'divider' as const, r: 10000 };
  expect(appConvValue(c, 2.5, 5)).toBe(10000);                       // 같은 값이면 절반
  expect(appConvValue(c, 5 * 10000 / 14700, 5)).toBe(4700);          // 4.7 kΩ
  expect(appConvValue(c, 5 * 10000 / 11000, 5)).toBe(1000);          // 1 kΩ
  expect(appConvValue(c, 0.01, 5)).toBeUndefined();                  // 끊김
  expect(appConvValue(c, 4.99, 5)).toBeUndefined();                  // A 핀이 5V에 바로 닿음
  expect(appConvValue(c, 1.65, 3.3)).toBe(10000);                    // 3.3 V 보드
});
it('데이터 줄에서 OHM만 바꿈', () => {
  const v = applyAppConv({ OHM: 2.5, T: 21.5, pH_A1: 7 }, [{ id: 'OHM', type: 'OHM' }, { id: 'T', type: 'T' }, { id: 'pH_A1', type: 'pH' }], 5);
  expect(v).toEqual({ OHM: 10000, T: 21.5, pH_A1: 7 });
  expect(applyAppConv({ OHM: 0 }, [{ id: 'OHM', type: 'OHM' }], 5)).toEqual({});
  expect(boardVref('3.3 V')).toBe(3.3);
  expect(boardVref('5 V')).toBe(5);
});
