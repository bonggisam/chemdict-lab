import { tk } from './i18n';
// 직접 만드는 계산 열: 안전한 수식 계산기 (eval을 쓰지 않음)
// 쓸 수 있는 것: 숫자, + − × ÷ ^, 괄호, x(가로축), y(해석 센서), y0(첫 값), 센서 이름(pH, T, TA …),
// 함수 ln log sqrt abs exp sin cos tan, 상수 pi
export interface CustomCalc { name: string; unit: string; expr: string }

type Node = (vars: Record<string, number>) => number;

const FUNCS: Record<string, (v: number) => number> = {
  ln: Math.log, log: Math.log10, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
};

export class FormulaError extends Error {}

/** 수식을 함수로 바꿈. 틀리면 FormulaError (message: 사람이 읽을 위치 설명용 토큰) */
export function compile(src: string, allowed: string[]): Node {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/²/g, '^2');
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const peek = () => { ws(); return s[i]; };
  const allowSet = new Set([...allowed, 'x', 'y', 'y0']);

  const expr = (): Node => {
    let a = term();
    for (;;) {
      const c = peek();
      if (c === '+' || c === '-') { i++; const b = term(); const l = a; a = c === '+' ? (v) => l(v) + b(v) : (v) => l(v) - b(v); }
      else return a;
    }
  };
  const term = (): Node => {
    let a = unary();
    for (;;) {
      const c = peek();
      if (c === '*' || c === '/') { i++; const b = unary(); const l = a; a = c === '*' ? (v) => l(v) * b(v) : (v) => l(v) / b(v); }
      else return a;
    }
  };
  const unary = (): Node => {
    const c = peek();
    if (c === '-') { i++; const a = unary(); return (v) => -a(v); }
    if (c === '+') { i++; return unary(); }
    return power();
  };
  const power = (): Node => {
    const a = atom();
    if (peek() === '^') { i++; const b = unary(); return (v) => Math.pow(a(v), b(v)); }
    return a;
  };
  const atom = (): Node => {
    const c = peek();
    if (c === undefined) throw new FormulaError('end');
    if (c === '(') {
      i++; const a = expr();
      if (peek() !== ')') throw new FormulaError(')');
      i++; return a;
    }
    const num = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i.exec(s.slice(i));
    if (num) { i += num[0].length; const n = Number(num[0]); return () => n; }
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (id) {
      i += id[0].length;
      const name = id[0];
      if (FUNCS[name] && peek() === '(') {
        i++; const a = expr();
        if (peek() !== ')') throw new FormulaError(')');
        i++; const f = FUNCS[name]; return (v) => f(a(v));
      }
      if (name === 'pi') return () => Math.PI;
      if (!allowSet.has(name)) throw new FormulaError(name);
      return (v) => v[name] ?? NaN;
    }
    throw new FormulaError(c);
  };

  const node = expr();
  if (peek() !== undefined) throw new FormulaError(s[i]);
  return node;
}

/** 표의 각 행 값으로 계산 (값이 없거나 계산이 안 되면 NaN) */
export function evalColumn(fn: Node, xs: number[], rows: Record<string, number>[], yId: string): number[] {
  const y0 = rows.map((r) => r[yId]).find((v) => typeof v === 'number' && isFinite(v)) ?? NaN;
  return rows.map((r, k) => {
    const out = fn({ ...r, x: xs[k], y: r[yId] ?? NaN, y0 });
    return isFinite(out) ? out : NaN;
  });
}


export const FORMULA_EXAMPLES: { name: string; unit: string; expr: string }[] = [
  { name: tk('절대온도'), unit: 'K', expr: 'y + 273.15' },
  { name: tk('[H⁺] 농도'), unit: 'mol/L', expr: '10^(-y)' },
  { name: tk('처음 값과의 차'), unit: '', expr: 'y - y0' },
  { name: tk('압력×부피'), unit: '', expr: 'y * x' },
];
