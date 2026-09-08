// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';

const ATTEMPT_ID = '30000000-0000-4000-8000-000000000001';
const RESUME_TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO_12';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function betaQuestions() {
  return Array.from({ length: 27 }, (_, index) => ({
    questionId: `31000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    order: index + 1,
    prompt: `${index + 1}번 상황`,
    optionA: `${index + 1}번 A 문장`,
    optionB: `${index + 1}번 B 문장`,
  }));
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('구르미 테스트 Beta', () => {
  it('홈에서 Beta 인트로로 진입하고 비공식 놀이형 콘텐츠임을 고지한다', async () => {
    const { container } = render(<App />);
    const betaButton = screen.getByRole('button', { name: '구르미 Beta 테스트 시작하기' });

    expect(betaButton.classList.contains('gureumi-home-teaser')).toBe(true);
    fireEvent.click(betaButton);

    expect(await screen.findByRole('heading', { name: /구르미 테스트에/, level: 1 })).toBeTruthy();
    expect(window.location.search).toBe('?activity=gureumi');
    expect(screen.getByText(/정식 TCI 검사 또는 심리학적 진단·평가 도구가 아닙니다/)).toBeTruthy();
    expect((await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    })).violations).toEqual([]);
  });

  it('attempt를 만든 뒤 서버에서 받은 문항만 표시하고 선택 즉시 저장한다', async () => {
    const questions = betaQuestions();
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const method = init?.method ?? 'GET';

      if (url.pathname === '/api/gureumi/attempts' && method === 'POST') {
        return json({
          attemptId: ATTEMPT_ID,
          resumeToken: RESUME_TOKEN,
          version: 'GUREUMI_BETA_V01',
          attemptNo: 1,
          startedAt: '2026-09-03T00:00:00Z',
        });
      }
      if (url.pathname === '/api/gureumi/attempts/current') {
        return json({
          attemptId: ATTEMPT_ID,
          version: 'GUREUMI_BETA_V01',
          attemptNo: 1,
          completed: false,
          answeredCount: 0,
          nextOrder: 1,
          answers: [],
          startedAt: '2026-09-03T00:00:00Z',
        });
      }
      if (url.pathname.endsWith('/questions')) {
        return json({ version: 'GUREUMI_BETA_V01', questions });
      }
      if (url.pathname.endsWith('/answers') && method === 'PUT') {
        return json({
          attemptId: ATTEMPT_ID,
          version: 'GUREUMI_BETA_V01',
          attemptNo: 1,
          completed: false,
          answeredCount: 1,
          nextOrder: 2,
          answers: [{ questionId: questions[0].questionId, choice: 'A_VERY' }],
          startedAt: '2026-09-03T00:00:00Z',
        });
      }
      return json({ detail: 'unexpected request' }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/?activity=gureumi');
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: 'Beta 테스트 시작하기' }));
    expect(await screen.findByText('1번 상황')).toBeTruthy();
    expect(screen.getByText('1번 A 문장')).toBeTruthy();
    expect(screen.queryByText(/NOVELTY|highSide|resultType/)).toBeNull();

    fireEvent.click(screen.getAllByRole('radio', { name: /A에 매우 가까움/ })[0]);

    await waitFor(() => {
      const answerCall = fetchMock.mock.calls.find(([input, init]) => (
        String(input).includes('/answers') && init?.method === 'PUT'
      ));
      expect(answerCall).toBeTruthy();
      expect(JSON.parse(String(answerCall?.[1]?.body))).toMatchObject({
        questionId: questions[0].questionId,
        choice: 'A_VERY',
      });
      expect(new Headers(answerCall?.[1]?.headers).get('X-Gureumi-Resume-Token')).toBe(RESUME_TOKEN);
    });
  });

  it('localStorage의 opaque token으로 저장된 답과 다음 위치를 복구한다', async () => {
    const questions = betaQuestions();
    window.localStorage.setItem('ongi_gureumi_attempt_v01', JSON.stringify({
      attemptId: ATTEMPT_ID,
      resumeToken: RESUME_TOKEN,
    }));
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === '/api/gureumi/attempts/current') {
        return json({
          attemptId: ATTEMPT_ID,
          version: 'GUREUMI_BETA_V01',
          attemptNo: 1,
          completed: false,
          answeredCount: 5,
          nextOrder: 6,
          answers: questions.slice(0, 5).map(({ questionId }) => ({ questionId, choice: 'A_LITTLE' })),
          startedAt: '2026-09-03T00:00:00Z',
        });
      }
      if (url.pathname.endsWith('/questions')) {
        return json({ version: 'GUREUMI_BETA_V01', questions });
      }
      return json({ detail: 'unexpected request' }, 500);
    }));
    window.history.replaceState({}, '', '/?activity=gureumi');
    render(<App />);

    expect(await screen.findByText('5 / 27개 답변이 안전하게 저장되어 있어요.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '6번부터 이어하기' }));

    expect(await screen.findByText('6번 상황')).toBeTruthy();
    expect(screen.getByText('6–10 / 27')).toBeTruthy();
    expect(screen.getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(screen.getByText('1–5 / 27')).toBeTruthy();
    expect(screen.getAllByRole('radio').filter((radio) => (radio as HTMLInputElement).checked)).toHaveLength(5);
  });

  it('완료 후 다시 들어오면 저장된 토큰으로 이전 결과를 복원한다', async () => {
    window.localStorage.setItem('ongi_gureumi_attempt_v01', JSON.stringify({
      attemptId: ATTEMPT_ID,
      resumeToken: RESUME_TOKEN,
    }));
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith('/result')) return json({
        attemptId: ATTEMPT_ID, version: 'GUREUMI_BETA_V01', resultType: 'SUNNY',
        characterKey: 'sunny', displayName: '쨍이', axes: [],
      });
      return json({
      attemptId: ATTEMPT_ID,
      version: 'GUREUMI_BETA_V01',
      attemptNo: 1,
      completed: true,
      answeredCount: 27,
      nextOrder: 27,
      answers: [],
      startedAt: '2026-09-03T00:00:00Z',
      completedAt: '2026-09-03T00:05:00Z',
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/?activity=gureumi');

    render(<App />);

    expect(await screen.findByRole('heading', { name: '쨍이', level: 1 })).toBeTruthy();
    expect(window.localStorage.getItem('ongi_gureumi_attempt_v01')).not.toBeNull();
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/result'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '← 홈' }));
    expect(await screen.findByRole('heading', { name: '우리 사이에 온기를' })).toBeTruthy();
  });
});
