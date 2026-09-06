// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ getLike: vi.fn(), setLike: vi.fn(), ensureVisit: vi.fn(), ensureVisitor: vi.fn() }));
vi.mock('../src/engagement/engagementApi', () => ({ engagementApi: api }));
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  vi.stubEnv('MODE', 'production');
  localStorage.clear(); sessionStorage.clear();
  api.ensureVisit.mockRejectedValue(new Error('statistics unavailable'));
  api.ensureVisitor.mockRejectedValue(new Error('statistics unavailable'));
});
afterEach(() => vi.unstubAllEnvs());
it('방문 통계 등록 없이 저장하고 새 방문에도 같은 방문자 키로 누적 상태를 조회한다', async () => {
  const expected = { variantCode: 'default', liked: true, likeCount: 7 };
  api.setLike.mockResolvedValue(expected); api.getLike.mockResolvedValue(expected);
  const tracker = await import('../src/engagement/tracker');
  await expect(tracker.setContentLike('anonymous-sharing', 'default', true)).resolves.toEqual(expected);
  const visitor = api.setLike.mock.calls[0][2];
  sessionStorage.clear();
  vi.resetModules();
  const nextVisit = await import('../src/engagement/tracker');
  await expect(nextVisit.getContentLike('anonymous-sharing', 'default')).resolves.toEqual(expected);
  expect(api.getLike).toHaveBeenCalledWith('anonymous-sharing', 'default', visitor);
  expect(api.ensureVisitor).not.toHaveBeenCalled();
  expect(api.ensureVisit).not.toHaveBeenCalled();
  expect(nextVisit.getCachedContentLike('anonymous-sharing', 'default')).toEqual(expected);
});
