// 2.2 손쉬운 사용 (장애가 있는 학생·교사): 소리로 알리기 · 진동 · 화면 번쩍 · 읽어 주기 · 큰 버튼 화면 · 색 이름.
// 애플 앱 Assist.swift와 같은 설정 이름(localStorage)·같은 문장. 규칙은 docs/DESIGN.md 7장.
import { useEffect, useState } from 'react';
import { getLang, t } from './i18n';

export const A11Y = {
  speakEvery: 'chemdict.a11y.speakEvery', // 측정 중 지금 값을 읽는 간격(초), 0 = 끔
  voice: 'chemdict.a11y.voice',           // 알림을 기기 음성으로
  haptic: 'chemdict.a11y.haptic',         // 알림 때 진동 (안드로이드 휴대폰·태블릿)
  flash: 'chemdict.a11y.flash',           // 알림 때 화면 테두리 번쩍
  big: 'chemdict.a11y.big',               // 큰 버튼 화면
  reader: 'chemdict.a11y.reader',         // 값을 읽는 방법: voice(기기 음성) · sr(화면 읽기 프로그램) — 웹은 화면 읽기 프로그램을 켰는지 알 수 없음
} as const;
type Key = (typeof A11Y)[keyof typeof A11Y];

const DEFAULTS: Record<Key, string> = {
  [A11Y.speakEvery]: '0', [A11Y.voice]: '0', [A11Y.haptic]: '1', [A11Y.flash]: '1', [A11Y.big]: '0', [A11Y.reader]: 'voice',
};
export const SPEAK_CHOICES = [0, 5, 10, 30, 60];
const EVT = 'chemdict-a11y';

export function getPref(k: Key): string {
  try { return localStorage.getItem(k) ?? DEFAULTS[k]; } catch { return DEFAULTS[k]; }
}
export const prefOn = (k: Key) => getPref(k) === '1';
export function setPref(k: Key, v: string) {
  try { localStorage.setItem(k, v); } catch { /* 저장 못 해도 이번에는 바뀜 */ }
  mem[k] = v;
  window.dispatchEvent(new Event(EVT));
}
const mem: Partial<Record<Key, string>> = {};
const read = (k: Key) => mem[k] ?? getPref(k);

/** 설정 하나를 읽고 바꾸는 훅 (다른 칸에서 바꿔도 바로 따라감) */
export function usePref(k: Key): [string, (v: string) => void] {
  const [v, setV] = useState(() => read(k));
  useEffect(() => {
    const on = () => setV(read(k));
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, [k]);
  return [v, (x: string) => setPref(k, x)];
}

/** 머리에 붙은 이모지·기호를 뺀 문장 (화면 읽기·읽어 주기용) */
export function plain(s: string): string {
  const out = s.replace(/^(?:[\s‍️]|(?![←-⇿℃])\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])+/u, '');
  return out || s;
}

// ---------- 소리로 알리기 ----------

/** 화면 읽기 프로그램이 읽는 칸 (App에 하나) */
export const LIVE_ID = 'a11y-live';

function live(text: string) {
  const el = typeof document !== 'undefined' ? document.getElementById(LIVE_ID) : null;
  if (!el) return;
  el.textContent = '';
  window.setTimeout(() => { el.textContent = text; }, 60);
}

const VOICE_LANG: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', vi: 'vi-VN', id: 'id-ID' };
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

let speakingId: string | null = null;
const speakers = new Set<() => void>();
const setSpeaking = (id: string | null) => { speakingId = id; speakers.forEach((f) => f()); };

/** 마이크로 재는 중: 기기 음성이 측정값에 섞이므로 소리 내어 읽지 않음 (화면 읽기 칸·알림 띠는 그대로) */
let micBusy = false;
export const setMicBusy = (v: boolean) => { micBusy = v; if (v && canSpeak()) window.speechSynthesis.cancel(); };
export const isMicBusy = () => micBusy;

/** 기기 음성으로 읽기 (interrupt: 읽던 것을 끊고) */
export function speak(lines: string[], id: string | null = null, interrupt = true) {
  if (!canSpeak() || micBusy) return;
  const ss = window.speechSynthesis;
  if (interrupt) ss.cancel();
  const list = lines.map((l) => plain(l).trim()).filter(Boolean);
  list.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE_LANG[getLang()] ?? 'ko-KR';
    if (i === list.length - 1) u.onend = u.onerror = () => { if (!ss.speaking || speakingId === id) setSpeaking(null); };
    ss.speak(u);
  });
  if (id) setSpeaking(id);
}
export function stopSpeak() {
  if (canSpeak()) window.speechSynthesis.cancel();
  setSpeaking(null);
}
/** 지금 읽고 있는 묶음 id */
export function useSpeaking(): string | null {
  const [v, setV] = useState(speakingId);
  useEffect(() => {
    const f = () => setV(speakingId);
    speakers.add(f);
    return () => { speakers.delete(f); };
  }, []);
  return v;
}

/** 알림 읽기: '알림을 음성으로'(또는 force — 값 읽기)면 기기 음성, 아니면 화면 읽기 프로그램 칸.
 *  '읽는 방법'을 화면 읽기 프로그램으로 고르면 값 읽기도 그 칸으로 (두 번 읽지 않게). 마이크로 재는 중에는 늘 칸으로. */
