// 다국어: 화면 문구는 t('한국어 원문'), 안내·실험 내용은 l10n.ts가 protocol/i18n/<lang>/content.json으로 바꿈.
// 원문(한국어)이 곧 키입니다. 번역이 없으면 한국어가 그대로 보입니다.
// 화면 문구 원문 목록: python3 tools/i18n_extract.py 가 t('…') 호출을 모아 protocol/i18n/source/ui.json 을 만듭니다.

export const LANGS = [
  { code: 'ko', name: '한국어' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '简体中文' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'id', name: 'Bahasa Indonesia' },
] as const;
export type Lang = typeof LANGS[number]['code'];

const uiFiles = import.meta.glob('../../../protocol/i18n/*/ui.json', { import: 'default' });
const contentFiles = import.meta.glob('../../../protocol/i18n/*/content.json', { import: 'default' });

let lang: Lang = 'ko';
let ui: Record<string, string> = {};
let content: Record<string, string> = {};

export const getLang = () => lang;

const KEY = 'chemdict.lang';
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null;
    if (saved && LANGS.some((l) => l.code === saved)) return saved;
  } catch { /* noop */ }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'ko').toLowerCase();
  const hit = LANGS.find((l) => nav.startsWith(l.code));
  return hit?.code ?? 'en';
}

/** 언어 바꾸기: 번역 파일을 불러온 뒤 적용 */
export async function loadLang(code: Lang): Promise<void> {
  if (code === 'ko') { ui = {}; content = {}; }
  else {
    const u = uiFiles[`../../../protocol/i18n/${code}/ui.json`];
    const c = contentFiles[`../../../protocol/i18n/${code}/content.json`];
    ui = u ? ((await u()) as Record<string, string>) : {};
    content = c ? ((await c()) as Record<string, string>) : {};
  }
  lang = code;
  try { localStorage.setItem(KEY, code); } catch { /* noop */ }
  if (typeof document !== 'undefined') document.documentElement.lang = code === 'zh' ? 'zh-Hans' : code;
}

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;

/** 화면 문구: t('측정 시작'), t('{n}개 실험', { n: 3 }) */
export function t(ko: string, vars?: Record<string, string | number>): string {
  return fill(lang === 'ko' ? ko : ui[ko] || ko, vars);
}

/** 상수에 적어 두는 문구 표시 (번역 원문 모으기용, 값은 그대로). 화면에 낼 때 t(x)로 */
export const tk = (ko: string) => ko;

/** 내용 문구 (guide·실험·센서): 키로 찾고 없으면 한국어 */
export function c(key: string, ko: string): string {
  return lang === 'ko' ? ko : content[key] || ko;
}
