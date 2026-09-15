import type {
  CreatedGureumiAttempt,
  GureumiAttemptState,
  GureumiChoice,
  GureumiQuestionsResponse,
  GureumiResult,
} from '../domain/types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim()
  || (import.meta.env.DEV ? 'http://localhost:8080' : 'https://ongi-api.greengroove.app'))
  .replace(/\/$/, '');

type ProblemDetail = {
  code?: string;
  detail?: string;
};

export class GureumiApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'GureumiApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  resumeToken?: string,
  init: RequestInit = {},
): Promise<T> {
  const method = init.method ?? 'GET';
  const headers = new Headers(init.headers);

  if (init.body) headers.set('Content-Type', 'application/json');
  if (resumeToken) headers.set('X-Gureumi-Resume-Token', resumeToken);
  if (method !== 'GET' && method !== 'HEAD') headers.set('X-OnGi-Client', 'web');

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, method, headers });
  } catch {
    throw new GureumiApiError(0, 'NETWORK_ERROR', '구르미 서버에 연결하지 못했어요. 네트워크를 확인해주세요.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => ({})) as ProblemDetail;
    throw new GureumiApiError(
      response.status,
      problem.code ?? 'REQUEST_FAILED',
      problem.detail ?? '요청을 처리하지 못했어요.',
    );
  }

  return response.json() as Promise<T>;
}

export const gureumiApi = {
  createAttempt: (previousResumeToken?: string) => request<CreatedGureumiAttempt>(
    '/api/gureumi/attempts',
    previousResumeToken,
    { method: 'POST' },
  ),

  getCurrent: (resumeToken: string) => request<GureumiAttemptState>(
    '/api/gureumi/attempts/current',
    resumeToken,
  ),

  getQuestions: (attemptId: string, resumeToken: string) => request<GureumiQuestionsResponse>(
    `/api/gureumi/attempts/${attemptId}/questions`,
    resumeToken,
  ),

  saveAnswer: (
    attemptId: string,
    resumeToken: string,
    answer: { questionId: string; choice: GureumiChoice; responseMs: number },
  ) => request<GureumiAttemptState>(
    `/api/gureumi/attempts/${attemptId}/answers`,
    resumeToken,
    { method: 'PUT', body: JSON.stringify(answer) },
  ),

  complete: (attemptId: string, resumeToken: string) => request<{
    attemptId: string;
    completed: true;
    resultType: string;
    characterKey: string;
  }>(`/api/gureumi/attempts/${attemptId}/complete`, resumeToken, { method: 'POST' }),

  getResult: (attemptId: string, resumeToken: string) => request<GureumiResult>(
    `/api/gureumi/attempts/${attemptId}/result`,
    resumeToken,
  ),

};
