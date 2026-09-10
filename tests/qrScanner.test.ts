// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { invitationCode, startQrScanner } from '../src/features/anonymous-sharing/services/qrScanner';

const base = 'https://ongi.greengroove.app/';
afterEach(() => vi.restoreAllMocks());
it('온기 초대만 수락하고 다른 주소와 잘못된 코드를 거부한다', () => {
  expect(invitationCode(`${base}?activity=anonymous-sharing#join=7KFM-3QPX`, base)).toBe('7KFM-3QPX');
  for (const value of [
    'https://elsewhere.test/?activity=anonymous-sharing#join=7KFM-3QPX',
    `${base}?activity=anonymous-sharing#join=7KFM-3QPX-extra`,
    `${base}?activity=other#join=7KFM-3QPX`,
    `${base}other?activity=anonymous-sharing#join=7KFM-3QPX`,
    'javascript:alert(1)', '7KFM-3QPX',
  ]) expect(invitationCode(value, base)).toBeNull();
});
it('카메라 허용 응답이 뒤로 가기보다 늦어도 열린 트랙을 즉시 닫는다', async () => {
  let resolve!: (stream: MediaStream) => void;
  const stop = vi.fn();
  const getUserMedia = vi.fn(() => new Promise<MediaStream>((done) => { resolve = done; }));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
  const controller = new AbortController();
  const video = document.createElement('video');
  const scan = vi.fn();
  const pending = startQrScanner(video, controller.signal, scan);
  controller.abort();
  resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await pending;
  expect(stop).toHaveBeenCalledOnce();
  expect(video.srcObject).toBeNull();
  expect(scan).not.toHaveBeenCalled();
  expect(getUserMedia.mock.calls[0]).toEqual([{ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }]);
});
