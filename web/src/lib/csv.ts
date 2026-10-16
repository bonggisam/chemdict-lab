export interface Row {
  t: number;
  v: Record<string, number>;
}
export interface Marker {
  t: number;
  note: string;
}

/** 엑셀·Numbers에서 한글이 깨지지 않도록 BOM을 붙인 CSV */
export function toCSV(rows: Row[], ids: string[], names: Record<string, string>, markers: Marker[]): string {
  const header = ['시간(s)', ...ids.map((id) => names[id] ?? id), '표시'];
  const markerAt = new Map<number, string>();
  for (const m of markers) {
    // 표시를 가장 가까운 측정 행에 붙임
    let best = 0;
    let bestD = Infinity;
    rows.forEach((r, i) => {
      const d = Math.abs(r.t - m.t);
      if (d < bestD) { bestD = d; best = i; }
    });
    const prev = markerAt.get(best);
    markerAt.set(best, prev ? `${prev} / ${m.note}` : m.note);
  }
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [header.map(esc).join(',')];
  rows.forEach((r, i) => {
    lines.push([r.t.toFixed(2), ...ids.map((id) => (r.v[id] ?? '').toString()), esc(markerAt.get(i) ?? '')].join(','));
  });
  return '﻿' + lines.join('\n');
}

export async function saveCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const file = new File([blob], filename, { type: 'text/csv' });
  // 아이패드·안드로이드: 공유 시트로 (AirDrop, Numbers 등)
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPad|iPhone|Android/.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch { /* 취소 시 다운로드로 */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
