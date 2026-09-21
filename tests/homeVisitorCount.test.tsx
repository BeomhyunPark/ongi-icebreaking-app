// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HomeScreen } from '../src/features/home/HomeScreen';

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('홈 방문자 수', () => {
  it('누적 익명 방문자 수를 홈 브랜드 영역에 표시한다', async () => {
    render(
      <HomeScreen
        featuredActivityId="heart-trace"
        hasActiveSharingRoom={false}
        onOpenUpdates={() => undefined}
        onSelectActivity={() => undefined}
      />,
    );

    expect(screen.getByLabelText('누적 방문자 집계 중')).toBeTruthy();
    expect(await screen.findByLabelText('누적 방문자 0명')).toBeTruthy();
  });

  it('진행 중인 익명 나눔이 있으면 홈에서 돌아가는 길을 보여준다', () => {
    window.localStorage.setItem(
      'ongi.anonymous-sharing.room.v1',
      '11111111-1111-4111-8111-111111111111',
    );
    render(
      <HomeScreen
        featuredActivityId="heart-trace"
        hasActiveSharingRoom
        onOpenUpdates={() => undefined}
        onSelectActivity={() => undefined}
      />,
    );

    expect(screen.getByText('진행 중인 모임으로 돌아가기')).toBeTruthy();
  });
});
