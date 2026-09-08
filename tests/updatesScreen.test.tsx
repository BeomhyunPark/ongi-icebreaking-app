// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from '../src/app/App';
import { RELEASES } from '../src/features/updates/releaseHistory';

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

describe('업데이트 내역', () => {
  it('홈에서 전체 버전 기록을 열고 다시 돌아온다', async () => {
    const { container } = render(<App />);

    document.documentElement.scrollTop = 1200;
    document.body.scrollTop = 1200;
    fireEvent.click(screen.getByRole('button', { name: `${RELEASES[0].version} · 업데이트 내역` }));

    expect(screen.getByRole('heading', { name: '업데이트 내역', level: 1 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '콘텐츠는 달라도, 온기는 하나' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '흔적테스트의 시작' })).toBeTruthy();
    expect(screen.getByText('v0.1.0')).toBeTruthy();
    expect(screen.getAllByText('ARCHIVE').length).toBeGreaterThan(0);
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
    expect(new URL(window.location.href).searchParams.get('page')).toBe('updates');
    expect((await axe.run(container, {
      rules: { 'color-contrast': { enabled: false } },
    })).violations).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: '온기로 돌아가기' }));
    expect(screen.getByRole('heading', { name: '우리 사이에 온기를' })).toBeTruthy();
    expect(new URL(window.location.href).searchParams.get('page')).toBeNull();
  });

  it('업데이트 내역 주소로 바로 진입할 수 있다', () => {
    window.history.replaceState({}, '', '/?page=updates');
    render(<App />);

    expect(screen.getByRole('heading', { name: '업데이트 내역', level: 1 })).toBeTruthy();
    expect(screen.getByText('v2.1.0')).toBeTruthy();
    expect(screen.getByText('v0.7.2')).toBeTruthy();
  });
});
