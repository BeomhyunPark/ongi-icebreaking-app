import { useEffect, useRef, useState } from 'react';
import { ScreenLayout } from '../../components/ScreenLayout';
import { PrimaryButton } from '../../components/PrimaryButton';
import { useManitto } from './hooks/useManitto';
import { copyInvitation, invitationUrl, isRoomCode, normalizeRoomCode } from './services/rooms';
import './styles/manitto.css';

export function ManittoApp({ onBackHome }: { onBackHome: () => void }) {
  const controller = useManitto();
  const { room, rooms, code, busy, loading, error, needsJoin } = controller;
  const [title, setTitle] = useState('');
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState(code);
  const [participating, setParticipating] = useState(true);
  const [mission, setMission] = useState('');
  const [pendingCompletion, setPendingCompletion] = useState<{ id: string; completed: boolean } | null>(null);
  const missionDraft = useRef({ id: '', content: '' });
  const [reveal, setReveal] = useState(false);
  const [confirmation, setConfirmation] = useState<'assign' | 'close' | null>(null);
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const [copyMessage, setCopyMessage] = useState('');
  useEffect(() => {
    setReveal(false); setConfirmation(null); setCopyMessage(''); setMission('');
    missionDraft.current = { id: '', content: '' };
  }, [code]);
  useEffect(() => {
    const hide = () => { if (document.hidden) setReveal(false); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => {
    if (confirmation) confirmDialog.current?.showModal();
  }, [confirmation]);

  return (
    <ScreenLayout className="manitto-screen">
      <header className="manitto-header">
        <button type="button" onClick={onBackHome}>← 홈</button>
        <span>마니또</span>
        {code ? <button type="button" disabled={busy} onClick={() => controller.open('')}>내 모임</button> : <span />}
      </header>
      {error ? <p className="manitto-error" role="alert">{error}</p> : null}
      {loading && !room ? <p role="status">모임을 불러오고 있어요…</p> : null}
      {room ? <>
        <section className="manitto-heading">
          <span className="manitto-badge">{room.assigned ? '활동 중' : '참가자 모집 중'}</span>
          <h1>{room.title}</h1>
          <p>{room.me.name} · {room.me.host ? '진행자' : '참가자'} · 참가자 {room.participantCount}명</p>
        </section>
        {!room.assigned ? <section className="manitto-card">
          <h2>함께할 사람 초대하기</h2>
          <p className="manitto-code">{room.code.match(/.{1,4}/g)?.join(' ')}</p>
          <button type="button" onClick={async () => setCopyMessage(await copyInvitation(room.code) ? '초대 링크를 복사했어요.' : '아래 링크를 길게 눌러 복사해주세요.')}>초대 링크 복사</button>
          <label className="manitto-invitation">초대 링크<input readOnly value={invitationUrl(room.code)} onFocus={(event) => event.target.select()} /></label>
          <p role="status">{copyMessage}</p>
          {room.me.host ? <>
            <p>모두 참가한 뒤 배정해주세요. 배정 후에는 참가자를 추가하거나 다시 배정할 수 없어요.</p>
            <PrimaryButton disabled={busy || room.participantCount < 2} onClick={() => setConfirmation('assign')}>마니또 배정하기</PrimaryButton>
          </> : <p>진행자가 마니또를 배정하면 여기에서 확인할 수 있어요.</p>}
        </section> : null}
        {room.assigned && room.me.participating ? <section className="manitto-card manitto-secret">
          <small>나의 마니또</small>
          {reveal ? <strong>{room.me.recipient}</strong> : <strong aria-label="상대 이름 숨김">•••</strong>}
          <button type="button" aria-expanded={reveal} onClick={() => setReveal(!reveal)}>{reveal ? '상대 숨기기' : '내 상대 확인하기'}</button>
        </section> : null}
        {room.assigned ? <section className="manitto-card">
          <h2>미션</h2>
          {room.missions.length === 0 ? <p>아직 등록된 미션이 없어요.</p> : <ul className="manitto-missions">
            {room.missions.map((item, index) => <li key={item.id}>
              <small>미션 {index + 1}</small>
              <p>{item.content}</p>
              {room.me.participating ? <label className="manitto-check">
                <input type="checkbox" checked={pendingCompletion?.id === item.id ? pendingCompletion.completed : item.completed} disabled={busy}
                  onChange={async (event) => {
                    const completed = event.target.checked;
                    setPendingCompletion({ id: item.id, completed });
                    await controller.complete(item.id, completed);
                    setPendingCompletion(null);
                  }} />
                {pendingCompletion?.id === item.id ? '저장 중…' : item.completed ? '완료했어요' : '완료 표시'}
              </label> : null}
            </li>)}
          </ul>}
          {room.me.host ? <form onSubmit={async (event) => {
            event.preventDefault();
            const content = mission.trim();
            if (!content) return;
            if (missionDraft.current.content !== content) missionDraft.current = { id: crypto.randomUUID(), content };
            if (await controller.mission(missionDraft.current.id, content)) {
              setMission(''); missionDraft.current = { id: '', content: '' };
            }
          }}>
            <label>새 미션<textarea maxLength={500} required value={mission} disabled={busy} onChange={(event) => setMission(event.target.value)} placeholder="참가자에게 전달할 미션을 적어주세요" /></label>
            <PrimaryButton type="submit" disabled={busy || !mission.trim()}>미션 등록</PrimaryButton>
          </form> : null}
        </section> : null}
        {room.me.host ? <section className="manitto-card">
          <h2>{room.assigned ? '미션 현황판' : '참가자 명단'}</h2>
          <p>진행자에게만 보여요.</p>
          {room.dashboard.length === 0 ? <p>참가자를 기다리고 있어요.</p> : <ul className="manitto-dashboard">
            {room.dashboard.map((person) => <li key={person.id}>
              <div><strong>{person.name}</strong>{room.assigned ? <span>{person.completedMissionIds.length} / {room.missions.length} 완료</span> : null}</div>
              {room.assigned && room.missions.length > 0 ? <ul className="manitto-progress">
                {room.missions.map((item, index) => <li key={item.id} className={person.completedMissionIds.includes(item.id) ? 'is-complete' : ''}>
                  미션 {index + 1} · {person.completedMissionIds.includes(item.id) ? '완료' : '미완료'}
                </li>)}
              </ul> : null}
            </li>)}
          </ul>}
        </section> : null}
        <footer className="manitto-footer">
          <p>현황은 5초마다 갱신돼요. 다른 기능을 쓰다가 돌아와도 이어집니다.</p>
          <p>{new Date(room.expiresAt).toLocaleDateString('ko-KR')}까지 보관돼요.</p>
          {room.me.host ? <button type="button" disabled={busy} onClick={() => setConfirmation('close')}>모임 종료하기</button> : null}
        </footer>
        {confirmation ? <dialog ref={confirmDialog} className="manitto-card manitto-confirm" aria-labelledby="manitto-confirm-title"
          onCancel={(event) => { event.preventDefault(); if (!busy) setConfirmation(null); }}>
          <h2 id="manitto-confirm-title">{confirmation === 'assign' ? '참가자가 모두 모였나요?' : '모임을 종료할까요?'}</h2>
          <p>{confirmation === 'assign' ? `${room.participantCount}명의 마니또를 배정해요. 배정은 되돌릴 수 없어요.` : '배정, 미션, 참가자 정보가 모두 삭제돼요.'}</p>
          <div><button type="button" disabled={busy} onClick={() => setConfirmation(null)}>취소</button>
            <PrimaryButton disabled={busy} onClick={async () => {
              if (confirmation === 'assign') { if (await controller.assign()) setConfirmation(null); }
              else await controller.close();
            }}>{confirmation === 'assign' ? '배정 확정' : '종료 확정'}</PrimaryButton></div>
        </dialog> : null}
      </> : !loading ? <>
        <section className="manitto-heading"><h1>마니또</h1><p>상대를 확인하고 미션을 함께 이어가요.</p></section>
        {!code && rooms.length > 0 ? <section className="manitto-card"><h2>내 모임</h2><ul className="manitto-room-list">{rooms.map((saved) => <li key={saved.code}><button type="button" disabled={busy} onClick={() => controller.open(saved.code)}>{saved.title} <span>이어가기 →</span></button></li>)}</ul></section> : null}
        {(!code || needsJoin) ? <section className="manitto-card">
          <h2>모임 참가하기</h2>
          <form onSubmit={(event) => { event.preventDefault(); void controller.join(code || normalizeRoomCode(joinCode), name.trim()); }}>
            {!code ? <label>초대 코드<input autoCapitalize="characters" autoComplete="off" value={joinCode} maxLength={16} onChange={(event) => setJoinCode(event.target.value)} placeholder="12자리 초대 코드" required /></label> : null}
            <label>내 이름<input value={name} onChange={(event) => setName(event.target.value)} maxLength={30} required autoComplete="nickname" /></label>
            <PrimaryButton type="submit" disabled={busy || !name.trim() || !isRoomCode(code || normalizeRoomCode(joinCode))}>참가하기</PrimaryButton>
          </form>
        </section> : null}
        {!code ? <section className="manitto-card">
          <h2>새 모임 만들기</h2>
          <form onSubmit={(event) => { event.preventDefault(); void controller.create(title.trim(), name.trim(), participating); }}>
            <label>모임 이름<input maxLength={60} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 청년부 마니또" /></label>
            <label>진행자 이름<input maxLength={30} required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="manitto-check"><input type="checkbox" checked={participating} onChange={(event) => setParticipating(event.target.checked)} />나도 마니또에 참가하기</label>
            <PrimaryButton type="submit" disabled={busy || !title.trim() || !name.trim()}>모임 만들기</PrimaryButton>
          </form>
        </section> : null}
        <p className="manitto-footer">모임은 30일 동안 유지돼요. 다시 들어올 때는 참가한 브라우저를 사용해주세요.</p>
      </> : null}
    </ScreenLayout>
  );
}
