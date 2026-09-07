// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AnonymousSharingApp } from '../src/features/anonymous-sharing/AnonymousSharingApp';

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const QUESTION_ONE = '20000000-0000-0000-0000-000000000001';
const QUESTION_TWO = '20000000-0000-0000-0000-000000000002';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('익명 자기소개 나눔', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/?activity=anonymous-sharing#join=7KFM-3QPX');
    vi.stubGlobal('EventSource', undefined);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('QR 링크로 참여하고 질문을 한 단계씩 저장한 뒤 대기 화면으로 이동한다', async () => {
    let completed = false;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith('/api/room-joins')) {
        return json({
          roomId: ROOM_ID,
          title: '화요 소그룹',
          status: 'WRITING',
          participant: { id: 'participant-one', name: '은혜', responseCompleted: false },
          expiresAt: '2026-09-02T00:00:00Z',
        });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/state`)) {
        return json({
          roomId: ROOM_ID,
          title: '화요 소그룹',
          status: 'WRITING',
          role: 'PARTICIPANT',
          version: 1,
          participantCount: 2,
          completedParticipantCount: completed ? 1 : 0,
          participantJoined: true,
          responseCompleted: completed,
          currentRound: 0,
          totalRounds: 0,
          expiresAt: '2026-09-02T00:00:00Z',
        });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/questions`)) {
        return json({ questions: [
          { id: QUESTION_ONE, position: 1, prompt: '요즘 가장 좋아하는 것은 무엇인가요?' },
          { id: QUESTION_TWO, position: 2, prompt: '쉬는 날 가장 하고 싶은 것은 무엇인가요?' },
        ] });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/responses/me`)) {
        return json({ answers: [], completed: false });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/responses`) && init?.method === 'PUT') {
        return json({ answers: JSON.parse(String(init.body)).answers, completed: false });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/responses/complete`)) {
        completed = true;
        return json({ answers: [{ questionId: QUESTION_ONE, answer: '산책' }], completed: true });
      }
      return json({ code: 'NOT_FOUND', detail: 'not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnonymousSharingApp onBackHome={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '은혜' } });
    fireEvent.click(screen.getByRole('button', { name: '참여하기' }));

    expect(await screen.findByRole('heading', { name: '요즘 가장 좋아하는 것은 무엇인가요?' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '산책' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByRole('heading', { name: '쉬는 날 가장 하고 싶은 것은 무엇인가요?' })).toBeTruthy();
    expect(screen.queryByText(/저장(?: 대기 중| 중|했어요)/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '작성 완료' }));

    expect(await screen.findByRole('heading', { name: '이제 서로를 기다려요' })).toBeTruthy();
    await waitFor(() => {
      const joinCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/api/room-joins'));
      const joinInit = joinCall?.[1] as RequestInit;
      expect(new Headers(joinInit.headers).get('X-OnGi-Client')).toBe('web');
      expect(joinInit.credentials).toBe('include');
    });
  });

  it('시작 화면에서는 참여 코드를 입력할 수 없다', () => {
    window.history.replaceState({}, '', '/?activity=anonymous-sharing');

    render(<AnonymousSharingApp onBackHome={vi.fn()} />);

    expect(screen.getByRole('button', { name: '진행자로 모임 만들기' })).toBeTruthy();
    expect(screen.queryByText('참여 코드')).toBeNull();
    expect(screen.queryByRole('button', { name: '참여 코드로 참여하기' })).toBeNull();
  });

  it('모든 답변이 비어 있거나 공백뿐이면 작성을 완료할 수 없다', async () => {
    window.history.replaceState({}, '', `/?activity=anonymous-sharing#room=${ROOM_ID}`);
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith(`/api/rooms/${ROOM_ID}/state`)) {
        return json({
          roomId: ROOM_ID,
          title: '빈 답변 방지 모임',
          status: 'WRITING',
          role: 'PARTICIPANT',
          version: 1,
          participantCount: 2,
          completedParticipantCount: 0,
          participantJoined: true,
          responseCompleted: false,
          currentRound: 0,
          totalRounds: 0,
          expiresAt: '2026-09-02T00:00:00Z',
        });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/questions`)) {
        return json({ questions: [
          { id: QUESTION_ONE, position: 1, prompt: '첫 번째 질문' },
          { id: QUESTION_TWO, position: 2, prompt: '두 번째 질문' },
        ] });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/responses/me`)) {
        return json({ answers: [], completed: false });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/responses`) && init?.method === 'PUT') {
        return json({ answers: [], completed: false });
      }
      return json({ code: 'NOT_FOUND', detail: 'not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnonymousSharingApp onBackHome={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: '첫 번째 질문' })).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByRole('heading', { name: '두 번째 질문' })).toBeTruthy();
    const completeButton = screen.getByRole('button', { name: '작성 완료' });
    expect((completeButton as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('답변을 하나 이상 작성해야 완료할 수 있어요.')).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/responses/complete'))).toBe(false);
  });

  it('진행자가 권한을 유지한 채 참여자로 들어가 답변을 작성할 수 있다', async () => {
    window.history.replaceState({}, '', `/?activity=anonymous-sharing#room=${ROOM_ID}`);
    let participantJoined = false;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith('/api/room-joins')) {
        participantJoined = true;
        return json({
          roomId: ROOM_ID,
          title: '진행자 참여 모임',
          status: 'WRITING',
          participant: { id: 'host-participant', name: '진행자', responseCompleted: false },
          expiresAt: '2026-09-02T00:00:00Z',
        });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/state`)) {
        return json({
          roomId: ROOM_ID,
          roomCode: '7KFM-3QPX',
          title: '진행자 참여 모임',
          status: 'WRITING',
          role: 'HOST',
          version: 1,
          participantCount: participantJoined ? 1 : 0,
          completedParticipantCount: 0,
          participantJoined,
          responseCompleted: false,
          currentRound: 0,
          totalRounds: 0,
          expiresAt: '2026-09-02T00:00:00Z',
        });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/participants`)) {
        return json({ participants: [] });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/questions`)) {
        return json({ questions: [
          { id: QUESTION_ONE, position: 1, prompt: '진행자의 요즘 관심사는 무엇인가요?' },
        ] });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/responses/me`)) {
        return json({ answers: [], completed: false });
      }
      return json({ code: 'NOT_FOUND', detail: 'not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnonymousSharingApp onBackHome={vi.fn()} />);
    expect(await screen.findByText('진행자도 함께 참여할까요?')).toBeTruthy();
    expect(screen.getByRole('img', { name: '모임 참여 QR 코드' })).toBeTruthy();
    expect(screen.queryByText('7KFM-3QPX')).toBeNull();
    fireEvent.change(screen.getByLabelText('내 이름'), { target: { value: '진행자' } });
    fireEvent.click(screen.getByRole('button', { name: '나도 참여하기' }));

    expect(await screen.findByRole('heading', { name: '진행자의 요즘 관심사는 무엇인가요?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '← 진행자 화면으로' })).toBeTruthy();
  });

  it('마감한 참여자 입장을 다시 열 수 있다', async () => {
    window.history.replaceState({}, '', `/?activity=anonymous-sharing#room=${ROOM_ID}`);
    let status: 'LOCKED' | 'WRITING' = 'LOCKED';
    let version = 2;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith(`/api/rooms/${ROOM_ID}/unlock`)) {
        status = 'WRITING';
        version += 1;
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/state`) || url.endsWith(`/api/rooms/${ROOM_ID}/unlock`)) {
        return json({
          roomId: ROOM_ID,
          roomCode: '7KFM-3QPX',
          title: '다시 여는 모임',
          status,
          role: 'HOST',
          version,
          participantCount: 2,
          completedParticipantCount: 2,
          participantJoined: false,
          responseCompleted: false,
          currentRound: 0,
          totalRounds: 0,
          expiresAt: '2026-09-02T00:00:00Z',
        });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/participants`)) {
        return json({ participants: [] });
      }
      return json({ code: 'NOT_FOUND', detail: 'not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnonymousSharingApp onBackHome={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: '참여자 입장 다시 열기' }));

    expect(await screen.findByRole('button', { name: '참여자 입장 마감' })).toBeTruthy();
  });

  it('진행자는 확인 후 실수로 만든 방을 없애고 시작 화면으로 나간다', async () => {
    window.history.replaceState({}, '', `/?activity=anonymous-sharing#room=${ROOM_ID}`);
    window.localStorage.setItem('ongi.anonymous-sharing.room.v1', ROOM_ID);
    let cancelCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith(`/api/rooms/${ROOM_ID}/cancel`)) {
        cancelCalls += 1;
        return json({ cancelled: true });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/state`)) {
        return json({
          roomId: ROOM_ID,
          roomCode: '7KFM-3QPX',
          title: '실수로 만든 모임',
          status: 'CREATED',
          role: 'HOST',
          version: 0,
          participantCount: 0,
          completedParticipantCount: 0,
          participantJoined: false,
          responseCompleted: false,
          currentRound: 0,
          totalRounds: 0,
          expiresAt: '2026-09-02T00:00:00Z',
        });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/participants`)) {
        return json({ participants: [] });
      }
      return json({ code: 'NOT_FOUND', detail: 'not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnonymousSharingApp onBackHome={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: '방 없애기' }));

    expect(screen.getByText('정말 이 방을 없앨까요?')).toBeTruthy();
    expect(cancelCalls).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: '방 없애기' }));

    expect(await screen.findByRole('button', { name: '진행자로 모임 만들기' })).toBeTruthy();
    expect(cancelCalls).toBe(1);
    expect(window.localStorage.getItem('ongi.anonymous-sharing.room.v1')).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('종료 화면에서 바로 새 모임 만들기를 시작한다', async () => {
    window.history.replaceState({}, '', `/?activity=anonymous-sharing#room=${ROOM_ID}`);
    vi.stubGlobal('fetch', vi.fn(async () => json({
      roomId: ROOM_ID,
      title: '끝난 모임',
      status: 'COMPLETED',
      role: 'HOST',
      version: 8,
      participantCount: 0,
      completedParticipantCount: 0,
      participantJoined: false,
      responseCompleted: false,
      currentRound: 2,
      totalRounds: 0,
      expiresAt: '2026-09-02T00:00:00Z',
    })));

    render(<AnonymousSharingApp onBackHome={vi.fn()} />);
    expect(await screen.findByRole('button', { name: '새 모임 만들기' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '온기 홈으로 돌아가기' })).toBeNull();
    expect(screen.getByRole('button', { name: '홈으로 돌아가기' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '새 모임 만들기' }));

    expect(await screen.findByRole('heading', { name: '새 모임 만들기' })).toBeTruthy();
    expect(window.localStorage.getItem('ongi.anonymous-sharing.room.v1')).toBeNull();
  });

  it('작성자 이름은 한 번 더 확인한 뒤에만 공개한다', async () => {
    window.history.replaceState({}, '', `/?activity=anonymous-sharing#room=${ROOM_ID}`);
    let revealed = false;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith(`/api/rooms/${ROOM_ID}/state`)) {
        return json({
          roomId: ROOM_ID,
          title: '공개 확인 모임',
          status: 'SHARING',
          role: 'PARTICIPANT',
          version: 3,
          participantCount: 2,
          completedParticipantCount: 2,
          participantJoined: true,
          responseCompleted: true,
          currentRound: 0,
          totalRounds: 2,
          expiresAt: '2026-09-02T00:00:00Z',
        });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/sharing/reveal`)) {
        revealed = true;
        return json({
          state: 'REVEALED', sequence: 0, total: 2,
          answers: [{ question: '질문', answer: '답변' }],
          participantName: '은혜', canReveal: false, roomVersion: 3,
        });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/sharing/current`)) {
        return json({
          state: revealed ? 'REVEALED' : 'ANONYMOUS', sequence: 0, total: 2,
          answers: [{ question: '질문', answer: '답변' }],
          participantName: revealed ? '은혜' : undefined,
          canReveal: !revealed, roomVersion: 3,
        });
      }
      return json({ code: 'NOT_FOUND', detail: 'not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnonymousSharingApp onBackHome={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: '이거 저예요' }));

    expect(await screen.findByText('정말 내 이야기인가요?')).toBeTruthy();
    expect(revealed).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '네, 제 이름을 공개할게요' }));

    expect(await screen.findByRole('heading', { name: '은혜님의 이야기예요' })).toBeTruthy();
    expect(revealed).toBe(true);
  });

  it('현재 작성자가 아닌 참여자에게도 공개 안내를 보여준다', async () => {
    window.history.replaceState({}, '', `/?activity=anonymous-sharing#room=${ROOM_ID}`);
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith(`/api/rooms/${ROOM_ID}/state`)) {
        return json({
          roomId: ROOM_ID,
          title: '함께 기다리는 모임',
          status: 'SHARING',
          role: 'PARTICIPANT',
          version: 3,
          participantCount: 3,
          completedParticipantCount: 3,
          participantJoined: true,
          responseCompleted: true,
          currentRound: 0,
          totalRounds: 3,
          expiresAt: '2026-09-02T00:00:00Z',
        });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/sharing/current`)) {
        return json({
          state: 'ANONYMOUS', sequence: 0, total: 3,
          answers: [{ question: '질문', answer: '답변' }],
          canReveal: false, roomVersion: 3,
        });
      }
      return json({ code: 'NOT_FOUND', detail: 'not found' }, 404);
    }));

    render(<AnonymousSharingApp onBackHome={vi.fn()} />);

    expect(await screen.findByText('작성자가 준비되면 직접 자신을 공개해요.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '이거 저예요' }));
    expect(await screen.findByText('이번 이야기는 다른 분의 이야기예요')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '네, 제 이름을 공개할게요' })).toBeNull();
  });

  it('마지막 이야기에는 나눔 끝내기를 표시하고 종료 준비 화면에는 회차를 숨긴다', async () => {
    window.history.replaceState({}, '', `/?activity=anonymous-sharing#room=${ROOM_ID}`);
    let finished = false;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith(`/api/rooms/${ROOM_ID}/next`)) {
        finished = true;
        return json({ state: 'FINISHED', sequence: null, total: 2, answers: [], canReveal: false, roomVersion: 5 });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/state`)) {
        return json({
          roomId: ROOM_ID,
          roomCode: '7KFM-3QPX',
          title: '마지막 이야기 모임',
          status: 'SHARING',
          role: 'HOST',
          version: 5,
          participantCount: 2,
          completedParticipantCount: 2,
          participantJoined: false,
          responseCompleted: false,
          currentRound: finished ? 2 : 1,
          totalRounds: 2,
          expiresAt: '2026-09-02T00:00:00Z',
        });
      }
      if (url.endsWith(`/api/rooms/${ROOM_ID}/sharing/current`)) {
        return json(finished
          ? { state: 'FINISHED', sequence: null, total: 2, answers: [], canReveal: false, roomVersion: 5 }
          : {
              state: 'REVEALED', sequence: 1, total: 2,
              answers: [{ question: '질문', answer: '마지막 답변' }],
              participantName: '사랑', canReveal: false, roomVersion: 5,
            });
      }
      return json({ code: 'NOT_FOUND', detail: 'not found' }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AnonymousSharingApp onBackHome={vi.fn()} />);
    expect(await screen.findByRole('button', { name: '나눔 끝내기' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '다음 이야기' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '나눔 끝내기' }));

    expect(await screen.findByRole('button', { name: '모임 종료하기' })).toBeTruthy();
    expect(screen.queryByText('모든 이야기 완료')).toBeNull();
    expect(screen.queryByText(/번째 이야기/)).toBeNull();
  });
});
