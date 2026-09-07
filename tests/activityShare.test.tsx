// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';

beforeEach(() => {
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = 'https://ongi.greengroove.app/';
  document.head.append(canonical);
});

afterEach(() => {
  cleanup();
  document.querySelector('link[rel="canonical"]')?.remove();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

describe('놀이와 도구 링크 공유', () => {
  it('놀이 화면에서 해당 놀이의 전용 미리보기 URL을 공유한다', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: share,
    });
    window.history.replaceState({}, '', '/?activity=balance-game');

    render(<App />);
    const shareButton = await screen.findByRole('button', {
      name: '극과 극 밸런스 게임 링크 공유하기',
    });
    expect(shareButton.closest<HTMLElement>('.activity-link-share')?.style.getPropertyValue(
      '--activity-share-accent',
    )).toBe('#ff8c68');
    fireEvent.click(shareButton);

    await waitFor(() => expect(share).toHaveBeenCalledWith({
      title: '극과 극 밸런스 게임 | 온기',
      url: 'https://ongi.greengroove.app/share/balance-game/',
    }));
    expect(screen.queryByText('극과 극 밸런스 게임 링크를 공유했어요.')).toBeNull();
  });

  it('밸런스 게임의 가볍게·조금 깊게 테마에 따라 공유 색상을 바꾸어준다', async () => {
    window.history.replaceState({}, '', '/?activity=balance-game');
    render(<App />);

    await screen.findByRole('heading', { name: '극과 극 밸런스 게임' });
    const shell = document.querySelector('.activity-shell');
    expect(shell?.querySelector('.balance-game-screen--light')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /조금 깊게/ }));

    expect(shell?.querySelector('.balance-game-screen--deep')).toBeTruthy();
  });

  it('모임 도구를 바꾸면 공유 대상도 선택한 도구로 바꾸어준다', async () => {
    window.history.replaceState({}, '', '/?tool=prayer');
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '나눔 조 짜기' }));

    const groupsShareButton = await screen.findByRole('button', {
      name: '나눔 조 편성하기 링크 공유하기',
    });
    expect(groupsShareButton.closest<HTMLElement>('.activity-link-share')?.style.getPropertyValue(
      '--activity-share-accent',
    )).toBe('#85a8ed');
    expect(window.location.search).toBe('?tool=groups');
  });

  it('최애 월드컵 카테고리를 바꾸면 공유 제목·URL·색상도 함께 바꾼다', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: share,
    });
    window.history.replaceState({}, '', '/?activity=ideal-world-cup&category=dessert');
    render(<App />);

    const dessertShare = await screen.findByRole('button', {
      name: '디저트 최애 월드컵 링크 공유하기',
    });
    expect(dessertShare.closest<HTMLElement>('.activity-link-share')?.style.getPropertyValue(
      '--activity-share-accent',
    )).toBe('#f48faa');

    fireEvent.click(screen.getByRole('button', { name: '여행지' }));
    const travelShare = await screen.findByRole('button', {
      name: '여행지 최애 월드컵 링크 공유하기',
    });
    expect(window.location.search).toBe('?activity=ideal-world-cup&category=travel');
    expect(travelShare.closest<HTMLElement>('.activity-link-share')?.style.getPropertyValue(
      '--activity-share-accent',
    )).toBe('#86d9f2');

    fireEvent.click(travelShare);
    await waitFor(() => expect(share).toHaveBeenCalledWith({
      title: '여행지 최애 월드컵 | 온기',
      url: 'https://ongi.greengroove.app/share/ideal-world-cup-travel/',
    }));
  });

  it.each([
    ['heart-trace', '/?activity=heart-trace', '마음속 흔적 찾기 링크 공유하기', '#f48faa'],
    ['balance-game', '/?activity=balance-game', '극과 극 밸런스 게임 링크 공유하기', '#ff8c68'],
    ['ideal-world-cup', '/?activity=ideal-world-cup&category=meal', '든든한 한 끼 최애 월드컵 링크 공유하기', '#ffd36e'],
    ['group-picker', '/?tool=prayer', '기도할 사람 정하기 링크 공유하기', '#baf5e6'],
  ])('%s 화면에 맞는 공유 버튼과 색상을 노출한다', async (_content, route, label, accent) => {
    window.history.replaceState({}, '', route);
    render(<App />);

    const shareButton = await screen.findByRole('button', { name: label });
    expect(shareButton.closest<HTMLElement>('.activity-link-share')?.style.getPropertyValue(
      '--activity-share-accent',
    )).toBe(accent);
  });

  it('익명 나눔은 방 참여 링크에서 공유를 처리하므로 상단 공유 버튼을 두지 않는다', async () => {
    window.history.replaceState({}, '', '/?activity=anonymous-sharing');
    render(<App />);

    expect(screen.queryByRole('button', { name: /링크 공유하기/ })).toBeNull();
  });

  it('구르미 Beta에는 인트로 안의 전용 공유 버튼을 노출하고 공통 플로팅 버튼은 두지 않는다', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: share,
    });
    window.history.replaceState({}, '', '/?activity=gureumi-teaser');
    render(<App />);

    await screen.findByRole('heading', { name: /구르미 테스트에/ });
    expect(screen.queryByRole('button', { name: /좋아요/ })).toBeNull();
    expect(document.querySelector('.activity-link-share')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '구르미 테스트 공유하기' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({
      title: '나는 어떤 구르미일까? | 온기',
      url: 'https://ongi.greengroove.app/share/gureumi/',
    }));
    expect(screen.queryByText('구르미 테스트 링크를 공유했어요.')).toBeNull();
    expect(window.location.search).toBe('?activity=gureumi-teaser');
  });
});
