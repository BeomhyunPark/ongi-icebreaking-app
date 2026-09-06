import type {
  GureumiStatistics,
  GureumiStatisticsFilters,
  ServiceDashboard,
} from '../domain/types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim()
  || (import.meta.env.DEV ? 'http://localhost:8080' : 'https://ongi-api.greengroove.app'))
  .replace(/\/$/, '');

type ProblemDetail = {
  code?: string;
  detail?: string;
};

export class GureumiStatisticsApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'GureumiStatisticsApiError';
    this.status = status;
    this.code = code;
  }
}

export async function getGureumiStatistics(
  filters: GureumiStatisticsFilters,
  adminKey: string,
): Promise<GureumiStatistics> {
  const query = new URLSearchParams({
    completedAnswersOnly: String(filters.completedAnswersOnly),
    firstAttemptOnly: String(filters.firstAttemptOnly),
  });
  if (filters.version) query.set('version', filters.version);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/gureumi/internal/statistics?${query}`, {
      cache: 'no-store',
      headers: { 'X-OnGi-Admin-Key': adminKey },
    });
  } catch {
    throw new GureumiStatisticsApiError(
      0,
      'NETWORK_ERROR',
      '통계 서버에 연결하지 못했습니다. 네트워크와 API 주소를 확인해주세요.',
    );
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => ({})) as ProblemDetail;
    throw new GureumiStatisticsApiError(
      response.status,
      problem.code ?? 'REQUEST_FAILED',
      problem.detail ?? '통계를 불러오지 못했습니다.',
    );
  }
  return response.json() as Promise<GureumiStatistics>;
}

export async function getServiceDashboard(days: number, adminKey: string): Promise<ServiceDashboard> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/engagement/internal/dashboard?days=${days}`, {
      cache: 'no-store',
      headers: { 'X-OnGi-Admin-Key': adminKey },
    });
  } catch {
    throw new GureumiStatisticsApiError(
      0,
      'NETWORK_ERROR',
      '통계 서버에 연결하지 못했습니다. 네트워크와 API 주소를 확인해주세요.',
    );
  }
  if (!response.ok) {
    const problem = await response.json().catch(() => ({})) as ProblemDetail;
    throw new GureumiStatisticsApiError(
      response.status,
      problem.code ?? 'REQUEST_FAILED',
      problem.detail ?? '운영 현황을 불러오지 못했습니다.',
    );
  }
  return response.json() as Promise<ServiceDashboard>;
}
