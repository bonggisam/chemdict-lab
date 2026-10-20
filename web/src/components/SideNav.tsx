import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../lib/i18n';

export type NavScreen = 'connect' | 'pick' | 'measure' | 'guide';

interface Section { id: string; label: string; level: 2 | 3 }

interface Props {
  screen: NavScreen;
  expTitle?: string;          // 고른 실험 (측정 화면으로 가는 가지)
  connected: boolean;
  boardName: string;
  running: boolean;
  onGo: (s: NavScreen) => void;
  footer?: ReactNode;          // 연결 상태·언어
}

/** 본문(#content)의 제목들을 읽어 지금 화면의 가지를 만든다 */
function useSections(screen: NavScreen) {
  const [list, setList] = useState<Section[]>([]);
  const [active, setActive] = useState('');
  useEffect(() => {
    const root = document.getElementById('content');
    if (!root) return;
    let timer = 0;
    const scan = () => {
      const els = Array.from(root.querySelectorAll<HTMLElement>('[data-nav], main h2'))
        .filter((el) => el.offsetParent !== null && !el.closest('.sheet-backdrop, details:not([open]) > :not(summary)'));
      const seen = new Set<string>();
      const next: Section[] = [];
      els.forEach((el, i) => {
        const host = el.matches('h2') ? (el.closest('section, .row-head') as HTMLElement | null) ?? el : el;
        if (seen.has(host.id) && host.id) return;
        if (!host.id) host.id = `sec-${screen}-${i}`;
        seen.add(host.id);
        const label = el.dataset.nav ?? Array.from(el.childNodes).filter((n) => !(n instanceof HTMLElement && n.matches('[aria-hidden="true"], button, select, .seg'))).map((n) => n.textContent).join('').trim();
        if (label) next.push({ id: host.id, label, level: el.dataset.navLevel === '3' ? 3 : 2 });
      });
      setList((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    };
    const later = () => { window.clearTimeout(timer); timer = window.setTimeout(scan, 120); };
    scan();
    const mo = new MutationObserver(later);
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    return () => { mo.disconnect(); window.clearTimeout(timer); };
  }, [screen]);

  // 화면에 보이는 가장 위 제목을 표시
  useEffect(() => {
    const onScroll = () => {
      let cur = list[0]?.id ?? '';
      for (const s of list) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < 140) cur = s.id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [list]);
  return { list, active };
}

/** 왼쪽 목차: 단계 → 단계 안의 내용 (나무 구조) */
export function SideNav({ screen, expTitle, connected, boardName, running, onGo, footer }: Props) {
  const { list, active } = useSections(screen);
  const [open, setOpen] = useState(false);       // 좁은 화면에서 목차 펼침
  const navRef = useRef<HTMLElement>(null);
  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setOpen(false);
  };
  const jump = (s: NavScreen) => { setOpen(false); if (s !== screen) { onGo(s); window.scrollTo({ top: 0 }); } };

  const kids = (s: NavScreen) => (s === screen && list.length > 0 ? (
    <ul className="tree-kids">
      {list.map((x) => (
        <li key={x.id} className={x.level === 3 ? 'lv3' : ''}>
          <button className={active === x.id ? 'on' : ''} aria-current={active === x.id ? 'location' : undefined} onClick={() => go(x.id)}>{x.label}</button>
        </li>
      ))}
    </ul>
  ) : null);

  const step = (s: NavScreen, n: string, label: string, sub: string, done: boolean, on: boolean, children?: ReactNode) => (
    <li className={`tree-step ${on ? 'on' : ''} ${done ? 'done' : ''}`}>
      <button className="tree-head" aria-current={on ? 'step' : undefined} disabled={running && !on} onClick={() => jump(s)}>
        <span className="n" aria-hidden="true">{done ? '✓' : n}</span>
        <span className="tt"><b>{label}</b><small>{sub}</small></span>
      </button>
      {children}
    </li>
  );

  const current = screen === 'connect' ? t('보드 연결') : screen === 'guide' ? t('연결 방법 · 문제 해결') : screen === 'measure' ? (expTitle ?? t('측정')) : t('실험');

  return (
    <aside className={`side ${open ? 'open' : ''}`} ref={navRef}>
      <div className="side-top">
        <div className="brand">
          <img className="logo" src={`${import.meta.env.BASE_URL}logo-128.png`} alt="" width={32} height={32} />
          <span>ChemDict Lab</span>
        </div>
        <button className="ghost side-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">☰</span> <span className="side-now">{current}</span>
        </button>
      </div>
      <nav className="side-tree" aria-label={t('단계')}>
        <ol>
          {step('connect', '1', t('보드 연결'), connected ? `✓ ${boardName}` : t('보드 고르기 · 연결'), connected && screen !== 'connect', screen === 'connect', kids('connect'))}
          {step('pick', '2', t('실험'), expTitle ? t('센서 고르기 · 측정') : t('센서 고르기 · 측정'), false, screen === 'pick' || screen === 'measure', (
            <>
              {kids('pick')}
              {expTitle && (
                <ul className="tree-kids">
                  <li className="tree-branch">
                    <button className={`branch-head ${screen === 'measure' ? 'on' : ''}`} onClick={() => jump('measure')}>
                      <span aria-hidden="true">{running ? '🔴' : '📈'}</span> {expTitle}
                    </button>
                    {kids('measure')}
                  </li>
                </ul>
              )}
            </>
          ))}
          {step('guide', '3', t('연결 방법 · 문제 해결'), t('연결 그림 · 브레드보드'), false, screen === 'guide', kids('guide'))}
        </ol>
      </nav>
      <div className="side-foot">{footer}</div>
    </aside>
  );
}
