export type RoomStatus = 'CREATED' | 'WRITING' | 'LOCKED' | 'SHARING' | 'COMPLETED';
export type SessionRole = 'HOST' | 'PARTICIPANT';
export type SharingState = 'ANONYMOUS' | 'REVEALED' | 'FINISHED';

export type RoomState = {
  roomId: string;
  roomCode?: string;
  title: string;
  status: RoomStatus;
  role: SessionRole;
  version: number;
  participantCount: number;
  completedParticipantCount: number;
  participantJoined: boolean;
  responseCompleted: boolean;
  currentRound: number;
  totalRounds: number;
  expiresAt: string;
};

export type CreatedRoom = {
  roomId: string;
  roomCode: string;
  title: string;
  status: RoomStatus;
  version: number;
  expiresAt: string;
};

export type JoinedRoom = {
  roomId: string;
  title: string;
  status: RoomStatus;
  participant: ParticipantMe;
  expiresAt: string;
};

export type ParticipantMe = {
  id: string;
  name: string;
  responseCompleted: boolean;
};

export type ParticipantStatus = {
  name: string;
  responseCompleted: boolean;
  joinedAt: string;
};

export type Question = {
  id: string;
  position: number;
  prompt: string;
  helperText?: string;
};

export type SavedAnswer = {
  questionId: string;
  answer: string;
};

export type MyResponses = {
  answers: SavedAnswer[];
  completed: boolean;
};

export type SharedAnswer = {
  question: string;
  answer: string;
};

export type CurrentSharing = {
  state: SharingState;
  sequence: number | null;
  total: number;
  answers: SharedAnswer[];
  participantName?: string;
  canReveal: boolean;
  roomVersion: number;
};

export type RoomSnapshot = {
  roomState: RoomState;
  participants: ParticipantStatus[];
  questions: Question[];
  answers: Record<string, string>;
  sharing: CurrentSharing | null;
};
