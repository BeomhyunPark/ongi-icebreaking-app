// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gureumiApi } from '../src/features/gureumi/api/gureumiApi';
import { useGureumiController } from '../src/features/gureumi/hooks/useGureumiController';
import { useGureumiAnswers } from '../src/features/gureumi/hooks/useGureumiAnswers';
import { GUREUMI_ATTEMPT_STORAGE_KEY } from '../src/features/gureumi/services/attemptStorage';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const created = {
  attemptId: '30000000-0000-4000-8000-000000000001',
  resumeToken: 'a'.repeat(44),
  version: 'v01',
  attemptNo: 1,
  startedAt: '',
};
const question = { questionId: 'q1', order: 1, prompt: '', optionA: '', optionB: '' };

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Gureumi asynchronous lifecycle', () => {
  it('does not create two attempts for same-tick double clicks or save a departed attempt', async () => {
    const request = deferred<typeof created>();
    const create = vi.spyOn(gureumiApi, 'createAttempt').mockReturnValue(request.promise);
    const getQuestions = vi.spyOn(gureumiApi, 'getQuestions');
    const { result, unmount } = renderHook(useGureumiController);
    await waitFor(() => expect(result.current.phase).toBe('intro'));
    let task!: Promise<void>;
    act(() => {
      task = result.current.createAndOpen();
      void result.current.createAndOpen();
    });
    expect(create).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {
      request.resolve(created);
      await task;
    });
    expect(getQuestions).not.toHaveBeenCalled();
    expect(localStorage.getItem(GUREUMI_ATTEMPT_STORAGE_KEY)).toBeNull();
  });
  it('keeps the saved attempt when starting fresh fails', async () => {
    localStorage.setItem(GUREUMI_ATTEMPT_STORAGE_KEY, JSON.stringify(created));
    vi.spyOn(gureumiApi, 'getCurrent').mockResolvedValue({
      ...created,
      completed: false,
      answeredCount: 1,
      nextOrder: 2,
      answers: [{ questionId: 'q1', choice: 'A_VERY' }],
    });
    vi.spyOn(gureumiApi, 'createAttempt').mockRejectedValue(new Error('offline'));
    const { result } = renderHook(useGureumiController);
    await waitFor(() => expect(result.current.resumeState?.answeredCount).toBe(1));
    await act(async () => {
      await result.current.createAndOpen();
    });
    expect(result.current.phase).toBe('intro');
    expect(result.current.busy).toBe(false);
    expect(result.current.error).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(GUREUMI_ATTEMPT_STORAGE_KEY)!)).toMatchObject({
      attemptId: created.attemptId,
    });
  });
  it('serializes same-question saves and ignores a failed save after answer reset', async () => {
    const request = deferred<Awaited<ReturnType<typeof gureumiApi.saveAnswer>>>();
    const save = vi.spyOn(gureumiApi, 'saveAnswer').mockReturnValue(request.promise);
    const questions = [question];
    const { result } = renderHook(() => useGureumiAnswers(created, questions));
    let task!: Promise<void>;
    act(() => {
      task = result.current.handleAnswer(question, 'A_VERY');
      void result.current.handleAnswer(question, 'B_VERY');
    });
    expect(save).toHaveBeenCalledTimes(1);
    act(() => result.current.resetAnswers([{ questionId: 'q1', choice: 'B_LITTLE' }]));
    await act(async () => {
      request.reject(new Error('late failure'));
      await task;
    });
    expect(result.current.answers.q1).toBe('B_LITTLE');
    expect(result.current.saveErrors).toEqual({});
    expect(result.current.pendingQuestionIds.size).toBe(0);
  });
});
