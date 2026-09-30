// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ManittoApp } from '../src/features/manitto/ManittoApp';
import type { ManittoRoom } from '../src/features/manitto/domain/types';
import { loadManittoRooms, rememberRoom } from '../src/features/manitto/services/rooms';
import { buildActivityUrl, buildPageUrl } from '../src/app/activityNavigation';

const CODE = 'ABCD2345EFGH';
const state = (extra: Partial<ManittoRoom> = {}): ManittoRoom => ({
  code: CODE, title: '우리 모임', assigned: true, expiresAt: '2099-01-01T00:00:00Z',
  me: { id: 'me', name: '하나', host: false, participating: true, recipient: '둘' },
  participantCount: 3, missions: [{ id: 'mission', content: '인사하기', createdAt: '2026-09-28T00:00:00Z', completed: false }],
  dashboard: [], ...extra,
});
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('마니또', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', `/?activity=manitto&manittoRoom=${CODE}`);
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('초대 링크에서 참가하고 본인 상대와 미션만 확인하며 완료 실패 시 기존 표시를 유지한다', async () => {
    let joined = false;
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') { joined = true; return response(state()); }
      if (init?.method === 'PUT') return response({ detail: '연결이 끊겼어요.' }, 503);
      return joined ? response(state()) : response({ detail: '참가해주세요.' }, 401);
    });
    vi.stubGlobal('fetch', fetch);
    render(<ManittoApp onBackHome={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('내 이름'), { target: { value: '하나' } });
    fireEvent.click(screen.getByRole('button', { name: '참가하기' }));
    expect(await screen.findByText('인사하기')).toBeTruthy();
    expect(screen.queryByText('둘')).toBeNull();
    expect(screen.queryByRole('heading', { name: '미션 현황판' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '내 상대 확인하기' }));
    expect(screen.getByText('둘')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: '완료 표시' }));
    expect(await screen.findByText('연결이 끊겼어요.')).toBeTruthy();
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(loadManittoRooms()[0]?.code).toBe(CODE);
    expect(localStorage.getItem('ongi.manitto.rooms.v1')).not.toContain('recipient');
  });

  it('진행자는 미션을 등록하고 실패한 요청을 같은 ID로 재시도한다', async () => {
    const host = state({ me: { id: 'host', name: '진행자', host: true, participating: false, recipient: null }, missions: [], dashboard: [{ id: 'one', name: '참가자', completedMissionIds: [] }] });
    const attempts: { id: string; content: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        attempts.push(JSON.parse(String(init.body)));
        if (attempts.length === 1) return response({ detail: '다시 시도해주세요.' }, 503);
        return response({ ...host, missions: [{ ...attempts[1], createdAt: '2026-09-28T00:00:00Z', completed: false }] });
      }
      return response(host);
    }));
    render(<ManittoApp onBackHome={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('새 미션'), { target: { value: '칭찬하기' } });
    fireEvent.click(screen.getByRole('button', { name: '미션 등록' }));
    await screen.findByText('다시 시도해주세요.');
    fireEvent.click(screen.getByRole('button', { name: '미션 등록' }));
    await screen.findByText('칭찬하기');
    expect(attempts).toHaveLength(2);
    expect(attempts[0].id).toBe(attempts[1].id);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.getByRole('heading', { name: '미션 현황판' })).toBeTruthy();
  });

  it('늦게 도착한 조회 응답이 완료 체크 결과를 덮어쓰지 않는다', async () => {
    let reads = 0;
    let resolveRead: (value: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return Promise.resolve(response(state({ missions: [{ ...state().missions[0], completed: true }] })));
      reads++;
      if (reads === 2) return new Promise<Response>((resolve) => { resolveRead = resolve; });
      return Promise.resolve(response(state()));
    }));
    render(<ManittoApp onBackHome={vi.fn()} />);
    await screen.findByText('인사하기');
    fireEvent.focus(window);
    await waitFor(() => expect(reads).toBe(2));
    fireEvent.click(screen.getByRole('checkbox'));
    await screen.findByText('완료했어요');
    await act(async () => { resolveRead(response(state())); });
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });

  it('종료된 방은 저장 목록에서 제거하고 다른 모임으로 이동할 수 있다', async () => {
    rememberRoom(state());
    vi.stubGlobal('fetch', vi.fn(async () => response({ detail: '종료된 모임이에요.' }, 404)));
    render(<ManittoApp onBackHome={vi.fn()} />);
    await screen.findByText('종료된 모임이에요.');
    expect(loadManittoRooms()).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: '내 모임' }));
    expect(screen.getByRole('heading', { name: '새 모임 만들기' })).toBeTruthy();
  });

  it('저장소에서 만료되거나 손상된 참조를 제외하고 다른 활동 URL에 방 코드를 남기지 않는다', () => {
    localStorage.setItem('ongi.manitto.rooms.v1', JSON.stringify([null, { code: 'bad' }, state({ expiresAt: '2000-01-01' }), state()]));
    expect(loadManittoRooms()).toHaveLength(1);
    expect(buildActivityUrl(window.location.href, { id: 'balance-game' })).not.toContain('manittoRoom');
    expect(buildPageUrl(window.location.href, null)).not.toContain('manittoRoom');
  });
});
