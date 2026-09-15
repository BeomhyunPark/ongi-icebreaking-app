// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { bindGureumiKakaoShareButton, shareGureumiResult } from '../src/features/gureumi/services/kakaoShare';

afterEach(() => {
  delete window.Kakao;
  vi.unstubAllEnvs();
});

describe('구르미 카카오톡 공유', () => {
  it('공식 SDK가 결과 공유 버튼의 클릭 이벤트를 직접 연결한다', async () => {
    vi.stubEnv('VITE_KAKAO_JAVASCRIPT_KEY', '0123456789abcdef0123456789abcdef');
    const createDefaultButton = vi.fn();
    window.Kakao = {
      init: vi.fn(),
      isInitialized: () => true,
      Share: { createDefaultButton, sendDefault: vi.fn() },
    };

    const bound = await bindGureumiKakaoShareButton('#share-button', {
      name: '아롱이',
      descriptor: '사람과 새로움에\n즐겁게 뛰어드는 열정가',
      characterKey: 'arong',
    });

    expect(bound).toBe(true);
    expect(createDefaultButton).toHaveBeenCalledWith(expect.objectContaining({
      container: '#share-button',
      objectType: 'feed',
      content: expect.objectContaining({
        imageUrl: expect.stringContaining('/images/results/gureumi/arong-story.png'),
      }),
      buttons: [{
        title: '테스트하러 가기',
        link: expect.objectContaining({ mobileWebUrl: expect.stringContaining('/share/gureumi/') }),
      }],
    }));
  });

  it('미리 로드된 SDK를 탭 시점에 바로 호출하고 결과 이미지와 테스트 링크를 보낸다', async () => {
    vi.stubEnv('VITE_KAKAO_JAVASCRIPT_KEY', '0123456789abcdef0123456789abcdef');
    const init = vi.fn();
    const sendDefault = vi.fn();
    window.Kakao = {
      init,
      isInitialized: () => false,
      Share: { sendDefault },
    };

    const action = await shareGureumiResult({
      name: '아롱이',
      descriptor: '사람과 새로움에\n즐겁게 뛰어드는 열정가',
      characterKey: 'arong',
    });

    expect(action).toBe('kakao');
    expect(init).toHaveBeenCalledTimes(1);
    expect(sendDefault).toHaveBeenCalledWith(expect.objectContaining({
      objectType: 'feed',
      content: expect.objectContaining({
        title: '나는 아롱이!',
        description: '사람과 새로움에 즐겁게 뛰어드는 열정가',
        imageUrl: expect.stringContaining('/images/results/gureumi/arong-story.png'),
      }),
      buttons: [{
        title: '테스트하러 가기',
        link: expect.objectContaining({ mobileWebUrl: expect.stringContaining('/share/gureumi/') }),
      }],
    }));
  });
});
