// 2.1: 긴 측정(화면 켜 두기) · 보드와 이 기기 센서 함께 재기 · 활동지를 측정 파일에
import { afterEach, describe, expect, it, vi } from 'vitest';
import { keepAwake, wakeSupported } from '../lib/wake';
import { DeviceTransport } from '../lib/device';
import { readSessionFile, sessionBlob, type Session } from '../lib/session';
import { newRun } from '../lib/runs';
import type { Experiment } from '../lib/protocol';

afterEach(() => { vi.unstubAllGlobals(); });

describe('화면 켜 두기 (wake lock)', () => {
  it('지원하지 않는 환경에서는 아무 일도 하지 않고 오류도 없다', () => {
    expect(wakeSupported()).toBe(false);
    expect(() => { keepAwake(true); keepAwake(false); }).not.toThrow();
  });

  it('측정을 시작하면 잡고, 멈추면 놓는다', async () => {
    const release = vi.fn(() => Promise.resolve());
    const request = vi.fn(() => Promise.resolve({ release, addEventListener: () => {} }));
    vi.stubGlobal('navigator', { wakeLock: { request } });
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: () => {} });
    keepAwake(true);
    await Promise.resolve(); await Promise.resolve();
    expect(request).toHaveBeenCalledWith('screen');
    keepAwake(true);   // 이미 잡았으면 다시 잡지 않음
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    keepAwake(false);
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe('보드와 함께 재기: 이 기기 센서의 지금 값', () => {
  it('값이 있는 센서만, 소수 넷째 자리까지 건넨다 (hello·데이터 줄은 내보내지 않음)', () => {
    const d = new DeviceTransport();
    const lines: string[] = [];
    d.onLine = (l) => lines.push(l);
    (d as unknown as { latest: Record<string, number> }).latest = { DSND: 61.234567, DFRQ: Number.NaN };
    expect(d.snapshot(['DSND', 'DFRQ', 'DACC'])).toEqual({ DSND: 61.2346 });
    expect(lines).toEqual([]);
  });

  it('함께 재는 동안에는 측정 중으로 본다 (카메라 미리보기를 끄지 않게)', () => {
    const d = new DeviceTransport();
    expect(d.running).toBe(false);
    (d as unknown as { companionOn: boolean }).companionOn = true;
    expect(d.running).toBe(true);
    d.stopCompanion(true);
    expect(d.running).toBe(false);
  });
});

describe('측정 파일에 활동지 담기', () => {
  const exp = { id: 'cur-test', order: 1, title: '시험', subject: '', standards: [], sensors: ['T'], intervalMs: 1000, x: { label: '시간', unit: 's' }, y: [], markers: { enabled: true, label: '', prompt: '' }, steps: [] } as Experiment;

  it('저장했다 열어도 예측·답이 그대로 남는다', async () => {
    const run = newRun('time', 0);
    run.rows.push({ t: 0, v: { T: 20 } });
    const s: Session = { app: 'chemdict-lab', v: 1, id: 's-1', savedAt: '2026-11-20T00:00:00Z', exp, runs: [run], intervalMs: 1000, sensors: [], worksheet: { prediction: '온도가 오른다', answers: ['늘어남', '', '', ''] } };
    const text = await sessionBlob(s).text();
    const back = await readSessionFile({ text: () => Promise.resolve(text) } as File);
    expect(back.worksheet).toEqual({ prediction: '온도가 오른다', answers: ['늘어남', '', '', ''] });
    expect(back.id).not.toBe('s-1');   // 받은 파일은 새 id로 (내 측정과 섞이지 않게)
  });

  it('활동지가 없는 예전 파일도 열린다', async () => {
    const run = newRun('time', 0);
    run.rows.push({ t: 0, v: { T: 20 } });
    const text = JSON.stringify({ app: 'chemdict-lab', v: 1, id: 's-2', savedAt: '', exp, runs: [run], intervalMs: 1000, sensors: [] });
    const back = await readSessionFile({ text: () => Promise.resolve(text) } as File);
    expect(back.worksheet).toBeUndefined();
  });
});
