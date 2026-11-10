// 화면 모드 (2.0 A안): 기본은 밝게. 사용자가 '어둡게'나 '기기 설정 따르기'를 고를 수 있다.
// <html data-theme="light|dark|system"> 으로 styles.css의 어두운 색을 켜고 끈다. 고른 값은 이 브라우저에만 저장.
export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'chemdict.theme';

export function getTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'dark' || v === 'system' || v === 'light') return v;
  } catch { /* 저장소를 못 쓰면 기본값 */ }
  return 'light';
}

export function applyTheme(mode: ThemeMode = getTheme()) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = mode;
  window.dispatchEvent(new Event('chemdict-theme'));
}

export function setTheme(mode: ThemeMode) {
  try { localStorage.setItem(KEY, mode); } catch { /* 이번 화면에만 적용 */ }
  applyTheme(mode);
}
