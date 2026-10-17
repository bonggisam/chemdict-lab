import { useState } from 'react';
import { EMPTY_INFO, type ExpInfo } from '../lib/info';

interface Props { info: ExpInfo; onSave: (i: ExpInfo) => void; onClose: () => void }

const z = (n: number) => String(n).padStart(2, '0');

/** 실험 정보 입력 (모두 선택 사항) */
export function InfoSheet({ info, onSave, onClose }: Props) {
  const [v, setV] = useState<ExpInfo>(info);
  const set = (k: keyof ExpInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });
  const now = () => { const d = new Date(); setV({ ...v, date: `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`, time: `${z(d.getHours())}:${z(d.getMinutes())}` }); };
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet wide-sheet info-sheet" role="dialog" aria-modal="true" aria-label="실험 정보" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onSave(v); onClose(); }}>
        <h2>실험 정보</h2>
        <p className="note">모두 선택 사항입니다. 적은 내용은 그림·PDF·엑셀·CSV로 저장할 때 함께 남습니다. 날짜·시간을 비우면 측정을 시작한 때가 들어갑니다.</p>
        <div className="info-grid">
          <label>모둠·실험조<input value={v.group} onChange={set('group')} placeholder="예: 3모둠, A조" autoFocus /></label>
          <label>이름<input value={v.members} onChange={set('members')} placeholder="예: 김OO, 이OO" /></label>
          <label>학년·반<input value={v.className} onChange={set('className')} placeholder="예: 2학년 3반" /></label>
          <label>장소<input value={v.place} onChange={set('place')} placeholder="예: 과학실 1" /></label>
          <label>날짜<input type="date" value={v.date} onChange={set('date')} /></label>
          <label>시간<input type="time" value={v.time} onChange={set('time')} /></label>
          <label className="wide">메모<textarea rows={3} value={v.note} onChange={set('note')} placeholder="실험 조건, 날씨, 특이 사항 등" /></label>
        </div>
        <div className="sheet-actions">
          <span className="info-left">
            <button type="button" className="ghost" onClick={now}>지금 날짜·시간</button>
            <button type="button" className="ghost" onClick={() => setV({ ...EMPTY_INFO })}>모두 지우기</button>
          </span>
          <span className="info-left">
            <button type="button" className="ghost" onClick={onClose}>취소</button>
            <button type="submit" className="primary">저장</button>
          </span>
        </div>
        <p className="note">모둠·이름·반·장소는 이 기기에 기억되어 다음 실험에도 미리 채워집니다.</p>
      </form>
    </div>
  );
}