export function announce(text: string, force = false) {
  const s = plain(text);
  if (!s) return;
  const wantVoice = force ? getPref(A11Y.reader) !== 'sr' : prefOn(A11Y.voice);
  if (wantVoice && canSpeak() && !micBusy) speak([s], null, false);
  else live(s);
}

// ---------- 측정 알림 (시작 · 정지 · 끊김) ----------

export type AlertKind = 'start' | 'stop' | 'warn' | 'ok';
export interface LabAlert { id: number; kind: AlertKind; text: string }
export const ALERT_EVT = 'chemdict-alert';
export const ALERT_SYMBOL: Record<AlertKind, string> = { start: '●', stop: '■', warn: '▲', ok: '✓' };
let alertSeq = 0;

/** 알림 띠 + 화면 번쩍 + 진동 (+ speak면 읽기) */
export function raise(kind: AlertKind, text: string, speakIt = true) {
  const a: LabAlert = { id: ++alertSeq, kind, text };
  window.dispatchEvent(new CustomEvent<LabAlert>(ALERT_EVT, { detail: a }));
  if (prefOn(A11Y.haptic) && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(kind === 'warn' ? [120, 80, 120, 80, 120] : kind === 'stop' ? [60] : [80, 60, 80]); } catch { /* 진동이 없는 기기 */ }
  }
  if (speakIt) announce(text);
}

// ---------- 색 이름 (색을 구별하기 어려운 사람) ----------

/** 배선 선 색 이름 (guide.json의 color) */
export function wireName(c: string): string {
  const m: Record<string, string> = { red: '빨간 선', black: '검은 선', yellow: '노란 선', blue: '파란 선', orange: '주황 선', white: '흰 선' };
  return m[c] ?? '초록 선';
}

/** RGB(0~255) → 가까운 색 이름 (카메라 색 센서) — 애플 ColorName.of와 같은 규칙 */
export function colorName(r: number, g: number, b: number): string {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2 / 255, d = mx - mn;
  const s = d < 1 ? 0 : d / (255 - Math.abs(mx + mn - 255));
  if (s < 0.15 || d < 18) return l < 0.15 ? '검정' : l > 0.85 ? '흰색' : l < 0.45 ? '어두운 회색' : '회색';
  let h = mx === r ? (g - b) / d : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  let base = h < 15 || h >= 345 ? '빨강' : h < 40 ? (l < 0.4 ? '갈색' : '주황') : h < 65 ? '노랑' : h < 90 ? '연두' : h < 160 ? '초록' : h < 195 ? '청록' : h < 250 ? '파랑' : h < 290 ? '보라' : '분홍';
  if (l < 0.25) base = '어두운 ' + base;
  else if (l > 0.78) base = '연한 ' + base;
  return base;
}

/** 브레드보드 자리: "c6" → "구멍 c6", "T+:3" → "위쪽 + 줄", "pin:5V" → "보드 5V" */
export function bbSpot(n: string): string {
  if (n.startsWith('pin:')) return `${t('보드')} ${n.slice(4)}`;
  const rail = n.split(':')[0];
  const m: Record<string, string> = { 'T+': '위쪽 + 줄', 'T-': '위쪽 − 줄', 'B+': '아래쪽 + 줄', 'B-': '아래쪽 − 줄' };
  return m[rail] ? t(m[rail]) : `${t('구멍')} ${n}`;
}

// t()로 뽑히도록 한국어 원문을 한 번씩 적어 둠 (i18n_extract)
export const A11Y_WORDS = () => [
  t('빨간 선'), t('검은 선'), t('노란 선'), t('파란 선'), t('주황 선'), t('흰 선'), t('초록 선'),
  t('검정'), t('흰색'), t('어두운 회색'), t('회색'), t('빨강'), t('갈색'), t('주황'), t('노랑'), t('연두'), t('초록'), t('청록'), t('파랑'), t('보라'), t('분홍'),
  t('위쪽 + 줄'), t('위쪽 − 줄'), t('아래쪽 + 줄'), t('아래쪽 − 줄'), t('어두운'), t('연한'),
];

/** 색 이름 번역: "어두운 빨강" → 앞말과 색을 따로 (애플 앱은 '어두운 %@' 틀) */
export function tColor(name: string): string {
  const m = name.match(/^(어두운|연한) (.+)$/);
  if (!m) return t(name);
  return m[1] === '어두운' ? t('어두운 {color}', { color: t(m[2]) }) : t('연한 {color}', { color: t(m[2]) });
}

/** 배선표 한 줄을 글로: "빨간 선: 센서 VCC → 보드 5V" */
export function wireLine(w: { color: string; term: string; boardPin: string }): string {
  return `${t(wireName(w.color))}: ${t('센서')} ${w.term} → ${t('보드')} ${w.boardPin}`;
}

/** 브레드보드 회로를 글로 (화면 읽기·읽어 주기) */
export function bbText(c: { wires: { a: string; b: string; color: string }[]; parts: { label: string; legs: string[] }[] }): string {
  return [
    t('브레드보드 그림'),
    ...c.wires.map((w) => `${t(wireName(w.color))}: ${bbSpot(w.a)} → ${bbSpot(w.b)}`),
    ...c.parts.map((x) => `${x.label}: ${x.legs.map(bbSpot).join(', ')}`),
  ].join('. ');
}
