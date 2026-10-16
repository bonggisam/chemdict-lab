import type { Experiment } from './protocol';

// protocol/experiments/*.json 을 그대로 읽습니다 (애플 앱과 같은 파일).
const modules = import.meta.glob('../../../protocol/experiments/*.json', { eager: true, import: 'default' });

export const experiments: Experiment[] = Object.values(modules as Record<string, Experiment>).sort(
  (a, b) => a.order - b.order,
);
