import { useState } from 'react';
import { t } from '../lib/i18n';
import { getTheme, setTheme, type ThemeMode } from '../lib/theme';

// 왼쪽 목차 아래: 화면 모드 (기본 밝게)
export function ThemePick() {
  const [mode, setMode] = useState<ThemeMode>(getTheme());
  return (
    <label className="lang-pick theme-pick">
      <span aria-hidden="true">🌓</span>
      <select aria-label={t('화면 모드')} value={mode} onChange={(e) => { const m = e.target.value as ThemeMode; setMode(m); setTheme(m); }}>
        <option value="light">{t('밝게')}</option>
        <option value="dark">{t('어둡게')}</option>
        <option value="system">{t('기기 설정 따르기')}</option>
      </select>
    </label>
  );
}
