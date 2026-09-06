import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

import { PrimaryButton } from '../../components/PrimaryButton';
import { ScreenLayout } from '../../components/ScreenLayout';
import { SharingApiError, sharingApi } from './api/sharingApi';
import type {
  CurrentSharing,
  ParticipantStatus,
  Question,
  RoomState,
} from './domain/types';
import { useRoomEvents } from './hooks/useRoomEvents';
import {
  clearRoomReference,
  loadRoomReference,
  readSharingHash,
  replaceSharingHash,
  saveRoomReference,
} from './services/roomReference';
import './styles/anonymous-sharing.css';
import {
  completeContentParticipation,
  recordShareClick,
  startContentParticipation,
} from '../../engagement/tracker';

type AnonymousSharingAppProps = {
  onBackHome: () => void;
};

const draftKey = (id: string) => `ongi.sharing-draft.${id}`;
function readDraft(id: string): Record<string, string> {
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey(id)) ?? 'null');
    if (draft?.expires > Date.now() && draft.answers && typeof draft.answers === 'object') {
      return Object.fromEntries(Object.entries(draft.answers).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    }
    sessionStorage.removeItem(draftKey(id));
  } catch { /* Storage may be unavailable. */ }
  return {};
}
function storeDraft(id: string, answers: Record<string, string>, expires: string) {
  try { sessionStorage.setItem(draftKey(id), JSON.stringify({ answers, expires: Date.parse(expires) })); } catch { /* Server saving remains available. */ }
}
function removeDraft(id: string) {
  try { sessionStorage.removeItem(draftKey(id)); } catch { /* Storage may be unavailable. */ }
}

function HowToPlay() {
  return <aside className="anonymous-sharing-guide" aria-label="이용 방법">
    <strong>이렇게 함께해요</strong>
    <ol>
      <li>질문에 답하고 <b>작성 완료</b>를 눌러요. 어려운 질문은 건너뛰어도 돼요.</li>
      <li>익명으로 나온 이야기를 읽고 <b>누구인지 함께 맞혀봐요.</b></li>
      <li>작성자가 <b>이거 저예요</b>를 눌러 이름을 공개해요.</li>
    </ol>
  </aside>;
}

type EntryMode = 'HOME' | 'CREATE' | 'JOIN';

function errorMessage(error: unknown): string {
  return error instanceof SharingApiError ? error.message : '요청을 처리하지 못했어요.';
}

function joinUrl(roomCode: string): string {
  const url = new URL(window.location.href);
  url.search = '?activity=anonymous-sharing';
  url.hash = `join=${encodeURIComponent(roomCode)}`;
  return url.href;
}

function Header({ onBackHome }: { onBackHome: () => void }) {
  return (
    <header className="anonymous-sharing-header">
      <button type="button" onClick={onBackHome} aria-label="온기 홈으로 돌아가기">
        <span aria-hidden="true">←</span> 홈
      </button>
    </header>
  );
}

