// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sharingApi } from '../src/features/anonymous-sharing/api/sharingApi';
import { useSharingSession } from '../src/features/anonymous-sharing/hooks/useSharingSession';
import { selectSharingScreen } from '../src/features/anonymous-sharing/domain/selectSharingScreen';
import type { RoomState } from '../src/features/anonymous-sharing/domain/types';

const room: RoomState = {
  roomId: '11111111-1111-4111-8111-111111111111',
  title: '모임',
  status: 'COMPLETED',
  role: 'HOST',
  version: 2,
  participantCount: 3,
  completedParticipantCount: 3,
  participantJoined: true,
  responseCompleted: true,
  currentRound: 3,
  totalRounds: 3,
  expiresAt: '2099-01-01T00:00:00Z',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('익명 나눔 세션 수명', () => {
  it('나중 요청이 먼저 끝나도 이전 응답이 최신 상태를 덮어쓰지 않는다', async () => {
    let resolveOld!: (value: RoomState) => void;
    vi.spyOn(sharingApi, 'getState')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue(room);
    const setError = vi.fn();
    const { result } = renderHook(() => useSharingSession(null, false, setError));
    let oldRequest!: Promise<void>;
    act(() => {
      oldRequest = result.current.hydrateRoom(room.roomId);
    });
    await act(() => result.current.hydrateRoom(room.roomId));
    await act(async () => {
      resolveOld({ ...room, title: '이전 상태', version: 1 });
      await oldRequest;
    });
    expect(result.current.roomState?.title).toBe('모임');
  });

  it('세션 초기화 뒤 도착한 응답은 방과 URL을 복원하지 않는다', async () => {
    let resolveRequest!: (value: RoomState) => void;
    vi.spyOn(sharingApi, 'getState').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const setError = vi.fn();
    const { result } = renderHook(() => useSharingSession(null, false, setError));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.hydrateRoom(room.roomId);
    });
    act(() => result.current.resetSession());
    await act(async () => {
      resolveRequest(room);
      await pending;
    });
    expect(result.current.roomState).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('언마운트 뒤 도착한 응답은 저장소나 URL을 변경하지 않는다', async () => {
    let resolveRequest!: (value: RoomState) => void;
    vi.spyOn(sharingApi, 'getState').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const setError = vi.fn();
    const { unmount } = renderHook(() => useSharingSession(room.roomId, false, setError));
    unmount();
    await act(async () => resolveRequest(room));
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(localStorage.length).toBe(0);
  });

  it('역할과 진행 상태로 표시할 화면을 한곳에서 결정한다', () => {
    expect(selectSharingScreen(room, false)).toBe('completed');
    expect(selectSharingScreen({ ...room, status: 'SHARING' }, true)).toBe('story');
    expect(
      selectSharingScreen({ ...room, status: 'WRITING', responseCompleted: false }, false),
    ).toBe('host-lobby');
    expect(
      selectSharingScreen({ ...room, status: 'WRITING', responseCompleted: false }, true),
    ).toBe('writing');
    expect(selectSharingScreen({ ...room, status: 'LOCKED', role: 'PARTICIPANT' }, false)).toBe(
      'waiting',
    );
  });
});
