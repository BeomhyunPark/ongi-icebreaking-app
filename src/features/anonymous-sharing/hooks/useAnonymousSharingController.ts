import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SharingApiError, sharingApi } from '../api/sharingApi';
import {
  clearRoomReference,
  loadRoomReference,
  readSharingHash,
  replaceSharingHash,
} from '../services/roomReference';
import { joinUrl } from '../services/invitation';
import { useRoomEvents } from './useRoomEvents';
import { useSharingSession } from './useSharingSession';
import {
  completeContentParticipation,
  startContentParticipation,
} from '../../../engagement/tracker';

type EntryMode = 'HOME' | 'CREATE' | 'JOIN';
function errorMessage(error: unknown): string {
  return error instanceof SharingApiError ? error.message : '요청을 처리하지 못했어요.';
}

export function useAnonymousSharingController(onBackHome: () => void) {
  const initialHash = useMemo(readSharingHash, []);
  const initialRoomId = useMemo(
    () => initialHash.roomId ?? (initialHash.joinCode ? null : loadRoomReference()),
    [initialHash],
  );
  const [entryMode, setEntryMode] = useState<EntryMode>(initialHash.joinCode ? 'JOIN' : 'HOME');
  const [title, setTitle] = useState('');
  const [roomCode, setRoomCode] = useState(initialHash.joinCode ?? '');
  const acceptJoinCode = useCallback((code: string) => {
    setRoomCode(code);
    replaceSharingHash('join', code);
  }, []);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hostWriting, setHostWriting] = useState(false);
  const [cancelConfirming, setCancelConfirming] = useState(false);
  const session = useSharingSession(initialRoomId, busy, setError);
  const {
    roomId,
    roomState,
    participants,
    questions,
    answers,
    questionIndex,
    sharing,
    loading,
    hydrateRoom,
    setSharing,
    saveCurrentAnswer,
    editAnswer,
  } = session;

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
  const reconnecting = useRoomEvents(
    roomState?.status === 'COMPLETED' ? null : roomId,
    refreshCurrentRoom,
  );

  const actionPending = useRef(false);
  const run = async (action: (isCurrent: () => boolean) => Promise<void>) => {
    if (actionPending.current) return;
    actionPending.current = true;
    const isCurrent = session.captureSession();
    setBusy(true);
    setError('');
    try {
      await action(isCurrent);
      if (!isCurrent()) return;
    } catch (nextError) {
      if (isCurrent()) setError(errorMessage(nextError));
    } finally {
      actionPending.current = false;
      if (isCurrent()) setBusy(false);
    }
  };

  const handleBackHome = () => {
    session.invalidate();
    if (roomState?.status === 'COMPLETED') {
      clearRoomReference();
    }
    replaceSharingHash(null);
    onBackHome();
  };

  const resetRoom = (nextEntryMode: EntryMode) => {
    session.resetSession();
    setTitle('');
    setRoomCode('');
    setName('');
    setError('');
    setHostWriting(false);
    setCancelConfirming(false);
    setEntryMode(nextEntryMode);
    setBusy(false);
  };

  const startNewRoom = () => resetRoom('CREATE');

  const createRoom = () =>
    run(async (isCurrent) => {
      const created = await sharingApi.createRoom(title);
      if (!isCurrent()) return;
      void startContentParticipation('anonymous-sharing');
      setRoomCode(created.roomCode);
      await session.openRoom(created.roomId);
      if (!isCurrent()) return;
    });

  const joinRoom = () =>
    run(async (isCurrent) => {
      const joined = await sharingApi.joinRoom(roomCode, name);
      if (!isCurrent()) return;
      void startContentParticipation('anonymous-sharing');
      await session.openRoom(joined.roomId);
      if (!isCurrent()) return;
    });

  const lockRoom = () =>
    run(async (isCurrent) => {
      if (!roomId || !roomState) return;
      await sharingApi.lockRoom(roomId, roomState.version);
      if (!isCurrent()) return;
      await hydrateRoom(roomId);
      if (!isCurrent()) return;
    });

  const unlockRoom = () =>
    run(async (isCurrent) => {
      if (!roomId || !roomState) return;
      await sharingApi.unlockRoom(roomId, roomState.version);
      if (!isCurrent()) return;
      await hydrateRoom(roomId);
      if (!isCurrent()) return;
    });

  const cancelRoom = () =>
    run(async (isCurrent) => {
      if (!roomId || !roomState) return;
      await sharingApi.cancelRoom(roomId, roomState.version);
      if (!isCurrent()) return;
      resetRoom('HOME');
    });

  const joinAsHostParticipant = () =>
    run(async (isCurrent) => {
      const code = roomState?.roomCode ?? roomCode;
      if (!roomId || !code) return;
      await sharingApi.joinRoom(code, name);
      if (!isCurrent()) return;
      setHostWriting(true);
      await hydrateRoom(roomId);
      if (!isCurrent()) return;
    });

  const startSharing = () =>
    run(async (isCurrent) => {
      if (!roomId || !roomState) return;
      const nextSharing = await sharingApi.startSharing(roomId, roomState.version);
      if (!isCurrent()) return;
      setSharing(nextSharing);
      await hydrateRoom(roomId);
      if (!isCurrent()) return;
    });

  const moveQuestion = (direction: -1 | 1) =>
    run(async (isCurrent) => {
      await saveCurrentAnswer();
      if (!isCurrent()) return;
      session.moveQuestionIndex(direction);
    });

  const finishAnswers = () =>
    run(async (isCurrent) => {
      if (!roomId) return;
      await saveCurrentAnswer();
      if (!isCurrent()) return;
      await sharingApi.completeResponses(roomId);
      if (!isCurrent()) return;
      setHostWriting(false);
      await hydrateRoom(roomId);
      if (!isCurrent()) return;
    });

  const editAnswers = () =>
    run(async (isCurrent) => {
      if (!roomId) return;
      await sharingApi.reopenResponses(roomId);
      if (!isCurrent()) return;
      setHostWriting(true);
      session.restartQuestions();
      await hydrateRoom(roomId);
      if (!isCurrent()) return;
    });

  const returnToHostLobby = () =>
    run(async (isCurrent) => {
      await saveCurrentAnswer();
      if (!isCurrent()) return;
      setHostWriting(false);
    });

  const reveal = () =>
    run(async (isCurrent) => {
      if (!roomId) return;
      const nextSharing = await sharingApi.reveal(roomId);
      if (!isCurrent()) return;
      setSharing(nextSharing);
    });

  const nextStory = () =>
    run(async (isCurrent) => {
      if (!roomId || !sharing || sharing.sequence === null) return;
      const nextSharing = await sharingApi.next(roomId, sharing.roomVersion, sharing.sequence);
      if (!isCurrent()) return;
      setSharing(nextSharing);
      await hydrateRoom(roomId);
      if (!isCurrent()) return;
    });

  const completeRoom = () =>
    run(async (isCurrent) => {
      if (!roomId || !sharing) return;
      await sharingApi.completeRoom(roomId, sharing.roomVersion);
      if (!isCurrent()) return;
      await hydrateRoom(roomId);
      if (!isCurrent()) return;
    });

  const visibleRoomCode = roomState?.roomCode ?? roomCode;
  const shareUrl = visibleRoomCode ? joinUrl(visibleRoomCode) : '';
  const currentQuestion = questions[questionIndex];
  const hasWrittenAnswer = questions.some(({ id }) => Boolean(answers[id]?.trim()));
  const lobbyStep =
    roomState?.status === 'LOCKED'
      ? roomState?.completedParticipantCount === roomState?.participantCount
        ? 3
        : 2
      : roomState?.status === 'WRITING'
        ? 1
        : 0;

  return {
    initialHash,
    acceptJoinCode,
    entryMode,
    setEntryMode,
    roomId,
    roomState,
    participants,
    questions,
    answers,
    questionIndex,
    sharing,
    title,
    setTitle,
    roomCode,
    setRoomCode,
    name,
    setName,
    loading,
    busy,
    error,
    hostWriting,
    setHostWriting,
    cancelConfirming,
    setCancelConfirming,
    reconnecting,
    handleBackHome,
    startNewRoom,
    createRoom,
    joinRoom,
    lockRoom,
    unlockRoom,
    cancelRoom,
    joinAsHostParticipant,
    startSharing,
    moveQuestion,
    finishAnswers,
    editAnswers,
    returnToHostLobby,
    reveal,
    nextStory,
    completeRoom,
    editAnswer,
    visibleRoomCode,
    shareUrl,
    currentQuestion,
    hasWrittenAnswer,
    lobbyStep,
  };
}

export type AnonymousSharingController = ReturnType<typeof useAnonymousSharingController>;
