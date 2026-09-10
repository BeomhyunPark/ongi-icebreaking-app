// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AnonymousSharingApp } from '../src/features/anonymous-sharing/AnonymousSharingApp';
import { sharingApi } from '../src/features/anonymous-sharing/api/sharingApi';

vi.mock('../src/features/anonymous-sharing/hooks/useRoomEvents', () => ({ useRoomEvents: () => false }));
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  history.replaceState({}, '', `/?activity=anonymous-sharing#room=${id}`);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
  vi.spyOn(sharingApi, 'getState').mockResolvedValue({
    roomId: id, title: '모임', status: 'WRITING', role: 'PARTICIPANT', version: 1,
    participantCount: 2, completedParticipantCount: 0, participantJoined: true,
    responseCompleted: false, currentRound: 0, totalRounds: 0, expiresAt: '2099-01-01T00:00:00Z',
  });
  vi.spyOn(sharingApi, 'getQuestions').mockResolvedValue({ questions: [{ id: 'q1', position: 1, prompt: '첫 질문' }] });
  vi.spyOn(sharingApi, 'getMyResponses').mockResolvedValue({ answers: [], completed: false });
  vi.spyOn(sharingApi, 'saveResponses').mockResolvedValue({ answers: [], completed: false });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('취소·실패 시 답변을 보존하고 나가기 성공 후에만 모임과 초안을 지운다', async () => {
  const leave = vi.spyOn(sharingApi, 'leaveRoom').mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ left: true });
  render(<AnonymousSharingApp onBackHome={vi.fn()} />);
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: '작성 중인 답변' } });
  fireEvent.click(screen.getByRole('button', { name: '모임 나가기' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '계속 작성하기' }));
  expect(leave).not.toHaveBeenCalled();
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('작성 중인 답변');
  fireEvent.click(screen.getByRole('button', { name: '모임 나가기' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '모임 나가기' }));
  await screen.findByRole('alert');
  expect(sessionStorage.getItem(`ongi.sharing-draft.${id}`)).toContain('작성 중인 답변');
  await waitFor(() => expect((within(screen.getByRole('dialog')).getByRole('button', { name: '모임 나가기' }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '모임 나가기' }));
  await screen.findByRole('button', { name: '모임 참여하기' });
  expect(leave).toHaveBeenCalledTimes(2);
  expect(sessionStorage.getItem(`ongi.sharing-draft.${id}`)).toBeNull();
  expect(localStorage.getItem('ongi.anonymous-sharing.room.v1')).toBeNull();
  expect(location.hash).toBe('');
});
