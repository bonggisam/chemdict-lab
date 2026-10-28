import { useEffect, useMemo, useRef, useState } from 'react';
import { t, tk } from '../lib/i18n';
import { parts, type Board, type Part } from '../lib/guide';
import { BAND, BAND_COLORS, analyze, decode, encode, formatOhms, type Analysis, type BandColor, type Pt } from '../lib/resistor';
import { LED_VF, USB_BUDGET_MA, bestDivider, checkTogether, dividerOut, findParts, ledResistor, short } from '../lib/partsHelper';
import { R } from './Rich';

type Tab = 'read' | 'find' | 'calc' | 'together';
const TABS: [Tab, string][] = [['read', tk('🎨 저항 색띠 읽기')], ['find', tk('🔎 부품 찾기')], ['calc', tk('🧮 저항 계산')], ['together', tk('🧩 함께 쓰기 검사')]];
const COLOR_KO: Record<BandColor, string> = Object.fromEntries(BAND_COLORS.map((c) => [c, BAND[c].ko])) as Record<BandColor, string>;
// 번역 원문 모으기용 (색 이름)
tk('검정'); tk('갈색'); tk('빨강'); tk('주황'); tk('노랑'); tk('초록'); tk('파랑'); tk('보라'); tk('회색'); tk('흰색'); tk('금색'); tk('은색');

/** 3단계 '🧰 부품 도우미': 저항 색띠 읽기 · 부품 찾기 · 저항 계산 · 센서 함께 쓰기 검사 */
export function PartsHelper({ board, onOpenPart }: { board: Board; onOpenPart: (p: Part) => void }) {
  const [tab, setTab] = useState<Tab>('read');
  return (
    <section className="guide-block parts-helper" data-nav={t('부품 도우미')}>
      <h2>🧰 {t('부품 도우미')}</h2>
      <div className="seg" role="tablist" aria-label={t('부품 도우미')}>
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{t(label)}</button>
        ))}
      </div>
      {tab === 'read' && <ResistorReader />}
      {tab === 'find' && <PartFinder onOpenPart={onOpenPart} />}
      {tab === 'calc' && <Calculators />}
      {tab === 'together' && <Together board={board} />}
    </section>
  );
}

/** 저항 그림 (색띠) */
export function ResistorSvg({ bands, width = 260 }: { bands: BandColor[]; width?: number }) {
  const n = bands.length;
  const xs = bands.map((_, i) => (i < n - 1 || n < 4 ? 70 + i * 26 : 180));
  return (
    <svg className="resistor-svg" viewBox="0 0 260 70" width={width} role="img" aria-label={bands.map((b) => t(COLOR_KO[b])).join(' · ')}>
      <line x1="0" y1="35" x2="260" y2="35" stroke="#9a9aa0" strokeWidth="4" />
      <rect x="50" y="14" width="160" height="42" rx="18" fill="#d9bf92" stroke="#b49a6c" />
      {bands.map((b, i) => <rect key={i} x={xs[i]} y="14" width="12" height="42" fill={BAND[b].hex} stroke="rgba(0,0,0,.15)" />)}
    </svg>
  );
}

