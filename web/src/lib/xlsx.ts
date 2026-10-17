// 라이브러리 없이 .xlsx 만들기: 데이터 시트 + 엑셀 기본 그래프(분산형) + 추세선
// 엑셀·Numbers·구글 시트·한셀에서 열립니다. (압축하지 않은 zip)

export type Cell = string | number | null | undefined;

export interface XSeries {
  name: string;
  sheet: string;        // 데이터가 있는 시트 이름
  xCol: number;         // 0부터
  yCol: number;
  r0: number;           // 데이터 첫 행 (0부터, 머리글 다음)
  r1: number;           // 마지막 행
  color: string;        // 'RRGGBB'
  line: boolean;
  markers: boolean;
  trend?: 'linear' | 'exp' | 'log' | 'power' | 'poly2' | 'poly3';
}
export interface XChart { title: string; xTitle: string; yTitle: string; series: XSeries[]; logX?: boolean }

export interface XSheet {
  name: string;
  rows: Cell[][];
  widths?: number[];
  boldRows?: number[];
  charts?: XChart[];     // 이 시트에 그래프를 차례로 붙임 (데이터 아래 또는 빈 시트)
}

// ---------------------------------------------------------------- zip (store)
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b: Uint8Array) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

export function zip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), name, f.data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + size;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)] as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---------------------------------------------------------------- xlsx
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colName = (c: number) => { let s = ''; c += 1; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; };
export const safeSheetName = (s: string) => s.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';
const ref = (sheet: string, col: number, r0: number, r1: number) => `'${sheet.replace(/'/g, "''")}'!$${colName(col)}$${r0 + 1}:$${colName(col)}$${r1 + 1}`;

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';

function richText(t: string, size = 1200, bold = false) {
  return `<c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}"/></a:pPr><a:r><a:rPr lang="ko-KR" sz="${size}" b="${bold ? 1 : 0}"/><a:t>${esc(t)}</a:t></a:r></a:p></c:rich></c:tx>`;
}

