// 익명 사용 통계 (GoatCounter, 웹앱만).
// 보내는 것: "어떤 실험·센서·도구가 쓰였는지"의 이름(id)뿐. 측정값·사진·활동지·모둠/이름·선생님이 입력한 제목은 보내지 않는다.
// 쿠키를 쓰지 않으며, 같은 항목은 페이지를 한 번 열 때 한 번만 센다.

export type TrackKind = 'exp' | 'sensor' | 'tool' | 'board' | 'save' | 'lang' | 'parts' | 'app';

interface GoatCounter { count: (o: { path: string; title?: string; event?: boolean }) => void }
declare global { interface Window { goatcounter?: GoatCounter } }

const sent = new Set<string>();

/** 통계 경로 이름: 영문·숫자·-_. 만 남기고 길이를 줄인다 (식별 정보가 들어갈 틈을 없앰) */
export function eventPath(kind: TrackKind, name: string): string {
  const clean = String(name).replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 60);
  return `${kind}/${clean || 'unknown'}`;
}

/** 선생님이 만든 실험(id가 my-…)은 내용을 짐작할 수 없게 하나로 묶는다 */
export function expName(id: string): string {
  return id.startsWith('my-') ? 'custom' : id;
}

function send(path: string, tries = 0) {
  if (typeof window === 'undefined') return;
  const gc = window.goatcounter;
  if (gc?.count) { try { gc.count({ path, title: path, event: true }); } catch { /* 통계 실패는 무시 */ } return; }
  if (tries < 15) setTimeout(() => send(path, tries + 1), 2000); // count.js가 늦게 오면 잠시 기다림 (오프라인이면 조용히 포기)
}

export function track(kind: TrackKind, name: string | undefined | null) {
  if (!name) return;
  const path = eventPath(kind, name);
  if (sent.has(path)) return;
  sent.add(path);
  send(path);
}

/** 시험용 */
export function _resetTrack() { sent.clear(); }
