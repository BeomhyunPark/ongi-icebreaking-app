import type {
  CreatedRoom,
  CurrentSharing,
  JoinedRoom,
  MyResponses,
  ParticipantMe,
  ParticipantStatus,
  Question,
  RoomState,
} from '../domain/types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim()
  || (import.meta.env.DEV ? 'http://localhost:8080' : 'https://ongi-api.greengroove.app'))
  .replace(/\/$/, '');

type ProblemDetail = {
  code?: string;
  detail?: string;
};

export class SharingApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'SharingApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const isMutation = method !== 'GET' && method !== 'HEAD';
  const headers = new Headers(init.headers);

  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (isMutation) {
    headers.set('X-OnGi-Client', 'web');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      method,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new SharingApiError(0, 'NETWORK_ERROR', '서버에 연결하지 못했어요. 네트워크를 확인해주세요.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => ({})) as ProblemDetail;
    throw new SharingApiError(
      response.status,
      problem.code ?? 'REQUEST_FAILED',
      problem.detail ?? '요청을 처리하지 못했어요.',
    );
  }

  return response.json() as Promise<T>;
}

export const sharingApi = {
  createRoom: (title: string) => request<CreatedRoom>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ title }),
  }),

  joinRoom: (roomCode: string, name: string) => request<JoinedRoom>('/api/room-joins', {
    method: 'POST',
    body: JSON.stringify({ roomCode, name }),
  }),

  getState: (roomId: string) => request<RoomState>(`/api/rooms/${roomId}/state`),

  getParticipants: (roomId: string) => request<{ participants: ParticipantStatus[] }>(
    `/api/rooms/${roomId}/participants`,
  ),

  getMe: (roomId: string) => request<ParticipantMe>(`/api/rooms/${roomId}/participants/me`),

  lockRoom: (roomId: string, expectedVersion: number) => request<RoomState>(
    `/api/rooms/${roomId}/lock`,
    { method: 'POST', body: JSON.stringify({ expectedVersion }) },
  ),

  unlockRoom: (roomId: string, expectedVersion: number) => request<RoomState>(
    `/api/rooms/${roomId}/unlock`,
    { method: 'POST', body: JSON.stringify({ expectedVersion }) },
  ),

  cancelRoom: (roomId: string, expectedVersion: number) => request<{ cancelled: true }>(
    `/api/rooms/${roomId}/cancel`,
    { method: 'POST', body: JSON.stringify({ expectedVersion }) },
  ),

  getQuestions: (roomId: string) => request<{ questions: Question[] }>(
    `/api/rooms/${roomId}/questions`,
  ),

  getMyResponses: (roomId: string) => request<MyResponses>(`/api/rooms/${roomId}/responses/me`),

  saveResponses: (roomId: string, answers: Array<{ questionId: string; answer: string }>) => (
    request<MyResponses>(`/api/rooms/${roomId}/responses`, {
      method: 'PUT',
      body: JSON.stringify({ answers }),
    })
  ),

  reopenResponses: (roomId: string) => request<MyResponses>(
    `/api/rooms/${roomId}/responses/reopen`, { method: 'POST' },
  ),

  completeResponses: (roomId: string) => request<MyResponses>(
    `/api/rooms/${roomId}/responses/complete`,
    { method: 'POST' },
  ),

  startSharing: (roomId: string, expectedVersion: number) => request<CurrentSharing>(
    `/api/rooms/${roomId}/start-sharing`,
    { method: 'POST', body: JSON.stringify({ expectedVersion }) },
  ),

  getCurrentSharing: (roomId: string) => request<CurrentSharing>(
    `/api/rooms/${roomId}/sharing/current`,
  ),

  reveal: (roomId: string) => request<CurrentSharing>(`/api/rooms/${roomId}/sharing/reveal`, {
    method: 'POST',
  }),

  next: (roomId: string, expectedVersion: number, expectedRound: number) => request<CurrentSharing>(
    `/api/rooms/${roomId}/next`,
    { method: 'POST', body: JSON.stringify({ expectedVersion, expectedRound }) },
  ),

  completeRoom: (roomId: string, expectedVersion: number) => request<{ status: 'COMPLETED' }>(
    `/api/rooms/${roomId}/complete`,
    { method: 'POST', body: JSON.stringify({ expectedVersion }) },
  ),
};

export function roomEventsUrl(roomId: string): string {
  return `${API_BASE_URL}/api/rooms/${roomId}/events`;
}
