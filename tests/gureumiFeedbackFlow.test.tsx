// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GureumiResult } from '../src/features/gureumi/domain/types';
import { GureumiResultScreen } from '../src/features/gureumi/screens/GureumiResultScreen';
import { saveGureumiResultImage } from '../src/features/gureumi/services/resultImage';
import { shareGureumiResult } from '../src/features/gureumi/services/kakaoShare';

vi.mock('../src/features/gureumi/services/resultImage', () => ({
  getGureumiResultImageSrc: () => '/result.png',
  preloadGureumiResultImage: vi.fn().mockResolvedValue(undefined),
  saveGureumiResultImage: vi.fn().mockResolvedValue('downloaded'),
}));
vi.mock('../src/features/gureumi/services/kakaoShare', () => ({
  bindGureumiKakaoShareButton: vi.fn().mockResolvedValue(false),
  shareGureumiResult: vi.fn().mockResolvedValue(undefined),
}));

const result: GureumiResult = {
  attemptId: 'attempt-1',
  version: 'GUREUMI_BETA_V01',
  resultType: 'ARONG',
  characterKey: 'arong',
  displayName: '아롱이',
  axes: [
    { key: 'NOVELTY', label: '새로움', level: 'HIGH' },
    { key: 'WORRY', label: '걱정', level: 'LOW' },
    { key: 'RELATION', label: '관계', level: 'HIGH' },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('구르미 피드백 수집 제거 회귀', () => {
  it.each([undefined, 4])('저장된 공감도 %s와 관계없이 설문 없이 결과 행동을 이용한다', async (feedbackRating) => {
    const user = userEvent.setup();
    const onRetest = vi.fn();
    const onBackHome = vi.fn();
    const { container } = render(
      <GureumiResultScreen
        result={{ ...result, feedbackRating }}
        onRetest={onRetest}
        onBackHome={onBackHome}
      />,
    );

    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /피드백|의견|설문/ })).toBeNull();
    expect(container.textContent).not.toMatch(/BETA|Beta|공감도|얼마나 닮았/);
    await user.click(screen.getByRole('button', { name: '결과 이미지 저장하기' }));
    expect(saveGureumiResultImage).toHaveBeenCalledWith('arong');
    expect(await screen.findByText('결과 이미지 다운로드를 시작했어요.')).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: '카카오톡으로 결과 공유하기' }));
    expect(shareGureumiResult).toHaveBeenCalledWith(expect.objectContaining({ characterKey: 'arong' }));
    await user.click(screen.getByRole('button', { name: '8가지 구르미 모두 보기 →' }));
    expect(container.querySelectorAll('.gureumi-result__all-types article')).toHaveLength(8);
    await user.click(screen.getByRole('button', { name: '다시 테스트하기' }));
    expect(onRetest).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: '← 홈' }));
    expect(onBackHome).toHaveBeenCalledTimes(1);
  });

  it('재검사 준비 중에는 중복 실행을 막고 실패 후 결과에서 다시 시도한다', async () => {
    const user = userEvent.setup();
    const onRetest = vi.fn();
    const { rerender } = render(<GureumiResultScreen result={result} onRetest={onRetest} retestStarting />);
    await user.click(screen.getByRole('button', { name: '새 테스트를 준비하고 있어요…' }));
    expect(onRetest).not.toHaveBeenCalled();
    rerender(<GureumiResultScreen result={result} onRetest={onRetest} actionError="연결하지 못했어요." />);
    expect(screen.getByRole('alert').textContent).toBe('연결하지 못했어요.');
    expect(screen.getByRole('heading', { name: '아롱이', level: 1 })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '다시 테스트하기' }));
    expect(onRetest).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: '카카오톡으로 결과 공유하기' })).toBeTruthy());
  });
});
