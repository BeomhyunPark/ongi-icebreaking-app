import { PrimaryButton } from '../../../components/PrimaryButton';
import type { AnonymousSharingController } from '../hooks/useAnonymousSharingController';
import { useEffect, useRef } from 'react';
import { ScreenLayout } from '../../../components/ScreenLayout';
import { SharingHeader } from '../components/SharingHeader';
import { JoinQrScanner } from '../components/JoinQrScanner';
import { HowToPlay } from '../components/HowToPlay';

export function SharingEntryScreen({
  acceptJoinCode,
  entryMode,
  setEntryMode,
  title,
  setTitle,
  roomCode,
  name,
  setName,
  busy,
  error,
  handleBackHome,
  createRoom,
  joinRoom,
}: Pick<
  AnonymousSharingController,
  | 'acceptJoinCode'
  | 'entryMode'
  | 'setEntryMode'
  | 'title'
  | 'setTitle'
  | 'roomCode'
  | 'name'
  | 'setName'
  | 'busy'
  | 'error'
  | 'handleBackHome'
  | 'createRoom'
  | 'joinRoom'
>) {
  const entryHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (entryMode === 'HOME') return;
    const timer = window.setTimeout(() => {
      entryHeading.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      entryHeading.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [entryMode]);

  return (
    <ScreenLayout className="anonymous-sharing-screen">
      <SharingHeader onBackHome={handleBackHome} />
      {entryMode === 'HOME' ? (
        <>
          <section className="anonymous-sharing-entry">
            <div className="anonymous-sharing-symbol" aria-hidden="true">
              ♡
            </div>
            <p className="eyebrow">온기 · 소그룹 나눔</p>
            <h1>
              누구의 이야기인지
              <br />
              천천히 알아가요
            </h1>
            <p>
              이야기를 먼저 읽고,
              <br /> 누군지 생각해봐요
            </p>
          </section>

          <HowToPlay />
        </>
      ) : null}
      {entryMode === 'HOME' ? (
        <div className="anonymous-sharing-entry-actions">
          <PrimaryButton onClick={() => setEntryMode('JOIN')}>모임 참여하기</PrimaryButton>
          <button type="button" onClick={() => setEntryMode('CREATE')}>진행자로 모임 만들기</button>
        </div>
      ) : null}

      {entryMode === 'CREATE' ? (
        <section className="anonymous-sharing-form" aria-labelledby="create-room-title">
          <h2 ref={entryHeading} id="create-room-title" tabIndex={-1}>
            새 모임 만들기
          </h2>
          <label htmlFor="sharing-room-title">
            모임 이름 <span>선택</span>
          </label>
          <input
            id="sharing-room-title"
            value={title}
            maxLength={120}
            placeholder="예: 임마누엘 중그룹 모임 1"
            onChange={(event) => setTitle(event.target.value)}
          />
          <PrimaryButton disabled={busy} onClick={createRoom}>
            {busy ? '만드는 중…' : '모임 만들기'}
          </PrimaryButton>
          <button type="button" onClick={() => setEntryMode('HOME')}>
            이전으로
          </button>
        </section>
      ) : null}

      {entryMode === 'JOIN' ? (
        <section className="anonymous-sharing-form" aria-labelledby="join-room-title">
          <h2 ref={entryHeading} id="join-room-title" tabIndex={-1}>
            모임 참여하기
          </h2>
          {!roomCode ? (
            <JoinQrScanner onJoinCode={acceptJoinCode} />
          ) : (
            <>
              <label htmlFor="sharing-name">이름</label>
              <input
                id="sharing-name"
                autoFocus
                value={name}
                maxLength={40}
                autoComplete="name"
                placeholder="모임에서 사용할 이름"
                onChange={(event) => setName(event.target.value)}
              />
              <PrimaryButton
                disabled={busy || !name.trim() || !/^[A-Z0-9]{8}$/.test(roomCode.replace(/-/g, ''))}
                onClick={joinRoom}
              >
                {busy ? '입장하는 중…' : '참여하기'}
              </PrimaryButton>
            </>
          )}
          <button type="button" onClick={() => setEntryMode('HOME')}>
            이전으로
          </button>
        </section>
      ) : null}
      {error ? (
        <p className="anonymous-sharing-error" role="alert">
          {error}
        </p>
      ) : null}
    </ScreenLayout>
  );
}
