import type {
  EngagementContentCode,
  EngagementEventType,
  LikeResponse,
  ParticipationResponse,
  ShareTarget,
  VisitorStatisticsResponse,
} from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim()
  || (import.meta.env.DEV ? 'http://localhost:8080' : 'https://ongi-api.greengroove.app'))
  .replace(/\/$/, '');

type ProblemDetail = {
  code?: string;
  detail?: string;
};

export class EngagementApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'EngagementApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const headers = new Headers(init.headers);

  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('X-OnGi-Client', 'web');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, method, headers });
  } catch {
    throw new EngagementApiError(0, 'NETWORK_ERROR', '참여 정보를 기록할 서버에 연결하지 못했어요.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => ({})) as ProblemDetail;
    throw new EngagementApiError(
      response.status,
      problem.code ?? 'REQUEST_FAILED',
      problem.detail ?? '참여 정보를 처리하지 못했어요.',
    );
  }

  return response.json() as Promise<T>;
}

export const engagementApi = {
  getVisitorStatistics: () => request<VisitorStatisticsResponse>('/api/engagement/statistics'),

  ensureVisitor: (visitorKey: string) => request(`/api/engagement/visitors/${visitorKey}`, {
    method: 'PUT',
  }),

  ensureVisit: (visitKey: string, visitorKey: string, shareCode?: string) => request(
    `/api/engagement/visits/${visitKey}`,
    {
      method: 'PUT',
      body: JSON.stringify({ visitorKey, shareCode }),
    },
  ),

  startParticipation: (
    visitKey: string,
    contentCode: EngagementContentCode,
    requestKey: string,
  ) => request<ParticipationResponse>('/api/engagement/participations', {
    method: 'POST',
    body: JSON.stringify({ visitKey, contentCode, requestKey }),
  }),

  completeParticipation: (
    participationId: number,
    visitKey: string,
    resultCode?: string,
  ) => request<ParticipationResponse>(
    `/api/engagement/participations/${participationId}/completion`,
    {
      method: 'PUT',
      body: JSON.stringify({ visitKey, resultCode }),
    },
  ),

  getLike: (contentCode: EngagementContentCode, variantCode: string, visitorKey: string) => request<LikeResponse>(
    `/api/engagement/contents/${contentCode}/like?visitorKey=${encodeURIComponent(visitorKey)}&variant=${encodeURIComponent(variantCode)}`,
    { cache: 'no-store' },
  ),

  setLike: (
    contentCode: EngagementContentCode,
    variantCode: string,
    visitorKey: string,
    liked: boolean,
  ) => (
    liked
      ? request<LikeResponse>(`/api/engagement/contents/${contentCode}/like`, {
          method: 'PUT',
          body: JSON.stringify({ visitorKey, variantCode }),
        })
      : request<LikeResponse>(
          `/api/engagement/contents/${contentCode}/like?visitorKey=${encodeURIComponent(visitorKey)}&variant=${encodeURIComponent(variantCode)}`,
          { method: 'DELETE' },
        )
  ),

  recordEvent: (input: {
    eventKey: string;
    visitKey: string;
    contentCode?: EngagementContentCode;
    eventType: EngagementEventType;
    data?: { target: ShareTarget };
  }) => request<{ recorded: boolean }>('/api/engagement/events', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
};
