/** 장식용 이모지 아이콘 (화면 읽기에서는 건너뜀) */
export function Ico({ e }: { e: string }) {
  return <span className="ico" aria-hidden="true">{e}</span>;
}
