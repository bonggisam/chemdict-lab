// 2.1 긴 측정: 측정하는 동안 화면이 저절로 꺼지지 않게 함 (Screen Wake Lock).
// 탭을 가렸다가 다시 보면 잠금이 풀리므로 다시 잡는다. 지원하지 않는 브라우저에서는 아무 일도 하지 않는다.
let want = false;
let lock: WakeLockSentinel | null = null;

export const wakeSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;

async function acquire() {
  if (!want || lock || !wakeSupported() || typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  try {
    const l = await navigator.wakeLock.request('screen');
    l.addEventListener('release', () => { if (lock === l) lock = null; });
    if (!want) { l.release().catch(() => {}); return; }
    lock = l;
  } catch { /* 배터리 절약 모드 등으로 못 잡아도 측정은 계속 */ }
}

/** 측정 중이면 true로, 멈추면 false로 부른다 */
export function keepAwake(on: boolean) {
  want = on;
  if (on) void acquire();
  else if (lock) { const l = lock; lock = null; l.release().catch(() => {}); }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void acquire(); });
}
