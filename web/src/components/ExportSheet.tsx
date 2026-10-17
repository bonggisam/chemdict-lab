import { useState } from 'react';

export type ExportKind = 'png' | 'pdf' | 'excel' | 'numbers' | 'csv' | 'copy';

interface Props {
  onExport: (k: ExportKind) => Promise<void> | void;
  onClose: () => void;
  runCount: number;
}

const ITEMS: { k: ExportKind; title: string; desc: string }[] = [
  { k: 'png', title: '그림 (PNG)', desc: '그래프와 해석 결과를 한 장의 그림으로. 보고서·발표 자료에 붙이기 좋습니다.' },
  { k: 'pdf', title: 'PDF 보고서', desc: '그래프 → 해석 표 → 데이터 표 순서의 A4 문서. 제출용.' },
  { k: 'excel', title: '엑셀 (.xlsx)', desc: '측정마다 시트 + 엑셀 그래프(추세선 포함). 엑셀에서 바로 고칠 수 있습니다.' },
  { k: 'numbers', title: 'Numbers (.xlsx)', desc: '맥·아이패드 Numbers에서 그대로 열리는 파일입니다 (엑셀과 같은 파일).' },
  { k: 'csv', title: 'CSV', desc: '숫자만. 구글 시트·다른 프로그램에서 읽을 때.' },
  { k: 'copy', title: '표 복사', desc: '지금 고른 측정의 표를 복사합니다. 엑셀·Numbers에 붙여넣기.' },
];

/** 저장하기: 그림 · PDF · 엑셀 · Numbers · CSV */
export function ExportSheet({ onExport, onClose, runCount }: Props) {
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const go = async (k: ExportKind) => {
    setBusy(k);
    try { await onExport(k); } finally { setBusy(null); }
  };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet wide-sheet" role="dialog" aria-modal="true" aria-label="저장하기" onClick={(e) => e.stopPropagation()}>
        <h2>저장하기</h2>
        <p className="note">그래프에 보이는 측정 {runCount}개를 저장합니다. 숨긴 측정은 빠집니다.</p>
        <div className="export-grid">
          {ITEMS.map((it) => (
            <button key={it.k} className="export-item" disabled={!!busy} onClick={() => go(it.k)}>
              <b>{busy === it.k ? '만드는 중…' : it.title}</b>
              <span>{it.desc}</span>
            </button>
          ))}
        </div>
        <div className="sheet-actions"><span /><button onClick={onClose}>닫기</button></div>
      </div>
    </div>
  );
}
