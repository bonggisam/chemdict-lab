import { describe, expect, it } from 'vitest';
import themes from '../../../protocol/themes.json';
import { DESIGNS, resolveDesign } from '../lib/theme';

// styles.css는 vitest가 비워서 읽으므로(?raw도) 파일을 직접 읽음
const css: string = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

// 2.1 화면 디자인 10가지: themes.json(← tools/make_themes.py) · styles.css · index.html · lib/theme.ts가 서로 맞는지
// @ts-expect-error 시험에서만 쓰는 node 모듈 (타입 꾸러미를 넣지 않음)
import { readFileSync } from 'node:fs';
import html from '../../index.html?raw';
import themeTs from '../lib/theme.ts?raw';

describe('화면 디자인', () => {
  it('밝은 6 + 어두운 4 = 10가지, id가 겹치지 않음', () => {
    expect(DESIGNS).toHaveLength(10);
    expect(new Set(DESIGNS.map((d) => d.id)).size).toBe(10);
    expect(DESIGNS.filter((d) => d.scheme === 'light')).toHaveLength(6);
    expect(DESIGNS.filter((d) => d.scheme === 'dark')).toHaveLength(4);
  });

  it('2.0에서 저장한 값(light·dark·system)이 그대로 통함', () => {
    expect(resolveDesign('light', true).id).toBe('light');
    expect(resolveDesign('dark', false).id).toBe('dark');
    expect(resolveDesign('system', false).id).toBe('light');
    expect(resolveDesign('system', true).id).toBe('dark');
    expect(resolveDesign('없는 디자인', false).id).toBe('light');
  });

  it('디자인마다 styles.css에 색 묶음이 있음', () => {
    for (const d of DESIGNS) {
      const sel = d.id === 'light' ? ':root, :root[data-theme="light"] {' : `:root[data-theme="${d.id}"] {`;
      const at = css.indexOf(sel);
      expect(at, d.id).toBeGreaterThan(-1);
      const block = css.slice(at, css.indexOf('}', at));
      expect(block, d.id).toContain(`--bg: ${d.swatch[0]};`);
      expect(block, d.id).toContain(`--accent: ${d.swatch[1]};`);
      expect(block, d.id).toContain(`color-scheme: ${d.scheme};`);
    }
  });

  it('index.html 첫 칠 스크립트의 어두운 디자인 목록이 themes.json과 같음', () => {
    const m = html.match(/D=' ([a-z ]+) '/);
    expect(m?.[1].split(' ').sort()).toEqual(themes.designs.filter((d) => d.scheme === 'dark').map((d) => d.id).sort());
  });

  it('디자인 이름이 모두 번역 대상(tk)에 들어 있음', () => {
    for (const d of themes.designs) expect(themeTs, d.name).toContain(`tk('${d.name}')`);
  });
});
