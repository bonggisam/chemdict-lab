import type { Board } from '../lib/guide';
import { Ico } from './Ico';
import { ICON } from '../lib/icons';
import { t, tk } from '../lib/i18n';
import { troubles } from '../lib/guide';
import { BUNDLED_FW, IDE_ONLY, TARGETS } from '../lib/flash';
import { hasBluetooth, hasSerial } from '../lib/transports';
import { BoardPicker } from './BoardPicker';
import { R } from './Rich';
import { availableKits } from '../lib/device';
import { scrollBehavior } from '../lib/sonify';

export type FwState =
  | { status: 'checking' }
  | { status: 'missing'; usbBoard?: string }          // usbBoard: USB 번호로 알아낸 보드 ('clone' = 호환 보드)
  | { status: 'outdated'; version: string }
  | { status: 'installing'; stage: 'reset' | 'write' | 'verify' | 'done'; ratio: number }
  | { status: 'done' }
  | { status: 'failed'; message: string };

interface Props {
  board: Board;
  detectedId?: string;
  onPickBoard: (id: string) => void;
  connected: boolean;
  busy: boolean;
  fw: FwState | null;
  onConnect: (kind: 'serial' | 'ble' | 'sim' | 'device') => void;
  onInstall: (boardId: string) => void;
  onNext: () => void;
}

const STAGE = { reset: tk('보드를 설치 모드로 바꾸는 중'), write: tk('측정 프로그램을 쓰는 중'), verify: tk('제대로 써졌는지 확인하는 중'), done: tk('마무리하는 중') } as const;
const REPO = 'https://github.com/bonggisam/chemdict-lab/tree/main/firmware';

