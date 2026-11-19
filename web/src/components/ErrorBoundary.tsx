import { Component, type ReactNode } from 'react';
import { t } from '../lib/i18n';

/** 2.1: 화면을 그리다 오류가 나도 흰 화면으로 끝나지 않게 — 무슨 일인지 알리고 다시 열게 함 (측정은 자동 저장되어 있음) */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="wide crash" role="alert">
        <h1>{t('화면을 표시하다 문제가 생겼습니다')}</h1>
        <p>{t('측정한 데이터는 자동으로 저장되어 있습니다. 다시 열면 ‘이어서 하기’에서 볼 수 있습니다.')}</p>
        <p><button className="primary" onClick={() => { location.hash = ''; location.reload(); }}>{t('다시 열기')}</button></p>
      </main>
    );
  }
}