function BandChips({ bands, onChange }: { bands: BandColor[]; onChange: (b: BandColor[]) => void }) {
  return (
    <div className="band-chips">
      {bands.map((b, i) => (
        <label key={i} className="band-chip">
          <span className="sw" style={{ background: BAND[b].hex }} aria-hidden="true" />
          <select aria-label={t('{n}번째 띠', { n: i + 1 })} value={b} onChange={(e) => { const nb = [...bands]; nb[i] = e.target.value as BandColor; onChange(nb); }}>
            {BAND_COLORS.map((c) => <option key={c} value={c}>{t(COLOR_KO[c])}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}

function ReadingLine({ bands }: { bands: BandColor[] }) {
  const r = decode(bands);
  return r.valid
    ? <p className="resistor-value"><b>{formatOhms(r.ohms)}</b> <span>±{r.tol}%</span></p>
    : <p className="note warn">{t('이 색 조합은 저항값이 아닙니다. 띠 색을 다시 골라 보세요.')}</p>;
}

function ResistorReader() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [pts, setPts] = useState<Pt[]>([]);
  const [res, setRes] = useState<Analysis | null>(null);
  const [bands, setBands] = useState<BandColor[]>([]);
  const [value, setValue] = useState('220');
  const [five, setFive] = useState(false);

  const load = (f?: File) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => { setImg(im); setPts([]); setRes(null); setBands([]); };
    im.src = url;
  };
  // 사진 그리기 (긴 쪽 1200px 이하) + 고른 점·선
  useEffect(() => {
    const c = canvas.current;
    if (!c || !img) return;
    const k = Math.min(1, 1200 / Math.max(img.width, img.height));
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0, c.width, c.height);
    if (pts.length === 2 && !res) {
      const r = analyze(g.getImageData(0, 0, c.width, c.height), pts[0], pts[1]);
      setRes(r);
      if (r.reading) setBands(r.reading.bands);
    }
    g.lineWidth = Math.max(2, c.width / 300);
    if (pts.length === 2) {
      g.strokeStyle = 'rgba(0, 200, 150, .9)';
      g.beginPath(); g.moveTo(pts[0].x, pts[0].y); g.lineTo(pts[1].x, pts[1].y); g.stroke();
      // 찾은 띠 위치 표시
      for (const b of res?.bands ?? []) {
        const m = (b.start + b.end) / 2;
        const x = pts[0].x + (pts[1].x - pts[0].x) * m, y = pts[0].y + (pts[1].y - pts[0].y) * m;
        g.strokeStyle = '#fff'; g.beginPath(); g.arc(x, y, c.width / 60, 0, Math.PI * 2); g.stroke();
      }
    }
    g.fillStyle = '#ff7a3d';
    for (const p of pts) { g.beginPath(); g.arc(p.x, p.y, c.width / 90, 0, Math.PI * 2); g.fill(); }
  }, [img, pts, res]);

  const tap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvas.current!;
    const r = c.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
    setRes(null);
    setPts((old) => (old.length >= 2 ? [p] : [...old, p]));
  };

  const enc = encode(Number(value.replace(',', '.')) * 1, five ? 1 : 5, five);
  return (
    <div className="helper-pane">
      <p className="note"><R t={t('저항을 밝은 흰 종이 위에 놓고 가까이 찍으세요. 사진에서 저항 몸통의 [왼쪽 끝]과 [오른쪽 끝]을 차례로 누르면 색띠를 읽습니다.')} /></p>
      <label className="primary file-btn">
        📷 {t('사진 찍기·고르기')}
        <input type="file" accept="image/*" capture="environment" onChange={(e) => load(e.target.files?.[0])} hidden />
      </label>
      {img && (
        <>
          <canvas ref={canvas} className="resistor-photo" onClick={tap} aria-label={t('저항 사진. 몸통 양 끝을 누르세요.')} />
          <p className="note">{pts.length < 2 ? t('{n}번째 점을 누르세요 (몸통 {side} 끝)', { n: pts.length + 1, side: pts.length ? t('오른쪽') : t('왼쪽') }) : t('다시 하려면 사진을 다시 누르세요.')}</p>
        </>
      )}
      {res?.small && <p className="note warn" role="status">{t('사진 속 저항이 작아 색을 틀릴 수 있습니다. 저항 하나가 화면을 가득 채우도록 가까이 찍으면 더 정확합니다.')}</p>}
      {res && (
        res.reading ? (
          <div className="resistor-result" role="status">
            <ResistorSvg bands={bands} />
            <ReadingLine bands={bands} />
            <BandChips bands={bands} onChange={setBands} />
            <p className="note">{t('색이 틀렸으면 띠를 눌러 고치세요. 조명에 따라 금색·갈색·주황, 은색·회색을 헷갈릴 수 있습니다.')}</p>
            {res.alternatives.length > 0 && (
              <p className="note alt-row">{t('다른 후보:')} {res.alternatives.map((a, i) => <button key={i} className="ghost small" onClick={() => setBands(a.bands)}>{formatOhms(a.ohms)}</button>)}</p>
            )}
          </div>
        ) : <p className="note warn" role="status">{t('색띠를 찾지 못했습니다. 저항을 크게 찍고, 몸통 양 끝을 정확히 눌러 보세요.')}</p>
      )}
      <hr />
      <h3>{t('값으로 색띠 보기')}</h3>
      <div className="calc-row">
        <label>{t('저항값 (Ω)')} <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={five} onChange={(e) => setFive(e.target.checked)} /> {t('5띠 (정밀 저항)')}</label>
      </div>
      {enc ? <><ResistorSvg bands={enc} /><p className="note">{enc.map((b) => t(COLOR_KO[b])).join(' · ')}</p></> : <p className="note warn">{t('숫자를 넣으세요')}</p>}
    </div>
  );
}

function PartFinder({ onOpenPart }: { onOpenPart: (p: Part) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const found = useMemo(() => (text.trim() ? findParts(text) : []), [text]);
  // 크롬 일부에서만 되는 글자 인식 (없으면 직접 입력)
  const Detector = (window as unknown as { TextDetector?: new () => { detect: (b: ImageBitmapSource) => Promise<{ rawValue: string }[]> } }).TextDetector;
  const ocr = async (f?: File) => {
    if (!f || !Detector) return;
    setBusy(true);
    try {
      const bmp = await createImageBitmap(f);
      const r = await new Detector().detect(bmp);
      setText(r.map((x) => x.rawValue).join(' '));
    } catch { /* 읽지 못하면 직접 입력 */ } finally { setBusy(false); }
  };
  return (
    <div className="helper-pane">
      <p className="note">{t('부품에 적힌 모델명(예: HC-SR04, DHT22, MQ-135)을 넣으면 맞는 센서와 연결 방법을 찾아 줍니다.')}</p>
      <div className="calc-row">
        <input className="grow" aria-label={t('부품에 적힌 글자')} placeholder={t('부품에 적힌 글자')} value={text} onChange={(e) => setText(e.target.value)} />
        {Detector && (
          <label className="ghost file-btn">📷 {busy ? t('읽는 중…') : t('사진으로 읽기')}
            <input type="file" accept="image/*" capture="environment" onChange={(e) => ocr(e.target.files?.[0])} hidden />
          </label>
        )}
      </div>
      {!Detector && <p className="note">{t('사진으로 글자 읽기는 아이패드·맥 앱에서 됩니다.')}</p>}
      {text.trim() && !found.length && <p className="note warn">{t('맞는 부품이 없습니다. 모델명을 다시 확인하세요.')}</p>}
      <div className="sensor-cards">
        {found.map((p) => (
          <button key={p.id} className="sensor-card" onClick={() => onOpenPart(p)}>
            <b>{p.name}</b>
            <span className="measures">{t('연결 방법 보기')} →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const num = (s: string) => Number(s.replace(',', '.'));
function Calculators() {
  const [vs, setVs] = useState('5'), [led, setLed] = useState('red'), [ma, setMa] = useState('10');
  const [vin, setVin] = useState('5'), [vout, setVout] = useState('3.3'), [r1, setR1] = useState('10000'), [r2, setR2] = useState('20000');
  const l = ledResistor(num(vs), LED_VF[led], num(ma));
  const d = bestDivider(num(vin), num(vout));
  const out = dividerOut(num(vin), num(r1), num(r2));
  const LED_NAMES: Record<string, string> = { red: tk('빨강'), yellow: tk('노랑'), green: tk('초록'), blue: tk('파랑'), white: tk('흰색') };
  return (
    <div className="helper-pane">
      <h3>💡 {t('LED 보호 저항')}</h3>
      <div className="calc-row">
        <label>{t('전원 (V)')} <select value={vs} onChange={(e) => setVs(e.target.value)}><option>5</option><option>3.3</option></select></label>
        <label>{t('LED 색')} <select value={led} onChange={(e) => setLed(e.target.value)}>{Object.keys(LED_VF).map((k) => <option key={k} value={k}>{t(LED_NAMES[k])} ({LED_VF[k]} V)</option>)}</select></label>
        <label>{t('전류 (mA)')} <input inputMode="decimal" value={ma} onChange={(e) => setMa(e.target.value)} /></label>
      </div>
      {l ? <p className="resistor-value"><b>{formatOhms(l.std)}</b> <span>{t('계산값 {r} → 파는 값 중 바로 위 · 실제 {i} mA', { r: formatOhms(l.r), i: l.actualMa.toFixed(1) })}</span></p>
        : <p className="note warn">{t('전원 전압이 LED 전압보다 커야 합니다.')}</p>}
      <p className="note">{t('보통 LED는 10 mA면 충분히 밝습니다. 20 mA를 넘기지 마세요.')}</p>

      <h3>➗ {t('전압 나누기 (분압)')}</h3>
      <p className="note"><R t={t('출력이 3.3 V를 넘는 센서를 3.3 V 보드에 쓸 때 신호선에 넣습니다. [R1]은 센서 쪽, [R2]는 GND 쪽입니다.')} /></p>
      <div className="calc-row">
        <label>{t('입력 (V)')} <input inputMode="decimal" value={vin} onChange={(e) => setVin(e.target.value)} /></label>
        <label>{t('원하는 출력 (V)')} <input inputMode="decimal" value={vout} onChange={(e) => setVout(e.target.value)} /></label>
      </div>
      {d ? <p className="resistor-value"><b>R1 {formatOhms(d.r1)} · R2 {formatOhms(d.r2)}</b> <span>→ {d.vout.toFixed(2)} V</span></p>
        : <p className="note warn">{t('출력은 입력보다 작아야 합니다.')}</p>}
      <div className="calc-row">
        <label>R1 (Ω) <input inputMode="decimal" value={r1} onChange={(e) => setR1(e.target.value)} /></label>
        <label>R2 (Ω) <input inputMode="decimal" value={r2} onChange={(e) => setR2(e.target.value)} /></label>
        <span>→ <b>{isFinite(out) ? out.toFixed(2) : '—'} V</b></span>
      </div>
      {d && <p className="note"><R t={t('[센서 보정]에서 배율을 {k}배로 맞추면 원래 값이 나옵니다.', { k: (num(vin) / d.vout).toFixed(2) })} /></p>}

      <h3>⬆️ {t('풀업 저항')}</h3>
      <table className="mini-table">
        <tbody>
          <tr><td>{t('DS18B20 (1-Wire)')}</td><td><b>4.7 kΩ</b></td><td>{t('DATA ↔ VCC 사이, 센서가 여러 개여도 하나')}</td></tr>
          <tr><td>{t('I2C (SDA·SCL)')}</td><td><b>4.7 kΩ</b></td><td>{t('대부분의 모듈에 이미 들어 있어 따로 안 넣어도 됩니다')}</td></tr>
          <tr><td>{t('버튼·스위치')}</td><td><b>10 kΩ</b></td><td>{t('핀 ↔ GND (또는 INPUT_PULLUP을 쓰면 필요 없음)')}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function Together({ board }: { board: Board }) {
  const [sel, setSel] = useState<Part[]>([]);
  const [q, setQ] = useState('');
  const matches = q.trim() ? parts.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()) || findParts(q).includes(p)).slice(0, 8) : [];
  const res = checkTogether(board, sel, (p) => short(p.name));
  return (
    <div className="helper-pane">
      <p className="note">{t('함께 꽂을 센서를 고르면 핀·I2C 주소가 겹치는지, 전류가 충분한지 알려 줍니다. 보드: {b}', { b: board.name })}</p>
      <input className="grow" aria-label={t('센서 이름 찾기')} placeholder={t('센서 이름 찾기')} value={q} onChange={(e) => setQ(e.target.value)} />
      {matches.length > 0 && (
        <div className="chip-row">{matches.map((p) => <button key={p.id} className="ghost small" onClick={() => { setSel((s) => [...s, p]); setQ(''); }}>+ {short(p.name)}</button>)}</div>
      )}
      <div className="chip-row">
        {sel.map((p, i) => <button key={i} className="chip" onClick={() => setSel((s) => s.filter((_, k) => k !== i))} aria-label={t('{a} 빼기', { a: short(p.name) })}>{short(p.name)} ✕</button>)}
      </div>
      {sel.length > 0 && (
        res.errors.length || res.warns.length ? (
          <ul className="check-list" role="status">
            {res.errors.map((m, i) => <li key={`e${i}`} className="bad">⛔ {t(m.key, m.p)}</li>)}
            {res.warns.map((m, i) => <li key={`w${i}`} className="warn">⚠️ {t(m.key, m.p)}</li>)}
          </ul>
        ) : <p className="note ok" role="status">✅ {t('함께 쓸 수 있습니다.')} {Object.entries(res.ports).map(([id, port]) => `${short(sel.find((p) => p.id === id)?.name ?? id)} → ${port}`).join(' · ')}</p>
      )}
      <p className="note">{t('USB 전원은 약 {ma} mA까지를 기준으로 봅니다.', { ma: USB_BUDGET_MA })}</p>
    </div>
  );
}
