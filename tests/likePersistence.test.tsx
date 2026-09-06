// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ActivityShareButton } from '../src/components/ActivityShareButton';
import type { LikeResponse } from '../src/engagement/types';
import { getCachedContentLike, getContentLike, setContentLike } from '../src/engagement/tracker';
vi.mock('../src/engagement/tracker', () => ({
  getCachedContentLike: vi.fn(), getContentLike: vi.fn(), setContentLike: vi.fn(), recordShareClick: vi.fn(),
}));
const initial = { variantCode: 'default', liked: false, likeCount: 4 };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getCachedContentLike).mockReturnValue(initial); });
afterEach(cleanup);
it('다음 방문의 서버 상태가 확인되기 전에는 오래된 캐시로 취소 요청을 보내지 않는다', async () => {
  vi.mocked(getCachedContentLike).mockReturnValue({ ...initial, liked: true });
  const lookup = deferred<LikeResponse>();
  vi.mocked(getContentLike).mockReturnValue(lookup.promise);
  render(<ActivityShareButton target={{ id: 'anonymous-sharing' }} />);
  const loading = screen.getByRole('button', { name: '좋아요 정보 불러오는 중' });
  fireEvent.click(loading);
  expect((loading as HTMLButtonElement).disabled).toBe(true);
  expect(setContentLike).not.toHaveBeenCalled();
  await act(async () => lookup.resolve(initial));
  const saving = deferred<LikeResponse>();
  vi.mocked(setContentLike).mockReturnValue(saving.promise);
  fireEvent.click(screen.getByRole('button', { name: '좋아요 추가 · 현재 4개' }));
  fireEvent.click(screen.getByRole('button', { name: '좋아요 취소 · 현재 5개' }));
  expect(setContentLike).toHaveBeenCalledExactlyOnceWith('anonymous-sharing', 'default', true);
  await act(async () => saving.resolve({ ...initial, liked: true, likeCount: 5 }));
  expect(screen.queryByText('좋아요를 저장했어요. 다음에 방문해도 유지돼요.')).toBeNull();
});
it('조회 실패를 표시하고 다시 조회해 서버 누적 수를 복원한다', async () => {
  vi.mocked(getContentLike).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...initial, liked: true, likeCount: 9 });
  render(<ActivityShareButton target={{ id: 'anonymous-sharing' }} />);
  fireEvent.click(await screen.findByRole('button', { name: '좋아요 다시 불러오기' }));
  expect(await screen.findByRole('button', { name: '좋아요 취소 · 현재 9개' })).toBeTruthy();
  expect(setContentLike).not.toHaveBeenCalled();
});
it('저장 실패는 성공으로 표시하지 않고 기존 상태로 돌린다', async () => {
  vi.mocked(getContentLike).mockResolvedValue(initial);
  vi.mocked(setContentLike).mockRejectedValue(new Error('offline'));
  render(<ActivityShareButton target={{ id: 'anonymous-sharing' }} />);
  fireEvent.click(await screen.findByRole('button', { name: '좋아요 추가 · 현재 4개' }));
  expect(screen.queryByText('좋아요를 반영하지 못했어요. 잠시 후 다시 시도해주세요.')).toBeNull();
  expect(await screen.findByRole('button', { name: '좋아요 추가 · 현재 4개' })).toBeTruthy();
  expect(screen.queryByText('좋아요를 저장했어요. 다음에 방문해도 유지돼요.')).toBeNull();
});

it('열어 둔 화면에 돌아오면 다른 사람이 누른 좋아요까지 최신 누적으로 갱신한다', async () => {
  vi.mocked(getContentLike).mockResolvedValueOnce(initial)
    .mockResolvedValueOnce({ ...initial, likeCount: 6 });
  render(<ActivityShareButton target={{ id: 'anonymous-sharing' }} />);
  await screen.findByRole('button', { name: '좋아요 추가 · 현재 4개' });
  fireEvent.focus(window);
  expect(await screen.findByRole('button', { name: '좋아요 추가 · 현재 6개' })).toBeTruthy();
  expect(setContentLike).not.toHaveBeenCalled();
});
