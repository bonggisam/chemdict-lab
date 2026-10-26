import { describe, expect, test } from 'vitest';
import catalog from '../../../protocol/sensors.json';
import devices from '../../../protocol/device_sensors.json';
import { experiments } from '../lib/experiments';
import { parts } from '../lib/guide';
import { DEVICE_TYPES, isDeviceExperiment, kitInterval } from '../lib/device';

const types = new Set([...catalog.analog, ...catalog.digital].map((s) => s.type));

describe('공통 자료 (protocol/*.json)', () => {
  test('센서 종류는 겹치지 않고 길이 규칙을 지킨다', () => {
    const all = [...catalog.analog, ...catalog.digital].map((s) => s.type);
    expect(new Set(all).size).toBe(all.length);
    for (const s of catalog.digital) expect(s.type.length, s.type).toBeLessThanOrEqual(4);
  });
  test('모든 실험의 센서가 sensors.json에 있다', () => {
    for (const e of experiments) for (const s of e.sensors) if (s !== '*') expect(types.has(s), `${e.id}: ${s}`).toBe(true);
  });
  test('모든 연결 안내 부품의 센서가 sensors.json에 있다', () => {
    for (const p of parts) for (const s of p.provides) expect(types.has(s), `${p.id}: ${s}`).toBe(true);
  });
  test('기기 센서 카드는 기기 센서 종류만 쓰고 플랫폼이 맞다', () => {
    for (const k of devices.kits) {
      for (const s of k.provides) expect(DEVICE_TYPES.includes(s) && types.has(s), `${k.id}: ${s}`).toBe(true);
      for (const p of k.platforms) expect(['ios', 'mac', 'web']).toContain(p);
      expect(k.how.length).toBeGreaterThan(0);
    }
  });
  test('기기 센서 실험은 기기 센서 종류로만 되어 있다', () => {
    const dev = experiments.filter((e) => e.id.startsWith('cur-d-'));
    expect(dev.length).toBeGreaterThanOrEqual(9);
    for (const e of dev) expect(isDeviceExperiment(e.sensors), e.id).toBe(true);
  });
  test('측정 간격: 움직임 0.1초, 소리·카메라 0.2초', () => {
    const k = (id: string) => devices.kits.find((x) => x.id === id)!;
    expect(kitInterval(k('dev-accel'))).toBe(100);
    expect(kitInterval(k('dev-sound'))).toBe(200);
    expect(kitInterval(k('dev-absorb'))).toBe(200);
  });
});
