import { useState } from 'react';
import { t } from '../lib/i18n';
import { DESIGNS, getTheme, setTheme, type ThemeMode } from '../lib/theme';

// 왼쪽 목차 아래: 화면 디자인 (밝은 6 · 어두운 4 · 기기 설정 따르기). 누르면 바로 바뀜.
export function ThemePick() {
  const [mode, setMode] = useState<ThemeMode>(getTheme());
  const [open, setOpen] = useState(false);
  const pick = (m: ThemeMode) => { setMode(m); setTheme(m); };
  const now = mode === 'system' ? t('기기 설정 따르기') : t(DESIGNS.find((d) => d.id === mode)?.name ?? '민트');
  const chip = (id: ThemeMode, name: string, swatch?: string[]) => (
    <button key={id} type="button" role="radio" aria-checked={mode === id} className="design-chip" onClick={() => pick(id)}>
      <span className={`design-dot${swatch ? '' : ' auto'}`} aria-hidden="true"
        style={swatch ? { background: `linear-gradient(135deg, ${swatch[0]} 0 50%, ${swatch[1]} 50% 100%)`, boxShadow: `inset 0 0 0 3px ${swatch[2]}` } : undefined} />
      <span>{name}</span>
    </button>
  );
  return (
    <div className="theme-pick">
      <button type="button" className="design-open" aria-expanded={open} aria-controls="design-list" onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">🎨</span>
        <span className="design-open-t">{t('화면 디자인')}: <b>{now}</b></span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div id="design-list" className="design-list" role="radiogroup" aria-label={t('화면 디자인')}>
          {chip('system', t('기기 설정 따르기'))}
          <p className="design-group">{t('밝은 화면')}</p>
          {DESIGNS.filter((d) => d.scheme === 'light').map((d) => chip(d.id, t(d.name), d.swatch))}
          <p className="design-group">{t('어두운 화면')}</p>
          {DESIGNS.filter((d) => d.scheme === 'dark').map((d) => chip(d.id, t(d.name), d.swatch))}
        </div>
      )}
    </div>
  );
}
