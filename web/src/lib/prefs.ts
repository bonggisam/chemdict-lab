// 2.0: 쉬운 화면 / 탐구 화면 (이 기기에만 기억)
import { useEffect, useState } from 'react';

const KEY = 'chemdict.explore';
const EVT = 'chemdict-explore';

export function loadExplore(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function useExplore(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(loadExplore);
  useEffect(() => {
    const on = () => setV(loadExplore());
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  const set = (x: boolean) => {
    try { localStorage.setItem(KEY, x ? '1' : '0'); } catch { /* 저장 못 해도 이번에는 바뀜 */ }
    setV(x);
    window.dispatchEvent(new Event(EVT));
  };
  return [v, set];
}
