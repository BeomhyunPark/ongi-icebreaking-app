import type { CurrentSharing, RoomState, RoomSnapshot } from '../domain/types';

type RoomAccess =
  | { roomId: string | null; roomState: null }
  | { roomId: string; roomState: RoomState };
export type SharingSession = RoomAccess &
  Omit<RoomSnapshot, 'roomState'> & { questionIndex: number };
export type SharingSessionAction =
  | { type: 'OPEN_ROOM'; roomId: string }
  | { type: 'HYDRATE'; snapshot: RoomSnapshot; drafts: Record<string, string> }
  | { type: 'EDIT_ANSWER'; questionId: string; value: string }
  | { type: 'MOVE_QUESTION'; direction: -1 | 1 }
  | { type: 'RESTART_QUESTIONS' }
  | { type: 'UPDATE_SHARING'; sharing: CurrentSharing }
  | { type: 'RESET' };

export function createSharingSession(roomId: string | null = null): SharingSession {
  return {
    roomId,
    roomState: null,
    participants: [],
    questions: [],
    answers: {},
    sharing: null,
    questionIndex: 0,
  };
}

export function sharingSessionReducer(
  state: SharingSession,
  action: SharingSessionAction,
): SharingSession {
  switch (action.type) {
    case 'OPEN_ROOM':
      return createSharingSession(action.roomId);
    case 'HYDRATE': {
      const { snapshot, drafts } = action;
      const sameRoom = state.roomId === snapshot.roomState.roomId;
      const index = sameRoom ? state.questionIndex : 0;
      const firstUnanswered = snapshot.questions.findIndex(
        (question) => !snapshot.answers[question.id],
      );
      return {
        ...snapshot,
        roomId: snapshot.roomState.roomId,
        answers: { ...snapshot.answers, ...drafts },
        questionIndex: index >= snapshot.questions.length ? Math.max(0, firstUnanswered) : index,
      };
    }
    case 'EDIT_ANSWER':
      if (!state.questions.some((question) => question.id === action.questionId)) return state;
      return { ...state, answers: { ...state.answers, [action.questionId]: action.value } };
    case 'MOVE_QUESTION':
      return {
        ...state,
        questionIndex: Math.max(
          0,
          Math.min(state.questions.length - 1, state.questionIndex + action.direction),
        ),
      };
    case 'RESTART_QUESTIONS':
      return { ...state, questionIndex: 0 };
    case 'UPDATE_SHARING':
      return state.roomState ? { ...state, sharing: action.sharing } : state;
    case 'RESET':
      return createSharingSession();
  }
}
