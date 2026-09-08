import { QUESTIONS } from '../data/questions';
import { MAX_SKIPPED_ANSWERS, countSkippedAnswers } from '../domain/answers';
import {
  RESULT_TYPE_IDS,
  type Answers,
  type ChoiceId,
  type ResultTypeId,
} from '../domain/types';
import type { TestState } from '../state/testReducer';
import { readStoredValue, writeStoredValue } from '../../../utils/storage';

const HEART_TRACE_SESSION_KEY = 'ongi.heart-trace.session.v1';

type StoredHeartTraceSession = {
  version: 1;
  state: TestState;
};

function parseAnswers(value: unknown): Answers | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const answers: Answers = {};

  for (const [questionIdText, answerValue] of Object.entries(value)) {
    const questionId = Number(questionIdText);
    const question = QUESTIONS.find(({ id }) => id === questionId);

    if (!question || !answerValue || typeof answerValue !== 'object' || Array.isArray(answerValue)) {
      return null;
    }

    const answer = answerValue as { kind?: unknown; optionId?: unknown };

    if (answer.kind === 'skipped') {
      answers[questionId] = { kind: 'skipped' };
      continue;
    }

    if (
      answer.kind === 'selected'
      && typeof answer.optionId === 'string'
      && question.options.some(({ id }) => id === answer.optionId)
    ) {
      answers[questionId] = { kind: 'selected', optionId: answer.optionId as ChoiceId };
      continue;
    }

    return null;
  }

  return countSkippedAnswers(answers) <= MAX_SKIPPED_ANSWERS ? answers : null;
}

export function parseHeartTraceSession(serialized: string): TestState | null {
  try {
    const parsed = JSON.parse(serialized) as Partial<StoredHeartTraceSession>;
    const state = parsed.state;

    if (
      parsed.version !== 1
      || !state
      || !['question', 'tie-breaker', 'result'].includes(state.phase)
      || !Number.isInteger(state.currentQuestionIndex)
      || state.currentQuestionIndex < 0
      || state.currentQuestionIndex >= QUESTIONS.length
      || (state.phase !== 'result' && state.result !== null)
      || !Array.isArray(state.tiedTypes)
    ) {
      return null;
    }

    const answers = parseAnswers(state.answers);
    const validResultTypes = new Set<ResultTypeId>(RESULT_TYPE_IDS);
    const tiedTypes = state.tiedTypes.filter(
      (resultType): resultType is ResultTypeId => validResultTypes.has(resultType),
    );

    if (
      !answers
      || tiedTypes.length !== state.tiedTypes.length
      || new Set(tiedTypes).size !== tiedTypes.length
      || (state.phase === 'tie-breaker' && tiedTypes.length < 2)
      || (state.phase === 'result' && (
        !validResultTypes.has(state.result as ResultTypeId)
        || Object.keys(answers).length !== QUESTIONS.length
      ))
    ) {
      return null;
    }

    return {
      phase: state.phase,
      currentQuestionIndex: state.currentQuestionIndex,
      answers,
      result: state.phase === 'result' ? state.result : null,
      tiedTypes,
    };
  } catch {
    return null;
  }
}

export function loadHeartTraceSession(): TestState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const stored = readStoredValue(HEART_TRACE_SESSION_KEY);
  return stored ? parseHeartTraceSession(JSON.stringify(stored)) : null;
}

export function saveHeartTraceSession(state: TestState): void {
  if (typeof window === 'undefined') {
    return;
  }

  const session: StoredHeartTraceSession = { version: 1, state };
  writeStoredValue(HEART_TRACE_SESSION_KEY, session);
}

export function clearHeartTraceSession(): void {
  if (typeof window !== 'undefined') {
    writeStoredValue(HEART_TRACE_SESSION_KEY, null);
  }
}
