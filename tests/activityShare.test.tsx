// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/app/App';
import { ActivityShareButton } from '../src/components/ActivityShareButton';

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
  it('좋아요 응답 전에는 0을 실제 개수처럼 표시하지 않는다', async () => {
    window.history.replaceState({}, '', '/?activity=heart-trace');
    render(<ActivityShareButton target={{ id: 'heart-trace' }} />);

    expect((screen.getByRole('button', { name: '좋아요 정보 불러오는 중' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: '좋아요 추가 · 현재 0개' })).toBeNull();
    expect(await screen.findByRole('button', { name: '좋아요 추가 · 현재 0개' })).toBeTruthy();
  });

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
    expect(await screen.findByText('극과 극 밸런스 게임 링크를 공유했어요.')).toBeTruthy();
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

  it('콘텐츠 좋아요를 추가하고 취소한다', async () => {
    window.history.replaceState({}, '', '/?activity=balance-game');
    render(<App />);

    const likeButton = await screen.findByRole('button', { name: '좋아요 추가 · 현재 0개' });
    fireEvent.click(likeButton);
    expect(await screen.findByRole('button', { name: '좋아요 취소 · 현재 1개' })).toBeTruthy();
    expect(await screen.findByText('좋아요를 저장했어요. 다음에 방문해도 유지돼요.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '좋아요 취소 · 현재 1개' }));
    expect(await screen.findByRole('button', { name: '좋아요 추가 · 현재 0개' })).toBeTruthy();
    expect(await screen.findByText('좋아요를 취소했어요. 누적 수에서 1개가 빠져요.')).toBeTruthy();
  });

  it('밸런스 게임의 가볍게와 조금 깊게 좋아요를 따로 유지한다', async () => {
    window.history.replaceState({}, '', '/?activity=balance-game&weight=light');
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '좋아요 추가 · 현재 0개' }));
    expect(await screen.findByRole('button', { name: '좋아요 취소 · 현재 1개' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /조금 깊게/ }));
    expect(await screen.findByRole('button', { name: '좋아요 추가 · 현재 0개' })).toBeTruthy();
    expect(window.location.search).toBe('?activity=balance-game&weight=deep');
  });

  it('최애 월드컵 카테고리마다 좋아요를 따로 유지한다', async () => {
    window.history.replaceState({}, '', '/?activity=ideal-world-cup&category=meal');
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '좋아요 추가 · 현재 0개' }));
    expect(await screen.findByRole('button', { name: '좋아요 취소 · 현재 1개' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '디저트' }));
    expect(await screen.findByRole('button', { name: '좋아요 추가 · 현재 0개' })).toBeTruthy();
    expect(window.location.search).toBe('?activity=ideal-world-cup&category=dessert');
  });

  it('모임 도구를 바꾸면 공유 대상도 선택한 도구로 바꾸어준다', async () => {
    window.history.replaceState({}, '', '/?tool=prayer');
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: '좋아요 추가 · 현재 0개' }));
    expect(await screen.findByRole('button', { name: '좋아요 취소 · 현재 1개' })).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: '나눔 조 짜기' }));

    const groupsShareButton = await screen.findByRole('button', {
      name: '나눔 조 편성하기 링크 공유하기',
    });
    expect(groupsShareButton.closest<HTMLElement>('.activity-link-share')?.style.getPropertyValue(
      '--activity-share-accent',
    )).toBe('#85a8ed');
    expect(window.location.search).toBe('?tool=groups');
    expect(await screen.findByRole('button', { name: '좋아요 추가 · 현재 0개' })).toBeTruthy();
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
    expect(await screen.findByRole('button', { name: '좋아요 추가 · 현재 0개' })).toBeTruthy();
  });

  it('익명 나눔은 방 참여 링크에서 공유를 처리하므로 상단에는 좋아요만 둔다', async () => {
    window.history.replaceState({}, '', '/?activity=anonymous-sharing');
    render(<App />);

    expect(await screen.findByRole('button', { name: '좋아요 추가 · 현재 0개' })).toBeTruthy();
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
    expect(await screen.findByText('구르미 테스트 링크를 공유했어요.')).toBeTruthy();
    expect(window.location.search).toBe('?activity=gureumi-teaser');
  });
});
