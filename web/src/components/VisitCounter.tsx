import { useEffect, useState } from 'react';
import { t } from '../lib/i18n';

// 왼쪽 목차 맨 아래: 웹앱 전체 방문 수만 보여 줌 (GoatCounter 공개 카운터, 다른 통계는 개발자만 봄)
// GoatCounter 설정의 "Allow adding visitor counts on your website"가 켜져 있어야 숫자가 옴. 실패하면 아무것도 안 보임.
const URL_TOTAL = 'https://chemdict.goatcounter.com/counter/TOTAL.json';

export function VisitCounter() {
  const [count, setCount] = useState<string | null>(null);
  useEffect(() => {
    if (!/^https:/.test(location.protocol) || /^(localhost|127\.)/.test(location.hostname)) return;
    const ctl = new AbortController();
    const id = setTimeout(() => {
      fetch(URL_TOTAL, { signal: ctl.signal, cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { count?: string } | null) => { if (j?.count) setCount(String(j.count).trim()); })
        .catch(() => {});
    }, 1500); // 방문 기록(count.js)이 먼저 가도록 조금 기다림
    return () => { clearTimeout(id); ctl.abort(); };
  }, []);
  if (!count) return null;
  return <p className="visit-count" aria-label={t('방문 {n}', { n: count })}><span aria-hidden="true">👀</span> {t('방문 {n}', { n: count })}</p>;
}