export function AnonymousSharingApp({ onBackHome }: AnonymousSharingAppProps) {
  const initialHash = useMemo(() => readSharingHash(), []);
  const [entryMode, setEntryMode] = useState<EntryMode>(initialHash.joinCode ? 'JOIN' : 'HOME');
  const [roomId, setRoomId] = useState<string | null>(
    initialHash.roomId ?? (initialHash.joinCode ? null : loadRoomReference()),
  );
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [participants, setParticipants] = useState<ParticipantStatus[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [sharing, setSharing] = useState<CurrentSharing | null>(null);
  const [title, setTitle] = useState('');
  const [roomCode, setRoomCode] = useState(initialHash.joinCode ?? '');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(roomId !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hostWriting, setHostWriting] = useState(false);
  const [revealConfirming, setRevealConfirming] = useState(false);
  const storyTop = useRef<HTMLHeadingElement>(null);
  const draft = useRef<Record<string, string>>({});
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [saveStatus, setSaveStatus] = useState('');
  const [cancelConfirming, setCancelConfirming] = useState(false);

  const hydrateRoom = useCallback(async (targetRoomId: string) => {
    try {
      const state = await sharingApi.getState(targetRoomId);
      setRoomState(state);
      setRoomId(targetRoomId);
      saveRoomReference(targetRoomId);
      replaceSharingHash('room', targetRoomId);

      if (state.role === 'HOST' && state.status !== 'COMPLETED' && state.status !== 'SHARING') {
        const result = await sharingApi.getParticipants(targetRoomId);
        setParticipants(result.participants);
      }

      if (state.participantJoined
        && (state.status === 'WRITING' || state.status === 'LOCKED')
        && !state.responseCompleted) {
        const [questionResult, responseResult] = await Promise.all([
          sharingApi.getQuestions(targetRoomId),
          sharingApi.getMyResponses(targetRoomId),
        ]);
        const restoredAnswers = Object.fromEntries(
          responseResult.answers.map((answer) => [answer.questionId, answer.answer]),
        );
        setQuestions(questionResult.questions);
        draft.current = { ...readDraft(targetRoomId), ...draft.current };
        setAnswers({ ...restoredAnswers, ...draft.current });
        const firstUnanswered = questionResult.questions.findIndex(({ id }) => !restoredAnswers[id]);
        setQuestionIndex((current) => (
          current >= questionResult.questions.length
            ? Math.max(0, firstUnanswered)
            : current
        ));
      }

      if (state.responseCompleted || state.status === 'SHARING' || state.status === 'COMPLETED') {
        removeDraft(targetRoomId);
        draft.current = {};
      }
      if (state.status === 'SHARING') {
        setSharing(await sharingApi.getCurrentSharing(targetRoomId));
      } else {
        setSharing(null);
      }
      setError('');
    } catch (nextError) {
      if (nextError instanceof SharingApiError && nextError.status === 401) {
        removeDraft(targetRoomId);
        draft.current = {};
        clearRoomReference();
        setRoomId(null);
        setRoomState(null);
        replaceSharingHash(null);
      }
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (roomId) {
      void hydrateRoom(roomId);
    }
  }, [hydrateRoom, roomId]);

  useEffect(() => {
    setRevealConfirming(false);
    if (sharing) {
      const screen = storyTop.current?.closest('.anonymous-sharing-screen');
      screen?.scrollTo?.({ top: 0, behavior: 'instant' });
      screen?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
      storyTop.current?.focus({ preventScroll: true });
    }
  }, [sharing?.sequence, sharing?.state]);

  const persistAnswers = useCallback((id: string, values: Record<string, string>) => {
    const task = saveQueue.current.catch(() => undefined).then(() => sharingApi.saveResponses(id,
      Object.entries(values).map(([questionId, answer]) => ({ questionId, answer })),
    ));
    saveQueue.current = task;
    return task;
  }, []);

  useEffect(() => {
    if (busy || !roomId || !roomState || roomState.responseCompleted
      || !['WRITING', 'LOCKED'].includes(roomState.status) || !Object.keys(draft.current).length) return;
    const snapshot = { ...draft.current };
    const timer = window.setTimeout(() => {
      setSaveStatus('저장 중…');
      void persistAnswers(roomId, snapshot).then(() => setSaveStatus('저장했어요'))
        .catch(() => setSaveStatus('서버에 저장하지 못했어요. 연결을 확인하고 이전·다음 버튼으로 다시 저장해주세요.'));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [answers, busy, roomId, roomState?.status, roomState?.responseCompleted, persistAnswers]);

  useEffect(() => {
    if (roomState?.status === 'COMPLETED') {
      void completeContentParticipation('anonymous-sharing');
    }
  }, [roomState?.status]);

  const refreshCurrentRoom = useCallback(() => {
    if (roomId) {
      void hydrateRoom(roomId);
    }
  }, [hydrateRoom, roomId]);
  const reconnecting = useRoomEvents(roomState?.status === 'COMPLETED' ? null : roomId, refreshCurrentRoom);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  const handleBackHome = () => {
    if (roomState?.status === 'COMPLETED') {
      clearRoomReference();
    }
    replaceSharingHash(null);
    onBackHome();
  };

  const resetRoom = (nextEntryMode: EntryMode) => {
    if (roomId) removeDraft(roomId);
    draft.current = {};
    clearRoomReference();
    replaceSharingHash(null);
    setRoomId(null);
    setRoomState(null);
    setParticipants([]);
    setQuestions([]);
    setAnswers({});
    setQuestionIndex(0);
    setSharing(null);
    setTitle('');
    setRoomCode('');
    setName('');
    setError('');
    setNotice('');
    setHostWriting(false);
    setCancelConfirming(false);
    setEntryMode(nextEntryMode);
  };

  const startNewRoom = () => resetRoom('CREATE');

  const createRoom = () => run(async () => {
    const created = await sharingApi.createRoom(title);
    void startContentParticipation('anonymous-sharing');
    setRoomCode(created.roomCode);
    setRoomId(created.roomId);
    await hydrateRoom(created.roomId);
  });

  const joinRoom = () => run(async () => {
    const joined = await sharingApi.joinRoom(roomCode, name);
    void startContentParticipation('anonymous-sharing');
    setRoomId(joined.roomId);
    await hydrateRoom(joined.roomId);
  });

  const lockRoom = () => run(async () => {
    if (!roomId || !roomState) return;
    await sharingApi.lockRoom(roomId, roomState.version);
    await hydrateRoom(roomId);
  });

  const unlockRoom = () => run(async () => {
    if (!roomId || !roomState) return;
    await sharingApi.unlockRoom(roomId, roomState.version);
    await hydrateRoom(roomId);
  });

  const cancelRoom = () => run(async () => {
    if (!roomId || !roomState) return;
    await sharingApi.cancelRoom(roomId, roomState.version);
    resetRoom('HOME');
  });

  const joinAsHostParticipant = () => run(async () => {
    const code = roomState?.roomCode ?? roomCode;
    if (!roomId || !code) return;
    await sharingApi.joinRoom(code, name);
    setHostWriting(true);
    await hydrateRoom(roomId);
  });

  const startSharing = () => run(async () => {
    if (!roomId || !roomState) return;
    setSharing(await sharingApi.startSharing(roomId, roomState.version));
    await hydrateRoom(roomId);
  });

  const saveCurrentAnswer = async () => {
    if (!roomId || !questions[questionIndex]) return;
    const question = questions[questionIndex];
    await persistAnswers(roomId, { ...draft.current, [question.id]: answers[question.id] ?? '' });
    setSaveStatus('저장했어요');
  };

  const moveQuestion = (direction: -1 | 1) => run(async () => {
    await saveCurrentAnswer();
    setQuestionIndex((current) => Math.max(0, Math.min(questions.length - 1, current + direction)));
  });

  const finishAnswers = () => run(async () => {
    if (!roomId) return;
    await saveCurrentAnswer();
    await sharingApi.completeResponses(roomId);
    setHostWriting(false);
    await hydrateRoom(roomId);
  });

  const editAnswers = () => run(async () => {
    if (!roomId) return;
    await sharingApi.reopenResponses(roomId);
    setHostWriting(true);
    setQuestionIndex(0);
    await hydrateRoom(roomId);
  });

  const returnToHostLobby = () => run(async () => {
    await saveCurrentAnswer();
    setHostWriting(false);
  });

  const reveal = () => run(async () => {
    if (!roomId) return;
    setSharing(await sharingApi.reveal(roomId));
    setRevealConfirming(false);
  });

  const nextStory = () => run(async () => {
    if (!roomId || !sharing || sharing.sequence === null) return;
    setSharing(await sharingApi.next(roomId, sharing.roomVersion, sharing.sequence));
    await hydrateRoom(roomId);
  });

  const completeRoom = () => run(async () => {
    if (!roomId || !sharing) return;
    await sharingApi.completeRoom(roomId, sharing.roomVersion);
    await hydrateRoom(roomId);
  });

  if (loading) {
    return (
      <ScreenLayout className="anonymous-sharing-screen is-centered">
        <p className="anonymous-sharing-loading">모임을 다시 불러오고 있어요…</p>
      </ScreenLayout>
    );
  }

  if (!roomState || !roomId) {
    return (
      <ScreenLayout className="anonymous-sharing-screen">
        <Header onBackHome={handleBackHome} />
        <section className="anonymous-sharing-entry">
          <div className="anonymous-sharing-symbol" aria-hidden="true">♡</div>
          <p className="eyebrow">온기 · 소그룹 나눔</p>
          <h1>누구의 이야기인지<br />천천히 알아가요</h1>
          <p>이야기를 먼저 읽고,<br /> 누군지 생각해봐요</p>
        </section>

        <HowToPlay />
        {entryMode === 'HOME' ? (
          <div className="anonymous-sharing-entry-actions">
            <PrimaryButton onClick={() => setEntryMode('CREATE')}>진행자로 모임 만들기</PrimaryButton>
            <button type="button" onClick={() => setEntryMode('JOIN')}>참여 코드로 참여하기</button>
          </div>
        ) : null}

        {entryMode === 'CREATE' ? (
          <section className="anonymous-sharing-form" aria-labelledby="create-room-title">
            <h2 id="create-room-title">새 모임 만들기</h2>
            <label htmlFor="sharing-room-title">모임 이름 <span>선택</span></label>
            <input
              id="sharing-room-title"
              value={title}
              maxLength={120}
              placeholder="예: 임마누엘 중그룹 모임 1"
              onChange={(event) => setTitle(event.target.value)}
            />
            <PrimaryButton disabled={busy} onClick={createRoom}>{busy ? '만드는 중…' : '모임 만들기'}</PrimaryButton>
            <button type="button" onClick={() => setEntryMode('HOME')}>이전으로</button>
          </section>
        ) : null}

        {entryMode === 'JOIN' ? (
          <section className="anonymous-sharing-form" aria-labelledby="join-room-title">
            <h2 id="join-room-title">모임에 참여하기</h2>
            <label htmlFor="sharing-room-code">참여 코드</label>
            <input
              id="sharing-room-code"
              className="is-code"
              value={roomCode}
              maxLength={9}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="7KFM-3QPX"
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            />
            <label htmlFor="sharing-name">이름</label>
            <input
              id="sharing-name"
              value={name}
              maxLength={40}
              autoComplete="name"
              placeholder="모임에서 사용하는 이름"
              onChange={(event) => setName(event.target.value)}
            />
            <PrimaryButton disabled={busy || !roomCode.trim() || !name.trim()} onClick={joinRoom}>
              {busy ? '입장하는 중…' : '참여하기'}
            </PrimaryButton>
            <button type="button" onClick={() => setEntryMode('HOME')}>이전으로</button>
          </section>
        ) : null}
        {error ? <p className="anonymous-sharing-error" role="alert">{error}</p> : null}
      </ScreenLayout>
    );
  }

  const visibleRoomCode = roomState.roomCode ?? roomCode;
  const shareUrl = visibleRoomCode ? joinUrl(visibleRoomCode) : '';
  const isHostLobby = roomState.role === 'HOST'
    && ['CREATED', 'WRITING', 'LOCKED'].includes(roomState.status)
    && !hostWriting;
  const isWriting = (roomState.role === 'PARTICIPANT' || (roomState.role === 'HOST' && hostWriting))
    && roomState.participantJoined
    && ['WRITING', 'LOCKED'].includes(roomState.status)
    && !roomState.responseCompleted;
  const isWaiting = roomState.role === 'PARTICIPANT'
    && ['WRITING', 'LOCKED'].includes(roomState.status)
    && roomState.responseCompleted;
  const currentQuestion = questions[questionIndex];
  const hasWrittenAnswer = questions.some(({ id }) => Boolean(answers[id]?.trim()));

  return (
    <ScreenLayout className="anonymous-sharing-screen">
      {roomState.status !== 'COMPLETED' ? <Header onBackHome={handleBackHome} /> : null}
      {reconnecting ? <p className="anonymous-sharing-network" role="status">연결을 다시 확인하고 있어요…</p> : null}

      {isHostLobby ? (
        <section className="anonymous-sharing-lobby">
          <p className="eyebrow">진행자 화면</p>
          <h1>{roomState.title}</h1>
          <p className="anonymous-sharing-guide">참여 링크 공유 → 입장 마감 → 모두 작성 완료 → 나눔 시작<br />나눔은 2명 이상부터 시작할 수 있어요. 입장을 마감해도 답변은 계속 작성할 수 있어요.</p>
          {roomState.status !== 'LOCKED' && visibleRoomCode ? (
            <div className="anonymous-sharing-invite">
              <div className="anonymous-sharing-qr">
                <QRCodeSVG value={shareUrl} size={164} level="M" marginSize={2} />
              </div>
              <span>참여 코드</span>
              <strong>{visibleRoomCode}</strong>
              <button type="button" onClick={() => {
                if (!navigator.clipboard) {
                  setNotice('이 브라우저에서는 링크를 직접 복사해주세요.');
                  return;
                }
                void navigator.clipboard.writeText(shareUrl)
                  .then(() => {
                    setNotice('참여 링크를 복사했어요.');
                    void recordShareClick('anonymous-sharing', 'copy_link');
                  })
                  .catch(() => setNotice('링크를 복사하지 못했어요.'));
              }}>참여 링크 복사</button>
              <p aria-live="polite">{notice}</p>
            </div>
          ) : (
            <div className="anonymous-sharing-locked"><span aria-hidden="true">✓</span> 참여자 입장을 마감했어요.</div>
          )}

          {!roomState.participantJoined && roomState.status !== 'LOCKED' ? (
            <div className="anonymous-sharing-host-participation">
              <strong>진행자도 함께 참여할까요?</strong>
              <p>이름을 입력하면 진행 권한은 유지하면서 익명 답변도 작성할 수 있어요.</p>
              <label htmlFor="sharing-host-name">내 이름</label>
              <input
                id="sharing-host-name"
                value={name}
                maxLength={40}
                autoComplete="name"
                placeholder="모임에서 사용하는 이름"
                onChange={(event) => setName(event.target.value)}
              />
              <button type="button" disabled={busy || !name.trim()} onClick={joinAsHostParticipant}>나도 참여하기</button>
            </div>
          ) : null}

          {roomState.role === 'HOST' && roomState.participantJoined ? (
            <div className="anonymous-sharing-host-participation is-joined">
              <strong>{roomState.responseCompleted ? '내 답변 작성 완료' : '진행자도 참여 중이에요'}</strong>
              {roomState.responseCompleted ? <button type="button" disabled={busy} onClick={editAnswers}>내 답변 확인·수정</button> : (
                <button type="button" disabled={busy} onClick={() => setHostWriting(true)}>내 답변 작성하기</button>
              )}
            </div>
          ) : null}

          <div className="anonymous-sharing-progress-summary">
            <strong>{roomState.completedParticipantCount}/{roomState.participantCount}</strong>
            <span>작성 완료</span>
          </div>
          <ul className="anonymous-sharing-participants">
            {participants.map((participant) => (
              <li key={`${participant.name}-${participant.joinedAt}`}>
                <span>{participant.name}</span>
                <b className={participant.responseCompleted ? 'is-done' : ''}>
                  {participant.responseCompleted ? '작성 완료' : '작성 중'}
                </b>
              </li>
            ))}
          </ul>
          {participants.length === 0 ? <p className="anonymous-sharing-empty">QR을 공유하고 참여자를 기다려주세요.</p> : null}

          <div className="anonymous-sharing-lobby-actions">
            {roomState.status !== 'LOCKED' ? (
              <PrimaryButton disabled={busy || roomState.participantCount === 0} onClick={lockRoom}>참여자 입장 마감</PrimaryButton>
            ) : (
              <>
                <PrimaryButton
                  disabled={busy || roomState.participantCount < 2 || roomState.completedParticipantCount !== roomState.participantCount}
                  onClick={startSharing}
                >
                  모두 준비됐어요 · 나눔 시작
                </PrimaryButton>
                <button type="button" disabled={busy} onClick={unlockRoom}>참여자 입장 다시 열기</button>
              </>
            )}
          </div>
          {roomState.status === 'LOCKED' && roomState.completedParticipantCount !== roomState.participantCount ? (
            <p className="anonymous-sharing-help">모든 참여자가 작성을 완료하면 시작할 수 있어요.</p>
          ) : null}

          <div className="anonymous-sharing-cancel-room">
            {!cancelConfirming ? (
              <button type="button" disabled={busy} onClick={() => setCancelConfirming(true)}>방 없애기</button>
            ) : (
              <div className="anonymous-sharing-cancel-confirm" role="alert">
                <strong>정말 이 방을 없앨까요?</strong>
                <p>참여자 이름과 작성 중인 답변까지 즉시 삭제되며 다시 복구할 수 없어요.</p>
                <div>
                  <button type="button" disabled={busy} onClick={() => setCancelConfirming(false)}>계속 사용하기</button>
                  <button className="is-danger" type="button" disabled={busy} onClick={cancelRoom}>
                    {busy ? '삭제하는 중…' : '방 없애기'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {isWriting && currentQuestion ? (
        <section className="anonymous-sharing-writing">
          {roomState.role === 'HOST' ? (
            <button className="anonymous-sharing-host-back" type="button" disabled={busy} onClick={returnToHostLobby}>← 진행자 화면으로</button>
          ) : null}
          <div className="anonymous-sharing-step">
            <span>{questionIndex + 1} / {questions.length}</span>
            <i style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
          </div>
          <p className="eyebrow">나를 소개하는 질문</p>
          <h1>{currentQuestion.prompt}</h1>
          <p className="anonymous-sharing-help">하나 이상 답한 뒤 마지막 질문에서 작성 완료를 눌러주세요.</p>
          <textarea
            aria-label={currentQuestion.prompt}
            disabled={busy}
            value={answers[currentQuestion.id] ?? ''}
            maxLength={2000}
            rows={7}
            onChange={(event) => {
              const value = event.target.value;
              draft.current = { ...draft.current, [currentQuestion.id]: value };
              storeDraft(roomId, draft.current, roomState.expiresAt);
              setSaveStatus('저장 대기 중…');
              setAnswers((current) => ({ ...current, [currentQuestion.id]: value }));
            }}
          />
          <p className="anonymous-sharing-help">{currentQuestion.helperText ?? '답하기 어려운 질문은 건너뛰어도 괜찮아요.'}</p>
          <p className="anonymous-sharing-help" role="status">{saveStatus}</p>
          <div className="anonymous-sharing-writing-actions">
            <button type="button" disabled={busy || questionIndex === 0} onClick={() => void moveQuestion(-1)}>이전</button>
            {questionIndex < questions.length - 1 ? (
              <PrimaryButton disabled={busy} onClick={() => void moveQuestion(1)}>다음</PrimaryButton>
            ) : (
              <PrimaryButton disabled={busy || !hasWrittenAnswer} onClick={finishAnswers}>작성 완료</PrimaryButton>
            )}
          </div>
          {questionIndex === questions.length - 1 && !hasWrittenAnswer ? (
            <p className="anonymous-sharing-help" role="status">답변을 하나 이상 작성해야 완료할 수 있어요.</p>
          ) : null}
        </section>
      ) : null}

      {isWaiting ? (
        <section className="anonymous-sharing-waiting">
          <div aria-hidden="true">✓</div>
          <p className="eyebrow">작성 완료</p>
          <h1>이제 서로를 기다려요</h1>
          <p>진행자가 나눔을 시작하면 익명 프로필이 여기에 나타나요. 화면을 잠시 꺼도 괜찮아요.</p>
          <strong>{roomState.completedParticipantCount}/{roomState.participantCount}명 완료</strong>
          <button className="anonymous-sharing-edit" type="button" disabled={busy} onClick={editAnswers}>내 답변 확인·수정</button>
          <p>나눔 시작 전까지 수정할 수 있어요. 수정 후에는 다시 작성 완료를 눌러주세요.</p>
          <HowToPlay />
        </section>
      ) : null}

      {roomState.status === 'SHARING' && sharing ? (
        <section className={`anonymous-sharing-story is-${sharing.state.toLowerCase()}`}>
          {sharing.state !== 'FINISHED' && sharing.sequence !== null ? (
            <div className="anonymous-sharing-round">{sharing.sequence + 1} / {sharing.total}번째 이야기</div>
          ) : null}
          {sharing.state === 'FINISHED' ? (
            <>
              <div className="anonymous-sharing-finish-symbol" aria-hidden="true">♡</div>
              <h1>우리의 이야기를<br />모두 나눴어요</h1>
              {roomState.role === 'HOST' ? <PrimaryButton disabled={busy} onClick={completeRoom}>모임 종료하기</PrimaryButton> : null}
            </>
          ) : (
            <>
              <p className="eyebrow">{sharing.state === 'ANONYMOUS' ? '누구의 이야기일까요?' : '이 이야기의 주인공'}</p>
              <h1 ref={storyTop} tabIndex={-1} aria-live="polite">{sharing.state === 'REVEALED' ? `${sharing.participantName}님의 이야기예요` : '천천히 읽고 생각해봐요'}</h1>
              {sharing.state === 'ANONYMOUS' ? <aside className="anonymous-sharing-secret">
                <strong>쉿, 내 이야기여도 아직 비밀이에요</strong>
                <p>누구의 이야기인지 함께 맞혀봐요. 충분히 이야기한 뒤 아래 버튼으로 이름을 공개해주세요.</p>
              </aside> : <p className="anonymous-sharing-conversation" role="status">이름이 공개됐어요. 이야기의 주인공을 만나보세요.</p>}
              <div className="anonymous-sharing-answer-list">
                {sharing.answers.map((answer) => (
                  <article key={answer.question}>
                    <span>{answer.question}</span>
                    <p>{answer.answer}</p>
                  </article>
                ))}
              </div>
              {sharing.state === 'ANONYMOUS' ? (
                <div className="anonymous-sharing-reveal">
                  {!revealConfirming ? (
                    <button type="button" disabled={busy} onClick={() => setRevealConfirming(true)}>이거 저예요</button>
                  ) : (
                    <div className="anonymous-sharing-reveal-confirm" role="alert">
                      {sharing.canReveal ? <>
                      <strong>정말 내 이야기인가요?</strong>
                      <p>공개하면 이 모임의 모든 사람에게 내 이름이 보여요.</p>
                      <div>
                        <button type="button" disabled={busy} onClick={() => setRevealConfirming(false)}>아니요</button>
                        <PrimaryButton disabled={busy} onClick={reveal}>네, 제 이름을 공개할게요</PrimaryButton>
                      </div>
                      </> : <>
                        <strong>이번 이야기는 다른 분의 이야기예요</strong>
                        <p>작성자만 이름을 공개할 수 있어요. 함께 조금 더 맞혀볼까요?</p>
                        <button type="button" onClick={() => setRevealConfirming(false)}>이야기로 돌아가기</button>
                      </>}
                    </div>
                  )}
                </div>
              ) : null}
              {roomState.role === 'HOST' && sharing.state === 'REVEALED' ? (
                <PrimaryButton disabled={busy} onClick={nextStory}>
                  {sharing.sequence === sharing.total - 1 ? '나눔 끝내기' : '다음 이야기'}
                </PrimaryButton>
              ) : null}
              {sharing.state === 'ANONYMOUS' ? (
                <p className="anonymous-sharing-help">작성자가 준비되면 직접 자신을 공개해요.</p>
              ) : null}
              {sharing.state === 'REVEALED' ? (
                <p className="anonymous-sharing-conversation">이제 화면을 내려두고, 왜 이렇게 답했는지 천천히 들어보세요.</p>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {roomState.status === 'COMPLETED' ? (
        <section className="anonymous-sharing-completed">
          <div className="anonymous-sharing-completed-symbol" aria-hidden="true">♡</div>
          <p className="eyebrow">모임 종료</p>
          <h1>함께 나눈 이야기는<br />모두 지웠어요</h1>
          <div className="anonymous-sharing-completed-actions">
            <PrimaryButton onClick={startNewRoom}>새 모임 만들기</PrimaryButton>
            <button className="anonymous-sharing-home-link" type="button" onClick={handleBackHome}>홈으로 돌아가기</button>
          </div>
        </section>
      ) : null}

      {error ? <p className="anonymous-sharing-error" role="alert">{error}</p> : null}
    </ScreenLayout>
  );
}
