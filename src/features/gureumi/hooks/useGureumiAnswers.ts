import { useEffect, useRef, useState } from 'react';
import { gureumiApi } from '../api/gureumiApi';
import type {
  GureumiAnswer,
  GureumiAttemptReference,
  GureumiChoice,
  GureumiQuestion,
} from '../domain/types';
import { errorMessage } from '../services/errorMessage';

function answersByQuestion(answers: GureumiAnswer[]): Partial<Record<string, GureumiChoice>> {
  return Object.fromEntries(answers.map(({ questionId, choice }) => [questionId, choice]));
}

export function useGureumiAnswers(
  reference: GureumiAttemptReference | null,
  currentQuestions: GureumiQuestion[],
) {
  const [answers, setAnswers] = useState<Partial<Record<string, GureumiChoice>>>({});
  const [pendingQuestionIds, setPendingQuestionIds] = useState<Set<string>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Partial<Record<string, string>>>({});
  const pageEnteredAt = useRef<Record<string, number>>({});
  const generation = useRef(0);
  const pending = useRef(new Set<string>());

  useEffect(() => {
    generation.current++;
    pending.current.clear();
    return () => {
      generation.current++;
      pending.current.clear();
    };
  }, [reference?.attemptId]);

  useEffect(() => {
    const now = Date.now();
    pageEnteredAt.current = Object.fromEntries(
      currentQuestions.map(({ questionId }) => [questionId, now]),
    );
  }, [currentQuestions]);

  const handleAnswer = async (question: GureumiQuestion, choice: GureumiChoice) => {
    if (!reference || pending.current.has(question.questionId)) return;
    pending.current.add(question.questionId);
    const requestGeneration = generation.current;
    const active = () => requestGeneration === generation.current;
    const previousChoice = answers[question.questionId];
    const responseMs = Math.min(
      3_600_000,
      Math.max(0, Date.now() - (pageEnteredAt.current[question.questionId] ?? Date.now())),
    );

    setAnswers((current) => ({ ...current, [question.questionId]: choice }));
    setSaveErrors((current) => ({ ...current, [question.questionId]: undefined }));
    setPendingQuestionIds((current) => new Set(current).add(question.questionId));
    try {
      await gureumiApi.saveAnswer(reference.attemptId, reference.resumeToken, {
        questionId: question.questionId,
        choice,
        responseMs,
      });
    } catch (saveError) {
      if (!active()) return;
      setAnswers((current) => {
        const next = { ...current };
        if (previousChoice) next[question.questionId] = previousChoice;
        else delete next[question.questionId];
        return next;
      });
      setSaveErrors((current) => ({
        ...current,
        [question.questionId]: errorMessage(saveError),
      }));
    } finally {
      if (active()) {
        pending.current.delete(question.questionId);
        setPendingQuestionIds((current) => {
          const next = new Set(current);
          next.delete(question.questionId);
          return next;
        });
      }
    }
  };

  return {
    answers,
    pendingQuestionIds,
    saveErrors,
    handleAnswer,
    resetAnswers: (saved: GureumiAnswer[]) => {
      generation.current++;
      pending.current.clear();
      setAnswers(answersByQuestion(saved));
      setPendingQuestionIds(new Set());
      setSaveErrors({});
    },
    reportSaveError: (questionId: string, message: string) =>
      setSaveErrors((current) => ({ ...current, [questionId]: message })),
  };
}
