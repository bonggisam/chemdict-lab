// 화면 아이콘(이모지): 글자 옆에 붙여 한눈에 알아보게. 번역 문구에는 넣지 않고 따로 붙인다.
export const CAT_ICON: Record<string, string> = {
  '전체': '✨',
  '온도': '🌡️',
  '온습도': '💧',
  '기압·압력': '🎈',
  '기체': '🫧',
  '빛·색': '💡',
  '물·용액': '🧪',
  '무게·거리·힘': '⚖️',
  '움직임·자기': '🧲',
  '전기·소리': '⚡',
  '생체': '❤️',
};
export const catIcon = (c: string) => CAT_ICON[c] ?? '🔬';

/** 아이콘 + 글자 (아이콘은 화면 읽기에서 건너뜀) */
export const ICON = {
  usb: '🔌', ble: '📡', sim: '🧪', board: '🧩', next: '➡️',
  start: '▶', stop: '■', marker: '📌', guide: '🧭', setup: '⚙️', cal: '🎯',
  predict: '✏️', table: '📋', share: '🔗', save: '💾', open: '📂', recent: '🕘',
  supply: '🧾', experiment: '🔬', analysis: '🔍', trigger: '⏱️', calc: '🧮', info: '🏷️',
  print: '🖨️', copy: '📄', lang: '🌐', fw: '⬇️', check: '✅', warn: '⚠️',
};
