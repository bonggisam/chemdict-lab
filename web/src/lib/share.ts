// 실험 공유 링크: 교사가 정한 실험·측정 간격·보드·계산 열을 주소(#x=...)에 담는다.
// 서버 없이 주소만으로 동작 (학생 정보는 담지 않음).
import type { CustomCalc } from './formula';
import type { CustomExp } from './custom';

export interface ShareSpec {
  e: string;              // 실험 id (교육과정 실험 또는 quick-<부품 id>)
  i?: number;             // 측정 간격 ms
  b?: string;             // 보드 id
  c?: CustomCalc;         // 계산 열
  x?: CustomExp;          // 2.0: 선생님이 만든 실험 (e는 그 실험 id)
}

const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
};

export function shareUrl(spec: ShareSpec): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#x=${b64url(JSON.stringify(spec))}`;
}

/** 지금 주소에 공유 실험이 있으면 읽고, 주소에서는 지움 (새로고침해도 다시 열리지 않게) */
export function takeShareFromUrl(): ShareSpec | null {
  const m = /[#&]x=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (!m) return null;
  try { history.replaceState(history.state, '', location.pathname + location.search); } catch { /* noop */ }
  try {
    const o = JSON.parse(unb64url(m[1])) as ShareSpec;
    return typeof o.e === 'string' ? o : null;
  } catch { return null; }
}
