import type { ManittoRoom } from '../domain/types';

const BASE = (import.meta.env.VITE_API_BASE_URL?.trim()
  || (import.meta.env.DEV ? 'http://localhost:8080' : 'https://ongi-api.greengroove.app')).replace(/\/$/, '');
export class ManittoApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    response = await fetch(`${BASE}/api/manitto/rooms${path}`, {
      method, credentials: 'include', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(method === 'GET' ? {} : { 'X-OnGi-Client': 'web' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch { throw new ManittoApiError(0, '연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해주세요.'); }
  finally { clearTimeout(timeout); }
  if (!response.ok) {
    const problem = await response.json().catch(() => ({})) as { detail?: string };
    throw new ManittoApiError(response.status, problem.detail ?? '요청을 처리하지 못했어요. 다시 시도해주세요.');
  }
  return response.json() as Promise<T>;
}
export const manittoApi = {
  create: (title: string, name: string, participating: boolean) => request<ManittoRoom>('', 'POST', { title, name, participating }),
  join: (code: string, name: string) => request<ManittoRoom>(`/${code}/join`, 'POST', { name }),
  state: (code: string) => request<ManittoRoom>(`/${code}`),
  assign: (code: string) => request<ManittoRoom>(`/${code}/assign`, 'POST'),
  mission: (code: string, id: string, content: string) => request<ManittoRoom>(`/${code}/missions`, 'POST', { id, content }),
  complete: (code: string, mission: string, completed: boolean) =>
    request<ManittoRoom>(`/${code}/missions/${mission}/completion`, 'PUT', { completed }),
  close: (code: string) => request<{ closed: true }>(`/${code}`, 'DELETE'),
};
