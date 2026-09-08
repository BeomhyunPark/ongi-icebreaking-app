import { sharingApi } from '../api/sharingApi';
import type { RoomSnapshot } from '../domain/types';

export async function loadRoomSnapshot(roomId: string): Promise<RoomSnapshot> {
  const roomState = await sharingApi.getState(roomId);
  const snapshot: RoomSnapshot = {
    roomState,
    participants: [],
    questions: [],
    answers: {},
    sharing: null,
  };
  if (
    roomState.role === 'HOST' &&
    roomState.status !== 'COMPLETED' &&
    roomState.status !== 'SHARING'
  ) {
    snapshot.participants = (await sharingApi.getParticipants(roomId)).participants;
  }
  if (
    roomState.participantJoined &&
    ['WRITING', 'LOCKED'].includes(roomState.status) &&
    !roomState.responseCompleted
  ) {
    const [questions, responses] = await Promise.all([
      sharingApi.getQuestions(roomId),
      sharingApi.getMyResponses(roomId),
    ]);
    snapshot.questions = questions.questions;
    snapshot.answers = Object.fromEntries(
      responses.answers.map((answer) => [answer.questionId, answer.answer]),
    );
  }
  if (roomState.status === 'SHARING') snapshot.sharing = await sharingApi.getCurrentSharing(roomId);
  return snapshot;
}
