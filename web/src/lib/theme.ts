// 화면 디자인 (2.1): 밝은 디자인 6가지 + 어두운 디자인 4가지 + '기기 설정 따르기'. 기본은 민트(밝게).
// <html data-theme="디자인 id" data-scheme="light|dark"> 로 styles.css의 색을 고른다 (색 값: protocol/themes.json ← tools/make_themes.py).
// 고른 값은 이 브라우저에만 저장. 2.0의 값(light·dark·system)은 그대로 통한다. index.html의 첫 줄 스크립트가 같은 규칙으로 먼저 칠한다.
import themes from '../../../protocol/themes.json';
import { tk } from './i18n';

export interface Design { id: string; name: string; scheme: 'light' | 'dark'; swatch: string[]; chromeBg: string }
/** 'system' 또는 디자인 id */
export type ThemeMode = string;
const KEY = 'chemdict.theme';

export const DESIGNS: Design[] = themes.designs.map((d) => ({
  id: d.id, name: d.name, scheme: d.scheme as 'light' | 'dark', swatch: d.swatch, chromeBg: d.tokens.chromeBg,
}));

// 디자인 이름 (번역 대상 — protocol/themes.json의 name과 같아야 함: tests/theme.test.ts)
tk('민트'); tk('바다'); tk('라벤더'); tk('벚꽃'); tk('종이'); tk('흑백'); tk('숲'); tk('칠판'); tk('밤바다'); tk('고대비');

const byId = (id: string) => DESIGNS.find((d) => d.id === id);

export function getTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'system' || (v && byId(v))) return v;
  } catch { /* 저장소를 못 쓰면 기본값 */ }
  return themes.default;
}

function systemDark() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** 고른 값이 실제로 보여 줄 디자인 ('기기 설정 따르기'는 기기가 어두우면 숲, 밝으면 민트) */
export function resolveDesign(mode: ThemeMode = getTheme(), dark = systemDark()): Design {
  const id = mode === 'system' ? (dark ? themes.system.dark : themes.system.light) : mode;
  return byId(id) ?? byId(themes.default)!;
}

let watching = false;
export function applyTheme(mode: ThemeMode = getTheme()) {
  if (typeof document === 'undefined') return;
  const d = resolveDesign(mode);
  const root = document.documentElement;
  root.dataset.theme = d.id;
  root.dataset.scheme = d.scheme;
  // 주소창·설치 앱 위쪽 색도 디자인에 맞춤 (목차·위쪽 띠 색)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', d.chromeBg);
  if (!watching && typeof matchMedia === 'function') {
    watching = true;   // '기기 설정 따르기'일 때 기기가 밝게/어둡게 바뀌면 따라감
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (getTheme() === 'system') applyTheme('system'); });
  }
  window.dispatchEvent(new Event('chemdict-theme'));
}

export function setTheme(mode: ThemeMode) {
  try { localStorage.setItem(KEY, mode); } catch { /* 이번 화면에만 적용 */ }
  applyTheme(mode);
}
