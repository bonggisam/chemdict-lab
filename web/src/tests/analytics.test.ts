import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetTrack, eventPath, expName, track } from '../lib/analytics';

describe('익명 사용 통계', () => {
  afterEach(() => { _resetTrack(); delete (globalThis as { window?: unknown }).window; });

  it('경로에는 영문·숫자·-_. 만 남는다 (한글·공백·주소 문자 제거)', () => {
    expect(eventPath('exp', 'cur-rx-titration')).toBe('exp/cur-rx-titration');
    expect(eventPath('board', 'UNO R4 WiFi')).toBe('board/UNO_R4_WiFi');
    expect(eventPath('tool', '김철수/3모둠?x=1')).toBe('tool/_3_x_1');
    expect(eventPath('tool', '')).toBe('tool/unknown');
    expect(eventPath('tool', 'a'.repeat(200)).length).toBeLessThanOrEqual(5 + 60);
  });

  it('선생님이 만든 실험은 내용 대신 custom으로 묶는다', () => {
    expect(expName('my-1x2y3z')).toBe('custom');
    expect(expName('cur-c-chromate')).toBe('cur-c-chromate');
    expect(expName('quick-dht')).toBe('quick-dht');
  });

  it('같은 항목은 한 번만 보내고 이벤트로 보낸다', () => {
    const count = vi.fn();
    (globalThis as { window?: unknown }).window = { goatcounter: { count } };
    track('tool', 'area'); track('tool', 'area'); track('tool', 'derivative'); track('tool', null);
    expect(count).toHaveBeenCalledTimes(2);
    expect(count.mock.calls[0][0]).toEqual({ path: 'tool/area', title: 'tool/area', event: true });
  });
});
