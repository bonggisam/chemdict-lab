// 활동지: 예측 → 측정 결과(보고서의 그래프·해석) → 결론 질문 (애플 앱 WorksheetView·Worksheet와 같은 질문)
// 쓰던 내용은 이 기기·브라우저에 실험마다 저장 (새로 고침해도 남음). 모둠·이름은 실험 정보(ExpInfo)를 씀.
import { t, tk } from './i18n';

export const WORKSHEET_QUESTIONS = [
  tk('그래프의 모양(늘어남·줄어듦·멈춤)을 시간 순서대로 설명해 보세요.'),
  tk('예측과 실제 결과를 비교해 보세요. 같은 점과 다른 점은?'),
  tk('이런 결과가 나온 까닭을 과학 개념으로 설명해 보세요.'),
  tk('오차가 생겼다면 그 까닭과 줄이는 방법은?'),
];

export interface Worksheet { prediction: string; answers: string[] }

export const emptyWorksheet = (): Worksheet => ({ prediction: '', answers: WORKSHEET_QUESTIONS.map(() => '') });

const key = (expId: string) => `chemdict.worksheet.${expId}`;

export function loadWorksheet(expId: string): Worksheet {
  try {
    const v = JSON.parse(localStorage.getItem(key(expId)) ?? 'null');
    if (!v || typeof v !== 'object') return emptyWorksheet();
    const answers = WORKSHEET_QUESTIONS.map((_, i) => (typeof v.answers?.[i] === 'string' ? v.answers[i] : ''));
    return { prediction: typeof v.prediction === 'string' ? v.prediction : '', answers };
  } catch { return emptyWorksheet(); }
}

export function saveWorksheet(expId: string, w: Worksheet) {
  try {
    if (isEmptyWorksheet(w)) localStorage.removeItem(key(expId));
    else localStorage.setItem(key(expId), JSON.stringify(w));
  } catch { /* noop */ }
}

export const isEmptyWorksheet = (w: Worksheet) => !w.prediction.trim() && w.answers.every((a) => !a.trim());

/** 보고서에 넣을 모양 (질문은 지금 언어로) */
export function worksheetForReport(w: Worksheet): { prediction: string; answers: { q: string; a: string }[] } {
  return { prediction: w.prediction, answers: WORKSHEET_QUESTIONS.map((q, i) => ({ q: t(q), a: w.answers[i] ?? '' })) };
}
