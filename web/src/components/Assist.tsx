import { useEffect, useState } from 'react';
import { t, tk } from '../lib/i18n';
import {
  A11Y, ALERT_EVT, ALERT_SYMBOL, LIVE_ID, SPEAK_CHOICES, announce, canSpeak, speak, stopSpeak, usePref, useSpeaking, type LabAlert,
} from '../lib/assist';

// 2.2 손쉬운 사용: 화면 읽기 알림 칸 · 측정 알림 띠(테두리 번쩍) · 읽어 주기 버튼 · 설정 (애플 앱 Assist.swift와 같음)

/** 화면 읽기 프로그램이 읽는 숨은 칸 (App에 하나) */
export function LiveRegion() {
  return <div id={LIVE_ID} className="sr-only" role="status" aria-live="assertive" aria-atomic="true" />;
}

/** 시작·정지·끊김 알림: 위쪽 띠(기호 + 글) + 설정이 켜져 있으면 화면 테두리 번쩍 */
export function AlertOverlay() {
  const [a, setA] = useState<LabAlert | null>(null);
  const [flash] = usePref(A11Y.flash);
  useEffect(() => {
    let timer = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<LabAlert>).detail;
      setA(d);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setA((x) => (x?.id === d.id ? null : x)), 3000);
    };
    window.addEventListener(ALERT_EVT, on);
    return () => { window.removeEventListener(ALERT_EVT, on); window.clearTimeout(timer); };
  }, []);
  if (!a) return null;
  return (
    <>
      {flash === '1' && <div key={`f${a.id}`} className={`a11y-flash k-${a.kind}`} aria-hidden="true" />}
      <div key={`b${a.id}`} className={`a11y-alert k-${a.kind}`} aria-hidden="true">
        <span className="sym">{ALERT_SYMBOL[a.kind]}</span>{a.text}
      </div>
    </>
  );
}

/** 🔊 읽어 주기: 누르면 기기 음성으로 읽고, 읽는 중에 누르면 멈춤 */
export function ReadAloud({ lines, id, label = tk('읽어 주기'), iconOnly = false }: { lines: string[]; id: string; label?: string; iconOnly?: boolean }) {
  const now = useSpeaking();
  useEffect(() => () => { if (now === id) stopSpeak(); }, [now, id]);
  if (!canSpeak()) return null;
  const on = now === id;
  const name = on ? t('읽기 멈추기') : t(label);
  return (
    <button type="button" className="ghost read-aloud" aria-pressed={on} aria-label={iconOnly ? name : undefined} title={name}
      onClick={() => (on ? stopSpeak() : speak(lines, id))}>
      <span aria-hidden="true">{on ? '⏹' : '🔊'}</span>{!iconOnly && <> {name}</>}
    </button>
  );
}

/** 왼쪽 목차 아래: ♿ 손쉬운 사용 설정 */
export function AssistSettings() {
  const [open, setOpen] = useState(false);
  const [every, setEvery] = usePref(A11Y.speakEvery);
  const [voice, setVoice] = usePref(A11Y.voice);
  const [haptic, setHaptic] = usePref(A11Y.haptic);
  const [flash, setFlash] = usePref(A11Y.flash);
  const [big, setBig] = usePref(A11Y.big);
  const check = (label: string, v: string, set: (x: string) => void) => (
    <label className="check a11y-row"><input type="checkbox" checked={v === '1'} onChange={(e) => set(e.target.checked ? '1' : '0')} /> {label}</label>
  );
  const vib = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  return (
    <div className="theme-pick a11y-pick">
      <button type="button" className="a11y-open" aria-expanded={open} aria-controls="a11y-list" onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">♿</span>
        <span className="design-open-t">{t('손쉬운 사용')}</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div id="a11y-list" className="a11y-list">
          <label className="a11y-row">{t('측정 중 값 읽어 주기')}
            <select value={every} onChange={(e) => setEvery(e.target.value)}>
              {SPEAK_CHOICES.map((s) => <option key={s} value={String(s)}>{s === 0 ? t('끄기') : s < 60 ? t('{n}초마다', { n: s }) : t('1분마다')}</option>)}
            </select>
          </label>
          {check(t('알림을 음성으로 (화면 읽기 프로그램을 쓰지 않을 때)'), voice, setVoice)}
          {vib && check(t('알림 때 진동'), haptic, setHaptic)}
          {check(t('알림 때 화면 테두리 번쩍'), flash, setFlash)}
          {check(t('큰 버튼 화면 (측정 화면)'), big, setBig)}
          <button type="button" className="ghost" onClick={() => announce(t('측정을 시작했습니다'), true)}>🔔 {t('알림 시험')}</button>
          <p className="note">{t('키보드: Alt+R 측정 시작·정지 · Alt+D 표시 · Alt+L 지금 값 듣기 · Alt+1~3 칸 바꾸기. 그래프를 고른 뒤 ←→로 점을 하나씩 듣고, [ ]로 구간을 고릅니다.')}</p>
        </div>
      )}
    </div>
  );
}
