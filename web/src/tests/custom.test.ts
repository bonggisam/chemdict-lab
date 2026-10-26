import { describe, expect, test } from 'vitest';
import { customId, toExperiment, valid, type CustomExp } from '../lib/custom';

const x: CustomExp = { t: '손난로 산화 반응', s: ['T', 'O2'], iv: 1000, st: ['센서를 넣습니다.', '[측정 시작]을 누릅니다.'] };

describe('선생님이 만든 실험 (공유 링크 x 칸)', () => {
  test('검사: 제목·센서·간격', () => {
    expect(valid(x)).toBe(true);
    expect(valid({ ...x, t: ' ' })).toBe(false);
    expect(valid({ ...x, s: ['NOPE'] })).toBe(false);
    expect(valid({ ...x, iv: 5 })).toBe(false);
    expect(valid({ ...x, m: 'event' })).toBe(false);   // 값 입력 모드인데 ev가 없음
    expect(valid({ ...x, m: 'event', ev: { l: 'V', u: 'mL', s: 0, d: 0 } })).toBe(false);
    expect(valid({ ...x, m: 'event', ev: { l: 'V', u: 'mL', s: 0, d: 0.5 } })).toBe(true);
  });
  test('같은 내용이면 같은 id, 실험으로 바꾸면 센서마다 그래프', () => {
    expect(customId(x)).toBe('my-efw8ra');   // 애플 앱 CoreTests와 같은 값
    expect(customId(x)).toBe(customId({ ...x }));
    expect(customId(x)).not.toBe(customId({ ...x, t: '다른 실험' }));
    const e = toExperiment(x);
    expect(e.id.startsWith('my-')).toBe(true);
    expect(e.y.map((y) => y.sensor)).toEqual(['T', 'O2']);
    expect(e.course).toBe('내가 만든 실험');
  });
  test('값 입력 모드', () => {
    const e = toExperiment({ ...x, m: 'event', ev: { l: 'NaOH 부피', u: 'mL', s: 0, d: 1 } });
    expect(e.mode).toBe('event');
    expect(e.event?.unit).toBe('mL');
    expect(e.markers.enabled).toBe(false);
  });
});
