// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';
import { preloadActivity } from '../src/app/activityRegistry';
import { QUESTIONS } from '../src/features/heart-trace/data/questions';
import { RESULT_TYPES } from '../src/features/heart-trace/data/resultTypes';
import { TIE_BREAKER_OPTION_LABELS } from '../src/features/heart-trace/domain/tieBreaker';
import {
  RESULT_TYPE_IDS,
  type ChoiceId,
  type ResultTypeId,
} from '../src/features/heart-trace/domain/types';
import { LoadingScreen } from '../src/features/heart-trace/screens/LoadingScreen';
import { RESULT_REVEAL_DELAY_MS } from '../src/features/heart-trace/state/timing';

const INTRO_START_BUTTON_NAME = '바로 시작하기';
const HEART_TRACE_CARD_NAME = /마음속 흔적 찾기/;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function startQuestionFlow() {
  fireEvent.click(screen.getByRole('button', { name: INTRO_START_BUTTON_NAME }));
}

async function renderHeartTraceApp() {
  const rendered = render(<App />);
  fireEvent.click(screen.getByRole('button', { name: HEART_TRACE_CARD_NAME }));
  expect(screen.queryByLabelText('온기 앱을 여는 중')).toBeNull();
  await screen.findByRole('heading', { name: '마음속 흔적 찾기', level: 1 });
  return rendered;
}

function revealIntroStartButton() {
  fireEvent.keyDown(screen.getByRole('region', { name: '흔적이 소개 글' }), {
    key: 'End',
  });
}

function getOptionText(questionIndex: number, resultType: ResultTypeId): string {
  const option = QUESTIONS[questionIndex].options.find(
    (candidate) => candidate.resultType === resultType,
  );

  if (!option) {
    throw new Error(`${questionIndex + 1}번 문항에서 ${resultType} 선택지를 찾지 못했습니다.`);
  }

  return option.text;
}

function answerWithResultType(questionIndex: number, resultType: ResultTypeId) {
  fireEvent.click(screen.getByRole('radio', {
    name: getOptionText(questionIndex, resultType),
  }));
}

function getOptionTextById(questionIndex: number, optionId: ChoiceId): string {
  const option = QUESTIONS[questionIndex].options.find(
    (candidate) => candidate.id === optionId,
  );

  if (!option) {
    throw new Error(`${questionIndex + 1}번 문항에서 ${optionId} 선택지를 찾지 못했습니다.`);
  }

  return option.text;
}

function answerWithOptionId(questionIndex: number, optionId: ChoiceId) {
  fireEvent.click(screen.getByRole('radio', {
    name: getOptionTextById(questionIndex, optionId),
  }));
}

function mockResultImageFetch() {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    blob: async () => new Blob(['result-image'], { type: 'image/png' }),
  })));
}

async function getAccessibilityViolations(container: HTMLElement) {
  const audit = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });

  return audit.violations;
}

