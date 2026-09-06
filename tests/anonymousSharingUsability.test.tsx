// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AnonymousSharingApp } from '../src/features/anonymous-sharing/AnonymousSharingApp';
import { sharingApi } from '../src/features/anonymous-sharing/api/sharingApi';

const events = vi.hoisted(() => ({ refresh: () => {} }));
vi.mock('../src/features/anonymous-sharing/hooks/useRoomEvents', () => ({
  useRoomEvents: (_: unknown, refresh: () => void) => { events.refresh = refresh; return false; },
}));
const id = '11111111-1111-4111-8111-111111111111';
const room = {
  roomId: id, title: '사용성 확인', status: 'WRITING' as const, role: 'PARTICIPANT' as const,
  version: 1, participantCount: 2, completedParticipantCount: 0, participantJoined: true,
  responseCompleted: false, currentRound: 0, totalRounds: 2,
  expiresAt: '2099-01-01T00:00:00Z',
};
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear();
  window.history.replaceState({}, '', `/?activity=anonymous-sharing#room=${id}`);
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  Reflect.deleteProperty(Element.prototype, 'scrollTo');
});

it('자동 저장 전에 재진입해도 초안을 복원하고 실시간 갱신이 입력을 덮어쓰지 않는다', async () => {
  vi.spyOn(sharingApi, 'getState').mockResolvedValue(room);
  vi.spyOn(sharingApi, 'getQuestions').mockResolvedValue({ questions: [{ id: 'q1', position: 1, prompt: '첫 질문' }] });
  vi.spyOn(sharingApi, 'getMyResponses').mockResolvedValue({ answers: [], completed: false });
  const save = vi.spyOn(sharingApi, 'saveResponses').mockResolvedValue({ answers: [], completed: false });
  const view = render(<AnonymousSharingApp onBackHome={() => {}} />);
  fireEvent.change(await screen.findByRole('textbox'), { target: { value: '사라지면 안 되는 답변' } });
  view.unmount();
  render(<AnonymousSharingApp onBackHome={() => {}} />);
  await waitFor(() => expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('사라지면 안 되는 답변'));
  events.refresh();
  await waitFor(() => expect(save).toHaveBeenCalledWith(id, [{ questionId: 'q1', answer: '사라지면 안 되는 답변' }]));
  expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('사라지면 안 되는 답변');
});

it('완료 후 다시 수정하면 작성 화면을 열고 다시 완료할 수 있다', async () => {
  let completed = true;
  vi.spyOn(sharingApi, 'getState').mockImplementation(async () => ({ ...room, responseCompleted: completed }));
  vi.spyOn(sharingApi, 'getQuestions').mockResolvedValue({ questions: [{ id: 'q1', position: 1, prompt: '첫 질문' }] });
  vi.spyOn(sharingApi, 'getMyResponses').mockResolvedValue({ answers: [{ questionId: 'q1', answer: '기존 답변' }], completed: false });
  vi.spyOn(sharingApi, 'reopenResponses').mockImplementation(async () => { completed = false; return { answers: [], completed }; });
  vi.spyOn(sharingApi, 'saveResponses').mockResolvedValue({ answers: [], completed: false });
  vi.spyOn(sharingApi, 'completeResponses').mockImplementation(async () => { completed = true; return { answers: [], completed }; });
  render(<AnonymousSharingApp onBackHome={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: '내 답변 확인·수정' }));
  expect((await screen.findByRole('textbox') as HTMLTextAreaElement).value).toBe('기존 답변');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '수정 답변' } });
  fireEvent.click(screen.getByRole('button', { name: '작성 완료' }));
  await screen.findByRole('heading', { name: '이제 서로를 기다려요' });
  expect(sessionStorage.getItem(`ongi.sharing-draft.${id}`)).toBeNull();
});

it('다른 참여자의 공개 이벤트에도 맨 위로 이동하고 공개된 이름에 초점을 둔다', async () => {
  let revealed = false;
  const scroll = vi.fn();
  const scrollContainer = vi.fn();
  Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: scrollContainer });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: scroll });
  vi.spyOn(sharingApi, 'getState').mockResolvedValue({ ...room, status: 'SHARING', responseCompleted: true });
  vi.spyOn(sharingApi, 'getCurrentSharing').mockImplementation(async () => ({
    state: revealed ? 'REVEALED' : 'ANONYMOUS', sequence: 0, total: 2,
    answers: [{ question: '첫 질문', answer: '긴 이야기' }],
    participantName: revealed ? '은혜' : undefined, canReveal: false, roomVersion: 2,
  }));
  render(<AnonymousSharingApp onBackHome={() => {}} />);
  await screen.findByRole('button', { name: '이거 저예요' });
  scroll.mockClear(); scrollContainer.mockClear();
  revealed = true; events.refresh();
  const title = await screen.findByRole('heading', { name: '은혜님의 이야기예요' });
  expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' });
  expect(scrollContainer).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  expect(document.activeElement).toBe(title);
  expect(screen.queryByRole('button', { name: '이거 저예요' })).toBeNull();
});
