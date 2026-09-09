import { PrimaryButton } from '../../../components/PrimaryButton';
import type { AnonymousSharingController } from '../hooks/useAnonymousSharingController';
import type { RoomState, CurrentSharing } from '../domain/types';
import { useEffect, useRef, useState } from 'react';

export function SharingStoryScreen({
  roomState,
  sharing,
  busy,
  reveal,
  nextStory,
  completeRoom,
}: Pick<AnonymousSharingController, 'busy' | 'reveal' | 'nextStory' | 'completeRoom'> & {
  roomState: RoomState;
  sharing: CurrentSharing;
}) {
  const [revealConfirming, setRevealConfirming] = useState(false);
  const storyTop = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (sharing) {
      const screen = storyTop.current?.closest('.anonymous-sharing-screen');
      screen?.scrollTo?.({ top: 0, behavior: 'instant' });
      screen?.scrollIntoView?.({ block: 'start', behavior: 'instant' });
      storyTop.current?.focus({ preventScroll: true });
    }
  }, [sharing?.sequence, sharing?.state]);

  return (
    <section className={`anonymous-sharing-story is-${sharing.state.toLowerCase()}`}>
      {sharing.state !== 'FINISHED' && sharing.sequence !== null ? (
        <div className="anonymous-sharing-round">
          {sharing.sequence + 1} / {sharing.total}번째 이야기
        </div>
      ) : null}
      {sharing.state === 'FINISHED' ? (
        <>
          <div className="anonymous-sharing-finish-symbol" aria-hidden="true">
            ♡
          </div>
          <h1>
            우리의 이야기를
            <br />
            모두 나눴어요
          </h1>
          {roomState.role === 'HOST' ? (
            <PrimaryButton disabled={busy} onClick={completeRoom}>
              모임 종료하기
            </PrimaryButton>
          ) : null}
        </>
      ) : (
        <>
          <p className="eyebrow">
            {sharing.state === 'ANONYMOUS' ? '누구의 이야기일까요?' : '이 이야기의 주인공'}
          </p>
          <h1 ref={storyTop} tabIndex={-1} aria-live="polite">
            {sharing.state === 'REVEALED'
              ? `${sharing.participantName}님의 이야기예요`
              : '천천히 읽고 생각해봐요'}
          </h1>
          {sharing.state === 'ANONYMOUS' ? (
            <aside className="anonymous-sharing-secret">
              <strong>쉿, 내 이야기여도 아직 비밀이에요</strong>
              <p>
                누구의 이야기인지 함께 맞혀봐요. 충분히 이야기한 뒤 아래 버튼으로 이름을
                공개해주세요.
              </p>
            </aside>
          ) : (
            <p className="anonymous-sharing-conversation" role="status">
              이름이 공개됐어요. 이야기의 주인공을 만나보세요.
            </p>
          )}
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
                <button type="button" disabled={busy} onClick={() => setRevealConfirming(true)}>
                  이거 저예요
                </button>
              ) : (
                <div className="anonymous-sharing-reveal-confirm" role="alert">
                  {sharing.canReveal ? (
                    <>
                      <strong>정말 내 이야기인가요?</strong>
                      <p>공개하면 이 모임의 모든 사람에게 내 이름이 보여요.</p>
                      <div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setRevealConfirming(false)}
                        >
                          아니요
                        </button>
                        <PrimaryButton disabled={busy} onClick={reveal}>
                          네, 제 이름을 공개할게요
                        </PrimaryButton>
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>이번 이야기는 다른 분의 이야기예요</strong>
                      <p>작성자만 이름을 공개할 수 있어요. 함께 조금 더 맞혀볼까요?</p>
                      <button type="button" onClick={() => setRevealConfirming(false)}>
                        이야기로 돌아가기
                      </button>
                    </>
                  )}
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
            <p className="anonymous-sharing-conversation">
              이제 화면을 내려두고, 왜 이렇게 답했는지 천천히 들어보세요.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