describe('앱 화면 흐름과 접근성', () => {
  it('홈에서 여러 놀거리와 이용 가능한 콘텐츠를 구분해 보여준다', async () => {
    // Cold chunk loading is covered separately by appActivityTransition and E2E.
    await Promise.all([preloadActivity('group-picker'), preloadActivity('ideal-world-cup')]);
    const { container } = render(<App />);

    expect(screen.getByRole('heading', { name: '우리 사이에 온기를' })).toBeTruthy();
    expect(screen.getByRole('button', { name: HEART_TRACE_CARD_NAME })).toBeTruthy();
    expect(screen.getByRole('button', { name: '극과 극 밸런스 게임' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '최애 월드컵' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '오늘은 누구?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '극과 극 밸런스 게임' }).textContent).toContain('NEW');
    expect(screen.getByRole('button', { name: '최애 월드컵' }).textContent).toContain('NEW');
    expect(screen.getByRole('heading', { name: '공동체를 위한 도구' }).closest('section')?.textContent).toContain('모임 필수 도구');
    expect(screen.getByRole('button', { name: HEART_TRACE_CARD_NAME }).textContent).not.toContain('NEW');
    expect(screen.queryByText('SOON')).toBeNull();
    expect(
      screen.getByRole('button', { name: '극과 극 밸런스 게임' }).textContent,
    ).toContain('극과 극 밸런스 게임');
    const communityToolsSection = screen.getByRole('heading', {
      name: '공동체를 위한 도구',
    }).closest('section');
    expect(communityToolsSection).not.toBeNull();
    expect(within(communityToolsSection as HTMLElement).getByRole('button', {
      name: /오늘은 누구\?/,
    })).toBeTruthy();
    fireEvent.click(within(communityToolsSection as HTMLElement).getByRole('button', {
      name: '나눔 순서',
    }));
    expect((await screen.findByRole('button', {
      name: '먼저 나눌 사람',
    }, { timeout: 5000 })).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '홈' }));

    const featuredSection = screen.getByRole('heading', { name: '추천 놀거리' }).closest('section');
    expect(featuredSection).not.toBeNull();
    expect(['극과 극 밸런스 게임', '최애 월드컵']).toContain(
      within(featuredSection as HTMLElement).getByRole('button').getAttribute('aria-label'),
    );
    expect(screen.getByRole('button', { name: '공유하기' }).closest('.home-footer__actions')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^v\d+\.\d+\.\d+ · 업데이트 내역$/ })).toBeTruthy();
    fireEvent.click(screen.getByText('창작자에게 연락하기'));
    expect(screen.getByRole('link', { name: /YouTube/ }).getAttribute('href')).toBe(
      'https://www.youtube.com/@bumi_daily_worship',
    );
    expect(screen.getByRole('link', { name: /이메일/ }).getAttribute('href')).toBe(
      'mailto:cmpsr123@naver.com',
    );
    expect(screen.getByRole('link', { name: /카카오톡 오픈채팅/ }).getAttribute('href')).toBe(
      'https://open.kakao.com/me/BeomhyunPark',
    );
    expect(screen.getByRole('link', {
      name: /GitHub/,
    }).getAttribute('href')).toBe('https://github.com/BeomhyunPark');
    expect(await getAccessibilityViolations(container)).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: '오늘은 누구?' }));
    expect(await screen.findByRole('heading', {
      name: '오늘은 누구?',
      level: 1,
    })).toBeTruthy();
    expect(screen.getByText('창작자 · hyunee')).toBeTruthy();
    expect(await getAccessibilityViolations(container)).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: '홈' }));

    fireEvent.click(screen.getByRole('button', { name: HEART_TRACE_CARD_NAME }));
    expect(await screen.findByRole('heading', {
      name: '마음속 흔적 찾기',
      level: 1,
    })).toBeTruthy();
    expect(screen.getByText('창작자 · 최유민 · 박은성 · hyunee')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '홈' }));
    expect(screen.getByRole('heading', { name: '우리 사이에 온기를' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '극과 극 밸런스 게임' }));
    expect(await screen.findByRole('heading', {
      name: '극과 극 밸런스 게임',
      level: 1,
    })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '홈' }));
    fireEvent.click(screen.getByRole('button', { name: '최애 월드컵' }));
    expect(await screen.findByRole('heading', {
      name: '최애 월드컵',
      level: 1,
    })).toBeTruthy();
    expect(await getAccessibilityViolations(container)).toEqual([]);
  }, 15_000);

  it('결과 로딩 진행률과 분석 단계가 시간에 따라 실제로 바뀐다', async () => {
    vi.useFakeTimers();
    const { container } = render(<LoadingScreen />);
    const progressBar = screen.getByRole('progressbar', { name: '결과 분석 진행률' });
    const progressValue = container.querySelector<HTMLElement>('.progress-bar__value');
    const soulOrb = container.querySelector('.soul-orb');

    expect(progressBar.getAttribute('aria-valuenow')).toBe('0');
    expect(soulOrb?.getAttribute('data-stage')).toBe('1');
    expect(soulOrb?.querySelectorAll('.soul-orb__stage')).toHaveLength(8);
    expect(soulOrb?.querySelector('.soul-orb__core')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '마음의 대답을 모으고 있어요' })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(32);
    });

    const earlyProgress = Number.parseFloat(progressValue?.style.width ?? '0');
    expect(earlyProgress).toBeGreaterThan(0);
    expect(earlyProgress).toBeLessThan(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1568);
    });

    expect(progressBar.getAttribute('aria-valuenow')).toBe('40');
    expect(soulOrb?.getAttribute('data-stage')).toBe('2');
    expect(screen.getByRole('heading', { name: '흔적의 결을 비교하고 있어요' })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2400);
    });

    expect(progressBar.getAttribute('aria-valuenow')).toBe('100');
    expect(soulOrb?.getAttribute('data-stage')).toBe('8');
    expect(screen.getByRole('heading', { name: '당신의 흔적을 찾았어요' })).toBeTruthy();
  });

  it('시작 화면과 질문 화면에 자동 접근성 위반이 없다', async () => {
    const { container } = await renderHeartTraceApp();
    expect(await getAccessibilityViolations(container)).toEqual([]);

    startQuestionFlow();
    expect(container.querySelector('.question-prompt')?.className).toBe('question-prompt');
    expect(await getAccessibilityViolations(container)).toEqual([]);
  });

  it('키보드만으로 바로 시작하고 질문에 답할 수 있다', async () => {
    const user = userEvent.setup();
    await renderHeartTraceApp();

    await user.tab();
    expect(document.activeElement?.textContent).toContain('홈');
    await user.tab();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('흔적이 소개 글');
    await user.keyboard('{End}');
    await user.tab();
    expect(document.activeElement?.textContent).toContain(INTRO_START_BUTTON_NAME);
    await user.keyboard('{Enter}');

    expect(screen.getByRole('group', { name: /Q1/ })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(5);

    await user.tab();
    expect(document.activeElement?.textContent).toContain('홈');
    await user.tab();
    expect(document.activeElement?.getAttribute('type')).toBe('radio');
    await user.keyboard(' ');

    expect(screen.getByText('Q2')).toBeTruthy();
  });

  it('소개를 읽지 않아도 시작 버튼을 보여주고 소개는 선택해서 읽는다', async () => {
    await renderHeartTraceApp();

    expect(screen.getByRole('button', { name: INTRO_START_BUTTON_NAME })).toBeTruthy();

    const messageTrack = screen.getByRole('region', { name: '흔적이 소개 글' });

    Object.defineProperties(messageTrack, {
      clientWidth: { configurable: true, value: 320 },
      scrollWidth: { configurable: true, value: 960 },
      scrollLeft: { configurable: true, value: 500 },
    });
    fireEvent.scroll(messageTrack);

    expect(screen.getByRole('button', { name: INTRO_START_BUTTON_NAME })).toBeTruthy();

    Object.defineProperty(messageTrack, 'scrollLeft', {
      configurable: true,
      value: 640,
    });
    fireEvent.scroll(messageTrack);

    expect(screen.getByRole('button', { name: INTRO_START_BUTTON_NAME })).toBeTruthy();
  });

  it('하단 버튼만으로 소개를 넘기고 시작 버튼까지 도달할 수 있다', async () => {
    await renderHeartTraceApp();

    const nextButtonName = '소개 더 읽기';

    fireEvent.click(screen.getByRole('button', { name: nextButtonName }));

    fireEvent.click(screen.getByRole('button', { name: nextButtonName }));

    fireEvent.click(screen.getByRole('button', { name: nextButtonName }));
    expect(screen.getByRole('button', { name: INTRO_START_BUTTON_NAME })).toBeTruthy();
  });

  it('화면과 문항을 이동할 때 이전 스크롤 위치를 남기지 않는다', async () => {
    await renderHeartTraceApp();

    document.documentElement.scrollTop = 320;
    document.body.scrollTop = 320;
    revealIntroStartButton();
    fireEvent.click(screen.getByRole('button', { name: INTRO_START_BUTTON_NAME }));
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);

    document.documentElement.scrollTop = 320;
    document.body.scrollTop = 320;
    answerWithOptionId(0, 'A');
    expect(screen.getByText('Q2')).toBeTruthy();
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);

    document.documentElement.scrollTop = 320;
    document.body.scrollTop = 320;
    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(screen.getByText('Q1')).toBeTruthy();
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
  });

  it('문항별 선택을 독립적으로 복원하고 기존 답변을 하나의 새 선택으로 교체한다', async () => {
    await renderHeartTraceApp();
    startQuestionFlow();

    answerWithOptionId(0, 'A');
    expect(screen.getByText('Q2')).toBeTruthy();
    expect(
      screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    const originalAnswer = screen.getByRole('radio', {
      name: getOptionTextById(0, 'A'),
    }) as HTMLInputElement;
    expect(originalAnswer.checked).toBe(true);

    answerWithOptionId(0, 'E');
    expect(screen.getByText('Q2')).toBeTruthy();
    expect(
      screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);

    answerWithOptionId(1, 'B');
    expect(screen.getByText('Q3')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    expect((screen.getByRole('radio', {
      name: getOptionTextById(1, 'B'),
    }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '이전' }));

    const changedAnswer = screen.getByRole('radio', {
      name: getOptionTextById(0, 'E'),
    }) as HTMLInputElement;
    expect(changedAnswer.checked).toBe(true);
    expect((screen.getByRole('radio', {
      name: getOptionTextById(0, 'A'),
    }) as HTMLInputElement).checked).toBe(false);

    fireEvent.click(changedAnswer);
    expect(screen.getByText('Q2')).toBeTruthy();
    expect((screen.getByRole('radio', {
      name: getOptionTextById(1, 'B'),
    }) as HTMLInputElement).checked).toBe(true);

    answerWithOptionId(1, 'B');
    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    fireEvent.click(screen.getByRole('button', { name: '이전' }));

    expect((screen.getByRole('radio', {
      name: getOptionTextById(0, 'E'),
    }) as HTMLInputElement).checked).toBe(true);
  });

  it('진행 중인 응답을 저장하고 홈에서 다시 들어와 이어하거나 삭제한다', async () => {
    await renderHeartTraceApp();
    startQuestionFlow();

    answerWithOptionId(0, 'A');
    expect(screen.getByText('Q2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '홈' }));

    expect(screen.getByRole('heading', { name: '우리 사이에 온기를' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: HEART_TRACE_CARD_NAME }));

    expect(await screen.findByRole('heading', { name: '2번 문항부터 이어서' })).toBeTruthy();
    expect(screen.getByText('1개 응답 저장됨')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '이어하기' }));

    expect(screen.getByText('Q2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    expect((screen.getByRole('radio', {
      name: getOptionTextById(0, 'A'),
    }) as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '홈' }));
    fireEvent.click(screen.getByRole('button', { name: HEART_TRACE_CARD_NAME }));
    fireEvent.click(await screen.findByRole('button', { name: '저장된 응답 지우기' }));

    expect(screen.queryByRole('button', { name: '이어하기' })).toBeNull();
  });

  it('패스 상태와 사용량을 복원하고 세 개 사용 후 추가 패스를 차단한다', async () => {
    await renderHeartTraceApp();
    startQuestionFlow();

    fireEvent.click(screen.getByRole('button', { name: '건너뛰기 (0/3)' }));

    expect(screen.getByText('Q2')).toBeTruthy();
    expect(screen.getByRole('button', { name: '건너뛰기 (1/3)' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    const skippedButton = screen.getByRole('button', {
      name: '건너뛰기 (1/3)',
    });
    expect(skippedButton.getAttribute('aria-pressed')).toBe('true');
    expect(
      screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);

    answerWithOptionId(0, 'A');
    expect(screen.getByRole('button', { name: '건너뛰기 (0/3)' })).toBeTruthy();

    for (const [skippedCount, questionNumber] of [3, 4, 5].entries()) {
      fireEvent.click(screen.getByRole('button', {
        name: `건너뛰기 (${skippedCount}/3)`,
      }));
      expect(screen.getByText(`Q${questionNumber}`)).toBeTruthy();
    }

    expect(screen.getByRole('button', { name: '건너뛰기 (3/3)' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(
      '건너뛰기를 모두 사용했어요.가장 가까운 답을 선택해 주세요.',
    );

    const blockedButton = screen.getByRole('button', {
      name: '건너뛰기 (3/3)',
    }) as HTMLButtonElement;
    expect(blockedButton.disabled).toBe(true);
    fireEvent.click(blockedButton);
    expect(screen.getByText('Q5')).toBeTruthy();
  });

  it('동점일 때 동점 유형만 표시하고 선택한 결과로 이동한다', async () => {
    mockResultImageFetch();
    const { container } = await renderHeartTraceApp();
    startQuestionFlow();

    const balancedAnswers = RESULT_TYPE_IDS.flatMap((resultType) =>
      Array.from({ length: 4 }, () => resultType),
    );

    balancedAnswers.forEach((resultType, questionIndex) => {
      answerWithResultType(questionIndex, resultType);
    });

    const tieOptions = screen.getAllByRole('radio');
    expect(tieOptions).toHaveLength(RESULT_TYPE_IDS.length);
    expect(tieOptions.map((option) => option.getAttribute('value'))).toEqual(
      RESULT_TYPE_IDS,
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      String(QUESTIONS.length + 1),
    );
    expect(screen.getByText(/마지막 질문/)).toBeTruthy();
    expect(await getAccessibilityViolations(container)).toEqual([]);

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('radio', {
      name: TIE_BREAKER_OPTION_LABELS.spring,
    }));

    expect(screen.getByRole('heading', { name: /가장 선명한 흔적을.*찾고 있어요/ })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESULT_REVEAL_DELAY_MS);
    });
    vi.useRealTimers();

    expect(screen.getByRole('heading', { name: RESULT_TYPES.spring.name })).toBeTruthy();
    expect(await getAccessibilityViolations(container)).toEqual([]);
  });

  it('완료 후 다시 하기를 누르면 모든 상태와 안내 단계를 초기화한다', async () => {
    mockResultImageFetch();
    await renderHeartTraceApp();
    vi.useFakeTimers();
    startQuestionFlow();

    QUESTIONS.forEach((_, questionIndex) => {
      answerWithResultType(questionIndex, 'bear');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESULT_REVEAL_DELAY_MS);
    });

    expect(screen.getByRole('heading', { name: RESULT_TYPES.bear.name })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '처음부터 다시 하기' }));

    expect(screen.getByRole('heading', { name: '마음속 흔적 찾기' })).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('결과 이미지가 느려도 결과를 먼저 보여주고 준비 후 저장을 활성화한다', async () => {
    let finishImageRequest: ((response: {
      ok: boolean;
      status: number;
      blob: () => Promise<Blob>;
    }) => void) | undefined;

    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      finishImageRequest = resolve;
    })));

    await renderHeartTraceApp();
    vi.useFakeTimers();
    startQuestionFlow();

    QUESTIONS.forEach((_, questionIndex) => {
      answerWithResultType(questionIndex, 'express');
    });

    expect(screen.getByRole('heading', { name: /가장 선명한 흔적을.*찾고 있어요/ })).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESULT_REVEAL_DELAY_MS);
    });

    expect(screen.getByRole('heading', { name: RESULT_TYPES.express.name })).toBeTruthy();
    const preparingButton = screen.getByRole('button', { name: '이미지 준비 중…' });
    expect((preparingButton as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      finishImageRequest?.({
        ok: true,
        status: 200,
        blob: async () => new Blob(['slow-result-image'], { type: 'image/png' }),
      });
      await Promise.resolve();
    });

    const readyButton = screen.getByRole('button', { name: '결과 이미지 저장하기' });
    expect((readyButton as HTMLButtonElement).disabled).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
