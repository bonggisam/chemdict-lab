import { describe, expect, it } from 'vitest';
import { bbSpot, colorName, plain, wireName } from '../lib/assist';

// 2.2 손쉬운 사용: 애플 CoreTests.testAssist와 같은 값
describe('손쉬운 사용', () => {
  it('머리 이모지를 뺌', () => {
    expect(plain('📈 측정')).toBe('측정');
    expect(plain('🧑‍🔬 실험 순서 보기')).toBe('실험 순서 보기');
    expect(plain('⚗️ 시약·약품')).toBe('시약·약품');
    expect(plain('측정 시작')).toBe('측정 시작');
    expect(plain('→ 다음')).toBe('→ 다음');
    expect(plain('25 ℃')).toBe('25 ℃');
  });
  it('색 이름', () => {
    expect(colorName(230, 30, 30)).toBe('빨강');
    expect(colorName(30, 60, 220)).toBe('파랑');
    expect(colorName(250, 250, 250)).toBe('흰색');
    expect(colorName(10, 10, 10)).toBe('검정');
    expect(colorName(240, 200, 20)).toBe('노랑');
    expect(colorName(128, 0, 160)).toBe('보라');
    expect(wireName('red')).toBe('빨간 선');
    expect(wireName('green')).toBe('초록 선');
  });
  it('브레드보드 자리', () => {
    expect(bbSpot('T+:3')).toBe('위쪽 + 줄');
    expect(bbSpot('pin:5V')).toBe('보드 5V');
    expect(bbSpot('c6')).toBe('구멍 c6');
  });
});
