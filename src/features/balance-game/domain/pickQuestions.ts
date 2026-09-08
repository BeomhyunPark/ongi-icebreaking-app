import { BALANCE_GAME_QUESTIONS } from '../data/questions';
import type { BalanceGameQuestion, BalanceGameWeight } from './types';

const RANDOM_QUESTION_COUNT = 5;

export function pickRandomQuestions(
  weight: BalanceGameWeight,
  random = Math.random,
): readonly BalanceGameQuestion[] {
  const questions = BALANCE_GAME_QUESTIONS.filter((question) => question.weight === weight);

  for (let index = questions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(random() * (index + 1)));
    [questions[index], questions[swapIndex]] = [questions[swapIndex], questions[index]];
  }

  return questions.slice(0, RANDOM_QUESTION_COUNT);
}
