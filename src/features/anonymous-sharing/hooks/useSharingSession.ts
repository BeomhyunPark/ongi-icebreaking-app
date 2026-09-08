import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { SharingApiError, sharingApi } from '../api/sharingApi';
import type { CurrentSharing } from '../domain/types';
import { readDraft, storeDraft, removeDraft } from '../services/draftStorage';
import {
  clearRoomReference,
  replaceSharingHash,
  saveRoomReference,
} from '../services/roomReference';
import { loadRoomSnapshot } from '../services/roomSnapshot';
import { createSharingSession, sharingSessionReducer } from '../state/sharingSessionReducer';

export function useSharingSession(
  initialRoomId: string | null,
  busy: boolean,
  setError: (message: string) => void,
) {
  const [session, dispatch] = useReducer(
    sharingSessionReducer,
    initialRoomId,
    createSharingSession,
  );
  const [loading, setLoading] = useState(initialRoomId !== null);
  const draft = useRef<Record<string, string>>({});
  const draftRoom = useRef(initialRoomId);
  const requestRevision = useRef(0);
  const lifecycle = useRef(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  const invalidate = useCallback(() => {
    requestRevision.current += 1;
    lifecycle.current += 1;
  }, []);

  const hydrateRoom = useCallback(
    async (roomId: string) => {
      const revision = ++requestRevision.current;
      try {
        const snapshot = await loadRoomSnapshot(roomId);
        if (revision !== requestRevision.current) return;
        const room = snapshot.roomState;
        if (room.responseCompleted || room.status === 'SHARING' || room.status === 'COMPLETED') {
          removeDraft(roomId);
          draft.current = {};
        } else {
          draft.current = {
            ...readDraft(roomId),
            ...(draftRoom.current === roomId ? draft.current : {}),
          };
        }
        draftRoom.current = roomId;
        dispatch({ type: 'HYDRATE', snapshot, drafts: draft.current });
        saveRoomReference(roomId);
        replaceSharingHash('room', roomId);
        setError('');
      } catch (error) {
        if (revision !== requestRevision.current) return;
        if (error instanceof SharingApiError && error.status === 401) {
          removeDraft(roomId);
          draft.current = {};
          clearRoomReference();
          replaceSharingHash(null);
          dispatch({ type: 'RESET' });
        }
        setError(error instanceof SharingApiError ? error.message : '요청을 처리하지 못했어요.');
      } finally {
        if (revision === requestRevision.current) setLoading(false);
      }
    },
    [setError],
  );

  useEffect(() => {
    if (initialRoomId) void hydrateRoom(initialRoomId);
    return invalidate;
  }, [initialRoomId, hydrateRoom, invalidate]);

  const persistAnswers = useCallback((roomId: string, values: Record<string, string>) => {
    const generation = lifecycle.current;
    const task = saveQueue.current
      .catch(() => undefined)
      .then(() => {
        if (generation !== lifecycle.current) return;
        return sharingApi.saveResponses(
          roomId,
          Object.entries(values).map(([questionId, answer]) => ({ questionId, answer })),
        );
      });
    saveQueue.current = task;
    return task;
  }, []);

  const { roomId, roomState, answers, questions, questionIndex } = session;
  useEffect(() => {
    if (
      busy ||
      !roomId ||
      !roomState ||
      roomState.responseCompleted ||
      !['WRITING', 'LOCKED'].includes(roomState.status) ||
      !Object.keys(draft.current).length
    )
      return;
    const snapshot = { ...draft.current };
    const timer = window.setTimeout(() => {
      void persistAnswers(roomId, snapshot).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [answers, busy, roomId, roomState?.status, roomState?.responseCompleted, persistAnswers]);

  return {
    ...session,
    loading,
    hydrateRoom,
    invalidate,
    captureSession: () => {
      const generation = lifecycle.current;
      return () => generation === lifecycle.current;
    },
    openRoom: async (nextRoomId: string) => {
      saveRoomReference(nextRoomId);
      replaceSharingHash('room', nextRoomId);
      dispatch({ type: 'OPEN_ROOM', roomId: nextRoomId });
      await hydrateRoom(nextRoomId);
    },
    setSharing: (sharing: CurrentSharing) => dispatch({ type: 'UPDATE_SHARING', sharing }),
    moveQuestionIndex: (direction: -1 | 1) => dispatch({ type: 'MOVE_QUESTION', direction }),
    restartQuestions: () => dispatch({ type: 'RESTART_QUESTIONS' }),
    editAnswer: (questionId: string, value: string) => {
      if (!roomId || !roomState) return;
      draft.current = { ...draft.current, [questionId]: value };
      storeDraft(roomId, draft.current, roomState.expiresAt);
      dispatch({ type: 'EDIT_ANSWER', questionId, value });
    },
    saveCurrentAnswer: async () => {
      const question = questions[questionIndex];
      if (roomId && question)
        await persistAnswers(roomId, {
          ...draft.current,
          [question.id]: answers[question.id] ?? '',
        });
    },
    resetSession: () => {
      invalidate();
      if (roomId) removeDraft(roomId);
      draft.current = {};
      draftRoom.current = null;
      clearRoomReference();
      replaceSharingHash(null);
      dispatch({ type: 'RESET' });
      setLoading(false);
    },
  };
}
