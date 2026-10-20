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

/** 준비물 목록에서 쓰인 시약들. 긴 이름부터 맞추고 맞은 글자는 지워, '아세트산 나트륨'이 '아세트산'으로도 잡히지 않게 함 */
export function reagentsFor(materials: string[]): Reagent[] {
  let text = materials.join('\n');
  const keyed = reagents.map((r) => ({ r, keys: [...r.matches, r.name, ...(r.aliases ?? [])].filter(Boolean) }));
  const pairs = keyed.flatMap(({ r, keys }) => keys.map((k) => ({ r, k }))).sort((a, b) => b.k.length - a.k.length);
  const hit = new Set<Reagent>();
  for (const { r, k } of pairs) {
    if (!text.includes(k)) continue;
    hit.add(r);
    text = text.split(k).join('\u0000');
  }
  return reagents.filter((r) => hit.has(r));
}