/** 1단계: 보드 고르기 → 연결 → (필요하면) 측정 프로그램 설치 */
export function BoardStep({ board, detectedId, onPickBoard, connected, busy, fw, onConnect, onInstall, onNext }: Props) {
  // 설치할 보드: USB 번호로 알아낸 보드 → 아니면 사용자가 고른 보드
  const usbBoard = fw?.status === 'missing' ? fw.usbBoard : undefined;
  const targetId = usbBoard && usbBoard !== 'clone' ? usbBoard : board.id;
  const target = TARGETS[targetId];
  const ideOnly = IDE_ONLY.has(targetId);
  const failTips = troubles.find((t) => t.id === 'flash-fail');

  return (
    <main className="wide step-page">
      <h1><span className="step-no">1</span>{t('어떻게 잴까요?')}</h1>
      <p className="lede">{t('하나를 고르세요. 언제든 바꿀 수 있습니다.')}</p>
      {/* 2.0 첫 화면: 큰 버튼 3개 (이 기기 · 보드 · 체험) */}
      <div className="home-tiles" data-nav={t('어떻게 잴까요?')}>
        {availableKits().length > 0 && (
          <button className="t-dev" onClick={() => document.querySelector('.connect-device')?.scrollIntoView({ behavior: scrollBehavior() })}>
            <span className="ico" aria-hidden="true">📱</span><b>{t('이 기기로 바로 재기')}</b><span className="note">{t('선 없이 기기 센서로 (소리·빛·움직임)')}</span>
          </button>
        )}
        <button onClick={() => document.getElementById('board-connect')?.scrollIntoView({ behavior: scrollBehavior() })}>
          <span className="ico" aria-hidden="true">📡</span><b>{t('센서 보드 연결')}</b><span className="note">{t('USB · 블루투스 아두이노 보드')}</span>
        </button>
        <button className="t-sim" disabled={busy || connected} onClick={() => onConnect('sim')}>
          <span className="ico" aria-hidden="true">🧪</span><b>{t('보드 없이 체험')}</b><span className="note">{t('가상 센서로 모든 기능을 써 봅니다')}</span>
        </button>
      </div>

      <section className="guide-block" id="board-connect">
        <h2><Ico e={ICON.board} />{t('보드 고르기')}</h2>
        <p className="note">{t('가지고 있는 보드를 누르세요. USB로 연결하면 자동으로 맞춰집니다.')}</p>
        <BoardPicker board={board} detectedId={detectedId} onPick={onPickBoard} />
      </section>

      <section className="guide-block">
        <h2><Ico e={ICON.usb} />{t('연결하기')}</h2>
        <div className="connect-grid">
          <button className="big" disabled={!hasSerial() || busy || connected || board.bleOnly} onClick={() => onConnect('serial')}>
            <span className="big-ico" aria-hidden="true">{ICON.usb}</span><b>{t('USB로 연결')}</b>
            <span>{board.bleOnly ? t('이 보드는 블루투스로만 측정합니다') : hasSerial() ? t('맥·윈도우·크롬북 (크롬·엣지)') : t('이 브라우저에서는 사용할 수 없음')}</span>
          </button>
          <button className="big" disabled={!hasBluetooth() || busy || connected || !board.ble} onClick={() => onConnect('ble')}>
            <span className="big-ico" aria-hidden="true">{ICON.ble}</span><b>{t('블루투스로 연결')}</b>
            <span>{!board.ble ? t('이 보드는 USB만 됩니다') : hasBluetooth() ? 'ChemDict-01 ~ 08' : t('이 브라우저에서는 사용할 수 없음')}</span>
          </button>
          <button className="big alt" disabled={busy || connected} onClick={() => onConnect('sim')}>
            <span className="big-ico" aria-hidden="true">{ICON.sim}</span><b>{t('보드 없이 체험')}</b>
            <span>{t('시뮬레이터 데이터')}</span>
          </button>
        </div>
        {!hasSerial() && !hasBluetooth() && (
          <p className="note warn">{t('사파리는 USB·블루투스 연결을 지원하지 않습니다. 맥·윈도우에서는 크롬이나 엣지로 열고, 아이패드·아이폰에서는 ChemDict Lab 앱을 쓰세요.')}</p>
        )}
      </section>

      {fw?.status === 'checking' && (
        <section className="guide-block fw-panel"><p className="note">{t('보드를 확인하는 중…')}</p></section>
      )}

      {fw?.status === 'missing' && (
        <section className="guide-block fw-panel" role="alert">
          <h2>{t('이 보드에는 측정 프로그램이 없습니다')}</h2>
          {ideOnly ? (
            <>
              <p>{t('{board}은(는) 아직 웹에서 설치할 수 없습니다. Arduino IDE로 한 번만 올리면 그 뒤로는 바로 쓸 수 있습니다.', { board: board.name })}</p>
              <p className="note"><a href={REPO} target="_blank" rel="noreferrer">{t('펌웨어 받기와 올리는 방법')}</a></p>
            </>
          ) : usbBoard === 'clone' && !target ? (
            <p>{t('호환 보드입니다. 위 ‘보드 고르기’에서 UNO R3·Nano·Mega 2560 중 맞는 것을 누른 뒤 설치하세요.')}</p>
          ) : target ? (
            <>
              <p>{t('처음 한 번만 설치하면 됩니다. 약 30초 걸리고, 보드에 있던 다른 프로그램은 지워집니다.')}</p>
              {usbBoard === 'clone' && <p className="note warn">{t('호환 보드는 종류를 알 수 없습니다. 지금 고른 보드: {board} — 다르면 위에서 바꾸세요.', { board: board.name })}</p>}
              <button className="primary big-action" onClick={() => onInstall(targetId)}>{t('측정 프로그램 설치 ({v})', { v: BUNDLED_FW })}</button>
            </>
          ) : (
            <p>{t('이 보드는 아직 지원하지 않습니다. 위에서 보드를 확인하세요.')}</p>
          )}
        </section>
      )}

      {fw?.status === 'outdated' && (
        <section className="guide-block fw-panel">
          <h2>{t('새 측정 프로그램이 있습니다')}</h2>
          <p>{t('보드: {v} → 새 버전: {w}. 설치하면 새 센서와 고친 점이 적용됩니다.', { v: fw.version, w: BUNDLED_FW })}</p>
          <div className="sheet-actions">
            <button className="ghost" onClick={onNext}>{t('나중에')}</button>
            {target && <button className="primary" onClick={() => onInstall(targetId)}>{t('업데이트')}</button>}
          </div>
        </section>
      )}

      {fw?.status === 'installing' && (
        <section className="guide-block fw-panel" aria-live="polite">
          <h2>{t('설치 중 — USB를 뽑지 마세요')}</h2>
          <p>{t(STAGE[fw.stage])}{fw.stage === 'write' || fw.stage === 'verify' ? ` ${Math.round(fw.ratio * 100)}%` : '…'}</p>
          <div className="progress"><span style={{ width: `${Math.round((fw.stage === 'write' ? fw.ratio * 0.7 : fw.stage === 'verify' ? 0.7 + fw.ratio * 0.3 : fw.stage === 'done' ? 1 : 0.02) * 100)}%` }} /></div>
        </section>
      )}

      {fw?.status === 'done' && (
        <section className="guide-block fw-panel"><p className="ok-note">{t('✓ 설치했습니다. 다시 연결하는 중…')}</p></section>
      )}

      {fw?.status === 'failed' && (
        <section className="guide-block fw-panel" role="alert">
          <h2>{t('설치하지 못했습니다')}</h2>
          <p className="warn-text">{fw.message}</p>
          {failTips && <ol>{failTips.steps.map((s) => <li key={s}><R t={s} /></li>)}</ol>}
          <p className="note"><R t={t('USB를 뽑았다 꽂은 뒤 [USB로 연결]부터 다시 하세요.')} /></p>
        </section>
      )}

      {connected && (!fw || fw.status === 'done') && (
        <div className="sheet-actions"><span /><button className="primary big-action" onClick={onNext}>{t('다음: 실험 고르기 →')}</button></div>
      )}
    </main>
  );
}
