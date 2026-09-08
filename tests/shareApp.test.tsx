// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareApp } from '../src/features/home/components/ShareApp';
import { shareAppLink } from '../src/platform/shareLink';

beforeEach(() => {
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = 'https://ongi.greengroove.app/';
  document.head.append(canonical);
});

afterEach(() => {
  cleanup();
  document.querySelector('link[rel="canonical"]')?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('온기 링크 공유', () => {
  it('지원되는 브라우저에서는 시스템 공유창에 canonical URL을 전달한다', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: share,
    });

    render(<ShareApp />);
    fireEvent.click(screen.getByRole('button', { name: '공유하기' }));

    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: '온기 | 우리 사이에 온기를',
      url: 'https://ongi.greengroove.app/',
    })));
    expect(screen.queryByText('온기 링크를 공유했어요.')).toBeNull();
  });

  it('화면에는 공유 아이콘 버튼만 노출한다', () => {
    render(<ShareApp />);

    const button = screen.getByRole('button', { name: '공유하기' });
    expect(button.textContent).toBe('');
    expect(screen.queryByRole('button', { name: '링크 복사' })).toBeNull();
  });

  it('시스템 공유를 지원하지 않으면 공유 버튼도 링크 복사로 대체된다', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<ShareApp />);
    fireEvent.click(screen.getByRole('button', { name: '공유하기' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://ongi.greengroove.app/'));
    expect(await screen.findByRole('status')).toHaveProperty('textContent', '링크를 복사했어요.');
  });

  it('놀이별 제목과 공유 전용 URL을 시스템 공유창에 전달한다', async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: share,
    });

    expect(await shareAppLink({
      title: '최애 월드컵 | 온기',
      url: 'https://ongi.greengroove.app/share/ideal-world-cup/',
    })).toBe('shared');
    expect(share).toHaveBeenCalledWith({
      title: '최애 월드컵 | 온기',
      url: 'https://ongi.greengroove.app/share/ideal-world-cup/',
    });
  });
});
