import { assetUrl } from '../../../utils/assetUrl';

const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js';
const KAKAO_SDK_INTEGRITY = 'sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy';
const KAKAO_SCRIPT_ID = 'kakao-javascript-sdk';

type KakaoSharePayload = {
  name: string;
  descriptor: string;
  characterKey: string;
};

type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: {
    createDefaultButton?: (settings: KakaoShareSettings & { container: string }) => void;
    sendDefault: (settings: {
      objectType: KakaoShareSettings['objectType'];
      content: KakaoShareSettings['content'];
      buttons: KakaoShareSettings['buttons'];
    }) => void;
  };
};

type KakaoShareSettings = {
  objectType: 'feed';
  content: {
    title: string;
    description: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    link: { mobileWebUrl: string; webUrl: string };
  };
  buttons: Array<{
    title: string;
    link: { mobileWebUrl: string; webUrl: string };
  }>;
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

export type GureumiShareResult =
  | 'kakao'
  | 'native'
  | 'copied'
  | 'cancelled'
  | 'failed';

let kakaoSdkPromise: Promise<KakaoSdk> | null = null;

function getTestUrl(): string {
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  return new URL('share/gureumi/', canonical ?? window.location.href).href;
}

function getAbsoluteImageUrl(characterKey: string): string {
  return new URL(
    assetUrl(`images/results/gureumi/${characterKey}-story.png`),
    window.location.href,
  ).href;
}

function getJavascriptKey(): string | undefined {
  return import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim() || undefined;
}

function loadKakaoSdk(): Promise<KakaoSdk> {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  if (kakaoSdkPromise) return kakaoSdkPromise;

  const pendingSdk = new Promise<KakaoSdk>((resolve, reject) => {
    const existing = document.getElementById(KAKAO_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    const handleLoad = () => {
      if (window.Kakao) resolve(window.Kakao);
      else reject(new Error('KAKAO_SDK_UNAVAILABLE'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', () => reject(new Error('KAKAO_SDK_LOAD_FAILED')), { once: true });

    if (!existing) {
      script.id = KAKAO_SCRIPT_ID;
      script.src = KAKAO_SDK_URL;
      script.integrity = KAKAO_SDK_INTEGRITY;
      script.crossOrigin = 'anonymous';
      document.head.append(script);
    }
  });

  const cachedSdk = pendingSdk.catch((error: unknown) => {
    kakaoSdkPromise = null;
    throw error;
  });
  kakaoSdkPromise = cachedSdk;

  return cachedSdk;
}

function isShareCancellation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError';
}

async function copyShareText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

async function shareWithDevice(
  payload: KakaoSharePayload,
  testUrl: string,
): Promise<GureumiShareResult> {
  const text = `나는 ${payload.name}!\n${payload.descriptor.replaceAll('\n', ' ')}\n\n테스트하러 가기\n${testUrl}`;

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `나는 ${payload.name}! | 구르미 테스트`,
        text,
        url: testUrl,
      });
      return 'native';
    } catch (error: unknown) {
      if (isShareCancellation(error)) return 'cancelled';
    }
  }

  return await copyShareText(text) ? 'copied' : 'failed';
}

function getKakaoShareSettings(payload: KakaoSharePayload, testUrl: string): KakaoShareSettings {
  return {
    objectType: 'feed',
    content: {
      title: `나는 ${payload.name}!`,
      description: payload.descriptor.replaceAll('\n', ' '),
      imageUrl: getAbsoluteImageUrl(payload.characterKey),
      imageWidth: 1080,
      imageHeight: 1920,
      link: { mobileWebUrl: testUrl, webUrl: testUrl },
    },
    buttons: [{
      title: '테스트하러 가기',
      link: { mobileWebUrl: testUrl, webUrl: testUrl },
    }],
  };
}

function sendWithKakao(kakao: KakaoSdk, javascriptKey: string, payload: KakaoSharePayload, testUrl: string) {
  if (!kakao.isInitialized()) kakao.init(javascriptKey);
  kakao.Share.sendDefault(getKakaoShareSettings(payload, testUrl));
}

export async function prepareGureumiKakaoShare(): Promise<boolean> {
  const javascriptKey = getJavascriptKey();
  if (!javascriptKey) return false;
  try {
    const kakao = await loadKakaoSdk();
    if (!kakao.isInitialized()) kakao.init(javascriptKey);
    return true;
  } catch {
    return false;
  }
}

export async function bindGureumiKakaoShareButton(
  container: string,
  payload: KakaoSharePayload,
): Promise<boolean> {
  const javascriptKey = getJavascriptKey();
  if (!javascriptKey) return false;

  try {
    const kakao = await loadKakaoSdk();
    if (!kakao.isInitialized()) kakao.init(javascriptKey);
    if (!kakao.Share.createDefaultButton) return false;
    kakao.Share.createDefaultButton({
      container,
      ...getKakaoShareSettings(payload, getTestUrl()),
    });
    return true;
  } catch {
    return false;
  }
}

export async function shareGureumiResult(
  payload: KakaoSharePayload,
): Promise<GureumiShareResult> {
  const testUrl = getTestUrl();
  const javascriptKey = getJavascriptKey();

  if (javascriptKey) {
    try {
      // When preloaded, this branch stays synchronous so iOS keeps the tap's popup permission.
      if (window.Kakao) {
        sendWithKakao(window.Kakao, javascriptKey, payload, testUrl);
        return 'kakao';
      }
      const kakao = await loadKakaoSdk();
      sendWithKakao(kakao, javascriptKey, payload, testUrl);
      return 'kakao';
    } catch {
      // SDK/domain failures fall back to the device share sheet.
    }
  }

  return shareWithDevice(payload, testUrl);
}
