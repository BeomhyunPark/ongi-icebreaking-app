import {
  useRef,
  useState,
  type KeyboardEvent,
  type UIEvent,
} from 'react';

import { PrimaryButton } from '../../../components/PrimaryButton';
import { ScreenLayout } from '../../../components/ScreenLayout';
import { StartSoulOrb } from '../../../components/StartSoulOrb';

type IntroScreenProps = {
  onStart: () => void;
  onBackHome: () => void;
  savedAnswerCount: number;
  savedQuestionNumber: number | null;
  onResume: () => void;
  onClearSaved: () => void;
};

const INTRO_MESSAGES = [
  [
    '사람은 살아가며',
    '다양한 경험을 마음에 품게 됩니다.'
  ],
  [
    '같은 상황을 경험해도',
    '사람마다 생각하고 행동하는 방식은 다릅니다.'],
  [
    '우리 마음의 이런 모습을 닮은 친구를',
    '‘흔적이’라고 불러요.',
  ],
  [
    '지금 내 마음에는',
    '어떤 흔적이가 함께하고 있을까요?'
  ]
] as const;

export function IntroScreen({
  onStart,
  onBackHome,
  savedAnswerCount,
  savedQuestionNumber,
  onResume,
  onClearSaved,
}: IntroScreenProps) {
  const messageTrackRef = useRef<HTMLDivElement>(null);
  const [activeMessageIndex, setActiveMessageIndex] = useState(0);
  const [hasReadAllMessages, setHasReadAllMessages] = useState(false);
  const [hasInteractedWithMessages, setHasInteractedWithMessages] = useState(false);
  const lastMessageIndex = INTRO_MESSAGES.length - 1;
  const isLastMessage = activeMessageIndex === lastMessageIndex;

  const selectMessage = (messageIndex: number) => {
    setActiveMessageIndex(messageIndex);
    setHasInteractedWithMessages(true);

    if (messageIndex === lastMessageIndex) {
      setHasReadAllMessages(true);
    }
  };

  const handleMessageScroll = (event: UIEvent<HTMLDivElement>) => {
    const track = event.currentTarget;
    const maxScrollLeft = track.scrollWidth - track.clientWidth;

    if (maxScrollLeft <= 0) {
      return;
    }

    const messageIndex = Math.min(
      lastMessageIndex,
      Math.round((track.scrollLeft / maxScrollLeft) * lastMessageIndex),
    );

    setActiveMessageIndex(messageIndex);

    if (track.scrollLeft > 2) {
      setHasInteractedWithMessages(true);
    }

    if (track.scrollLeft >= maxScrollLeft - 8) {
      setHasReadAllMessages(true);
    }
  };

  const moveToMessage = (messageIndex: number) => {
    selectMessage(messageIndex);

    const track = messageTrackRef.current;
    const maxScrollLeft = track ? track.scrollWidth - track.clientWidth : 0;

    track?.scrollTo?.({
      left: lastMessageIndex === 0
        ? 0
        : (maxScrollLeft / lastMessageIndex) * messageIndex,
      behavior: 'smooth',
    });
  };

  const handleMessageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let nextMessageIndex = activeMessageIndex;

    if (event.key === 'ArrowRight') {
      nextMessageIndex = Math.min(activeMessageIndex + 1, lastMessageIndex);
    } else if (event.key === 'ArrowLeft') {
      nextMessageIndex = Math.max(activeMessageIndex - 1, 0);
    } else if (event.key === 'End') {
      nextMessageIndex = lastMessageIndex;
    } else if (event.key === 'Home') {
      nextMessageIndex = 0;
    } else {
      return;
    }

    event.preventDefault();
    moveToMessage(nextMessageIndex);
  };

  return (
    <ScreenLayout className="intro-screen">
      <button className="test-home-button" type="button" onClick={onBackHome}>
        <span aria-hidden="true">←</span> 홈
      </button>
      <header className="intro-screen__header">
        <p className="eyebrow">온기 · 성격검사</p>
        <h1 aria-label="마음속 흔적 찾기">마음속<br />흔적 찾기</h1>
        <p className="intro-screen__subtitle">나와 닮은 흔적이는 누구일까?</p>
      </header>

      {savedQuestionNumber !== null ? (
        <section className="intro-resume" aria-labelledby="heart-trace-resume-title">
          <div>
            <span>진행 중인 검사</span>
            <h2 id="heart-trace-resume-title">{savedQuestionNumber}번 문항부터 이어서</h2>
            <p>{savedAnswerCount}개 응답 저장됨</p>
          </div>
          <div className="intro-resume__actions">
            <PrimaryButton onClick={onResume}>이어하기</PrimaryButton>
            <button type="button" onClick={onClearSaved}>저장된 응답 지우기</button>
          </div>
        </section>
      ) : null}

      <section
        className={`intro-screen__message${isLastMessage ? ' is-last' : ''}${hasInteractedWithMessages ? '' : ' is-pristine'}`}
        aria-label="흔적이 소개"
      >
        <div
          ref={messageTrackRef}
          className="intro-screen__message-track"
          role="region"
          aria-roledescription="carousel"
          aria-label="흔적이 소개 글"
          tabIndex={0}
          onScroll={handleMessageScroll}
          onKeyDown={handleMessageKeyDown}
          onPointerDown={() => setHasInteractedWithMessages(true)}
        >
          {INTRO_MESSAGES.map((paragraphs, messageIndex) => (
            <div
              className="intro-screen__message-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`${messageIndex + 1} / ${INTRO_MESSAGES.length}`}
              key={paragraphs[0]}
            >
              {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          ))}
        </div>

        <div className="intro-screen__message-nav" aria-hidden="true">
          <span>
            {INTRO_MESSAGES.map((paragraphs, messageIndex) => (
              <i
                className={messageIndex === activeMessageIndex ? 'is-active' : undefined}
                key={paragraphs[0]}
              />
            ))}
          </span>
        </div>
      </section>

      <div className="intro-screen__visual" aria-hidden="true">
        <StartSoulOrb />
      </div>

      <div className="intro-screen__button-slot" aria-live="polite">
        <PrimaryButton className="intro-screen__button" onClick={onStart}>바로 시작하기</PrimaryButton>
        {!hasReadAllMessages ? (
          <button
            type="button"
            className="intro-more-button"
            onClick={() => moveToMessage(Math.min(activeMessageIndex + 1, lastMessageIndex))}
          >
            소개 더 읽기
          </button>
        ) : null}
      </div>
      <p className="intro-screen__meta">약 4분 · 20문항 · 5유형</p>
      <p className="intro-screen__credit">창작자 · 최유민 · 박은성 · hyunee</p>
    </ScreenLayout>
  );
}
