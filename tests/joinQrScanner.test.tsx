// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { JoinQrScanner } from '../src/features/anonymous-sharing/components/JoinQrScanner';
import { startQrScanner } from '../src/features/anonymous-sharing/services/qrScanner';
vi.mock('../src/features/anonymous-sharing/services/qrScanner', async (original) => ({
  ...await original<typeof import('../src/features/anonymous-sharing/services/qrScanner')>(),
  startQrScanner: vi.fn(),
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('카메라 권한 거절을 안내하고 다시 시도할 수 있다', async () => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  vi.mocked(startQrScanner).mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
  render(<JoinQrScanner onJoinCode={vi.fn()} />);
  expect((await screen.findByRole('alert')).textContent).toContain('카메라 권한이 필요해요');
  fireEvent.click(screen.getByRole('button', { name: '카메라 다시 켜기' }));
  await waitFor(() => expect(startQrScanner).toHaveBeenCalledTimes(2));
});
it('다른 QR은 계속 스캔하고 초대 QR 인식 후 카메라를 중단한다', async () => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  vi.mocked(startQrScanner).mockResolvedValue();
  const onJoin = vi.fn();
  render(<JoinQrScanner onJoinCode={onJoin} />);
  const [, signal, scan] = vi.mocked(startQrScanner).mock.calls[0];
  await act(async () => scan('https://example.com/'));
  expect(onJoin).not.toHaveBeenCalled();
  expect(signal.aborted).toBe(false);
  await act(async () => scan(`${window.location.origin}/?activity=anonymous-sharing#join=7KFM-3QPX`));
  expect(onJoin).toHaveBeenCalledWith('7KFM-3QPX');
  expect(signal.aborted).toBe(true);
});
