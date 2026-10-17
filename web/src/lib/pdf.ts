// 캔버스(페이지 그림)들을 A4 PDF로. 글꼴을 넣지 않아도 한글이 그대로 보입니다 (페이지를 그림으로 넣음).

export async function canvasesToPdf(pages: HTMLCanvasElement[]): Promise<Blob> {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (b: Uint8Array | string) => { const u = typeof b === 'string' ? enc.encode(b) : b; chunks.push(u); pos += u.length; };
  const obj = (n: number, body: (string | Uint8Array)[]) => { offsets[n] = pos; push(`${n} 0 obj\n`); body.forEach(push); push('\nendobj\n'); };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const W = 595.28, H = 841.89;
  // 1: 카탈로그, 2: 페이지 목록, 그 뒤 페이지마다 [페이지, 내용, 그림]
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  obj(2, [`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`]);
  for (let i = 0; i < pages.length; i++) {
    const c = pages[i];
    const jpg = await new Promise<Uint8Array>((res) => c.toBlob(async (b) => res(new Uint8Array(await b!.arrayBuffer())), 'image/jpeg', 0.92));
    const p = 3 + i * 3;
    const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(p, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`]);
    obj(p + 1, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
    obj(p + 2, [`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, '\nendstream']);
  }
  const n = 3 + pages.length * 3;
  const xref = pos;
  push(`xref\n0 ${n}\n0000000000 65535 f \n`);
  for (let i = 1; i < n; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: 'application/pdf' });
}
