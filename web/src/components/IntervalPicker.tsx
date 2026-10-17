import { useEffect, useState } from 'react';

const PRESETS = [100, 200, 500, 1000, 2000, 5000, 10000, 30000, 60000];
const MIN = 100, MAX = 3_600_000;

export const intervalText = (ms: number) =>
  ms >= 60000 && ms % 60000 === 0 ? `${ms / 60000}분` : `${Number((ms / 1000).toFixed(2))}초`;

interface Props { value: number; disabled?: boolean; onChange: (ms: number) => void }

/** 측정 간격: 자주 쓰는 값 + 직접 입력 (0.1초 ~ 60분) */
export function IntervalPicker({ value, disabled, onChange }: Props) {
  const preset = PRESETS.includes(value);
  const [custom, setCustom] = useState(!preset);
  const [unit, setUnit] = useState<'s' | 'min'>(value >= 60000 && value % 60000 === 0 ? 'min' : 's');
  const [text, setText] = useState(String(unit === 'min' ? value / 60000 : value / 1000));
  const [err, setErr] = useState('');
  useEffect(() => { if (!custom) setText(String(value / 1000)); }, [value, custom]);

  const apply = (t = text, u = unit) => {
    const n = Number(t.replace(',', '.'));
    const ms = Math.round(n * (u === 'min' ? 60000 : 1000));
    if (!isFinite(n) || n <= 0) { setErr('숫자를 넣으세요'); return; }
    if (ms < MIN) { setErr('0.1초보다 짧게는 안 됩니다'); return; }
    if (ms > MAX) { setErr('60분보다 길게는 안 됩니다'); return; }
    setErr('');
    onChange(ms);
  };

  return (
    <div className="interval">
      <label htmlFor="interval">간격</label>
      <select id="interval" value={custom ? 'custom' : value} disabled={disabled}
        onChange={(e) => {
          if (e.target.value === 'custom') { setCustom(true); return; }
          setCustom(false); setErr(''); onChange(Number(e.target.value));
        }}>
        {PRESETS.map((ms) => <option key={ms} value={ms}>{intervalText(ms)}</option>)}
        <option value="custom">직접 입력…</option>
      </select>
      {custom && (
        <span className="interval-custom">
          <input aria-label="측정 간격 숫자" inputMode="decimal" value={text} disabled={disabled}
            onChange={(e) => setText(e.target.value)} onBlur={() => apply()} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} />
          <select aria-label="간격 단위" value={unit} disabled={disabled} onChange={(e) => { const u = e.target.value as 's' | 'min'; setUnit(u); apply(text, u); }}>
            <option value="s">초</option>
            <option value="min">분</option>
          </select>
        </span>
      )}
      {err && <span className="warn-text small">{err}</span>}
    </div>
  );
}
