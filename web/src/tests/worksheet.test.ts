import { beforeEach, describe, expect, it } from 'vitest';
import { WORKSHEET_QUESTIONS, emptyWorksheet, isEmptyWorksheet, loadWorksheet, saveWorksheet, worksheetForReport } from '../lib/worksheet';

// vitest 환경에 localStorage가 없을 수 있어 간단한 대체
const mem: Record<string, string> = {};
beforeEach(() => {
  for (const k of Object.keys(mem)) delete mem[k];
  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => { mem[k] = String(v); },
    removeItem: (k: string) => { delete mem[k]; },
  };
});

describe('활동지', () => {
  it('질문 4개 (애플 앱 Worksheet.questions와 같음)', () => {
    expect(WORKSHEET_QUESTIONS).toHaveLength(4);
    expect(WORKSHEET_QUESTIONS[1]).toBe('예측과 실제 결과를 비교해 보세요. 같은 점과 다른 점은?');
  });
  it('빈 활동지', () => {
    expect(isEmptyWorksheet(emptyWorksheet())).toBe(true);
    expect(isEmptyWorksheet({ prediction: '  ', answers: ['', '', '', ''] })).toBe(true);
    expect(isEmptyWorksheet({ prediction: '', answers: ['', 'x', '', ''] })).toBe(false);
  });
  it('실험마다 저장·불러오기, 비우면 지움', () => {
    saveWorksheet('exp-a', { prediction: '올라간다', answers: ['a', '', '', ''] });
    expect(loadWorksheet('exp-a')).toEqual({ prediction: '올라간다', answers: ['a', '', '', ''] });
    expect(loadWorksheet('exp-b')).toEqual(emptyWorksheet());
    saveWorksheet('exp-a', emptyWorksheet());
    expect(mem['chemdict.worksheet.exp-a']).toBeUndefined();
  });
  it('깨진 저장값은 빈 활동지로', () => {
    mem['chemdict.worksheet.x'] = '{oops';
    expect(loadWorksheet('x')).toEqual(emptyWorksheet());
    mem['chemdict.worksheet.y'] = JSON.stringify({ prediction: 3, answers: ['ok'] });
    expect(loadWorksheet('y')).toEqual({ prediction: '', answers: ['ok', '', '', ''] });
  });
  it('보고서 모양', () => {
    const r = worksheetForReport({ prediction: 'p', answers: ['1', '', '', '4'] });
    expect(r.prediction).toBe('p');
    expect(r.answers.map((x) => x.a)).toEqual(['1', '', '', '4']);
    expect(r.answers[0].q).toBe(WORKSHEET_QUESTIONS[0]);
  });
});