function chartXml(ch: XChart, sheets: XSheet[]): string {
  const cache = (s: XSeries, col: number) => {
    const sh = sheets.find((x) => x.name === s.sheet)!;
    let pts = '';
    let n = 0;
    for (let r = s.r0; r <= s.r1; r++) {
      const v = sh.rows[r]?.[col];
      if (typeof v === 'number' && isFinite(v)) pts += `<c:pt idx="${r - s.r0}"><c:v>${v}</c:v></c:pt>`;
      n++;
    }
    return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${n}"/>${pts}</c:numCache>`;
  };
  const trend = (t?: XSeries['trend']) => {
    if (!t) return '';
    const type = t.startsWith('poly') ? 'poly' : t;
    return `<c:trendline><c:spPr><a:ln w="19050"><a:solidFill><a:srgbClr val="222222"/></a:solidFill><a:prstDash val="dash"/></a:ln></c:spPr><c:trendlineType val="${type}"/>${t.startsWith('poly') ? `<c:order val="${t.slice(4)}"/>` : ''}<c:dispRSqr val="1"/><c:dispEq val="1"/></c:trendline>`;
  };
  const ser = ch.series.map((s, i) => `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>`
    + `<c:spPr>${s.line ? `<a:ln w="22225" cap="rnd"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:round/></a:ln>` : '<a:ln w="22225"><a:noFill/></a:ln>'}</c:spPr>`
    + (s.markers ? `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:marker>` : '<c:marker><c:symbol val="none"/></c:marker>')
    + trend(s.trend)
    + `<c:xVal><c:numRef><c:f>${esc(ref(s.sheet, s.xCol, s.r0, s.r1))}</c:f>${cache(s, s.xCol)}</c:numRef></c:xVal>`
    + `<c:yVal><c:numRef><c:f>${esc(ref(s.sheet, s.yCol, s.r0, s.r1))}</c:f>${cache(s, s.yCol)}</c:numRef></c:yVal>`
    + '<c:smooth val="0"/></c:ser>').join('');
  const ax = (id: number, cross: number, pos: 'b' | 'l', title: string, log = false) =>
    `<c:valAx><c:axId val="${id}"/><c:scaling>${log ? '<c:logBase val="10"/>' : ''}<c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${pos}"/>`
    + (pos === 'l' ? '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D9D9D9"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>' : '')
    + `<c:title>${richText(title, 1000)}<c:overlay val="0"/></c:title>`
    + `<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>`
    + `<c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/><c:chart>`
    + `<c:title>${richText(ch.title, 1400, true)}<c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    + `<c:plotArea><c:layout/><c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${ser}<c:axId val="101"/><c:axId val="102"/></c:scatterChart>`
    + ax(101, 102, 'b', ch.xTitle, ch.logX) + ax(102, 101, 'l', ch.yTitle) + '</c:plotArea>'
    + '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>';
}

export function buildXlsx(sheets: XSheet[]): Blob {
  const enc = new TextEncoder();
  const files: { name: string; data: Uint8Array }[] = [];
  const add = (name: string, s: string) => files.push({ name, data: enc.encode(s) });

  // 공유 문자열
  const sst: string[] = [];
  const sidx = new Map<string, number>();
  const si = (s: string) => { let i = sidx.get(s); if (i === undefined) { i = sst.length; sst.push(s); sidx.set(s, i); } return i; };

  let chartNo = 0, drawingNo = 0;
  const ct: string[] = [];
  sheets.forEach((sh, k) => {
    const bold = new Set(sh.boldRows ?? [0]);
    const rowsXml = sh.rows.map((row, r) => `<row r="${r + 1}">` + row.map((v, c) => {
      if (v === null || v === undefined || v === '') return '';
      const a = `${colName(c)}${r + 1}`, st = bold.has(r) ? ' s="1"' : '';
      return typeof v === 'number' ? (isFinite(v) ? `<c r="${a}"${st}><v>${v}</v></c>` : '') : `<c r="${a}" t="s"${st}><v>${si(v)}</v></c>`;
    }).join('') + '</row>').join('');
    const cols = sh.widths?.length ? `<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
    let drawing = '';
    if (sh.charts?.length) {
      drawingNo++;
      const startRow = sh.rows.length + 1;
      const anchors = sh.charts.map((ch, i) => {
        chartNo++;
        add(`xl/charts/chart${chartNo}.xml`, chartXml(ch, sheets));
        ct.push(`<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
        const r0 = startRow + i * 22;
        return { rel: `<Relationship Id="rId${i + 1}" Type="${NS_R}/chart" Target="../charts/chart${chartNo}.xml"/>`,
          xml: `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r0}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>`
            + `<xdr:to><xdr:col>10</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${r0 + 20}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>`
            + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
            + `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>` };
      });
      add(`xl/drawings/drawing${drawingNo}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="${NS_XDR}" xmlns:a="${NS_A}">${anchors.map((a) => a.xml).join('')}</xdr:wsDr>`);
      add(`xl/drawings/_rels/drawing${drawingNo}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${anchors.map((a) => a.rel).join('')}</Relationships>`);
      add(`xl/worksheets/_rels/sheet${k + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/drawing" Target="../drawings/drawing${drawingNo}.xml"/></Relationships>`);
      ct.push(`<Override PartName="/xl/drawings/drawing${drawingNo}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      drawing = '<drawing r:id="rId1"/>';
    }
    add(`xl/worksheets/sheet${k + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_R}">`
      + `<sheetViews><sheetView workbookViewId="0"${k === 0 ? ' tabSelected="1"' : ''}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      + `<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rowsXml}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>${drawing}</worksheet>`);
    ct.push(`<Override PartName="/xl/worksheets/sheet${k + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  });

  add('xl/sharedStrings.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="${NS_MAIN}" count="${sst.length}" uniqueCount="${sst.length}">${sst.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>`);
  add('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="${NS_MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>`
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_R}"><bookViews><workbookView/></bookViews><sheets>`
    + sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>');
  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${sheets.length + 1}" Type="${NS_R}/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="${NS_R}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>`
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
    + ct.join('') + '</Types>');

  // [Content_Types].xml을 맨 앞에
  files.sort((a, b) => (a.name === '[Content_Types].xml' ? -1 : b.name === '[Content_Types].xml' ? 1 : 0));
  return zip(files);
}
