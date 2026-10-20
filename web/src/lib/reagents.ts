// 시약 정보 (protocol/reagents.json): 준비물 문구에서 시약을 찾아 설명·주의·조제 방법을 보여 줌
import raw from '../../../protocol/reagents.json';

export interface Reagent {
  id: string;
  name: string;
  aliases?: string[];
  formula?: string;
  hazard?: string[];
  ghs?: string;
  ppe?: string[];
  useIn?: string;
  prep?: { target?: string; steps?: string[]; notes?: string[] };
  handling?: string[];
  storage?: string;
  disposal?: string;
  firstAid?: { skin?: string; eye?: string; swallow?: string; inhale?: string };
  studentLimit?: string;
  matches: string[];
}

const data = raw as { version: number; reagents: Reagent[] };
export const reagents: Reagent[] = data.reagents ?? [];

/** 준비물 목록에서 쓰인 시약들 (긴 이름 먼저 맞춰 중복 방지) */
export function reagentsFor(materials: string[]): Reagent[] {
  const text = materials.join('\n');
  const out: Reagent[] = [];
  for (const r of reagents) {
    const keys = [...r.matches, r.name, ...(r.aliases ?? [])].filter(Boolean);
    if (keys.some((k) => text.includes(k)) && !out.includes(r)) out.push(r);
  }
  return out;
}
