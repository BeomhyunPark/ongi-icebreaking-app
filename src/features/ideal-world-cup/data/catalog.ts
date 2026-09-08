import { WORLD_CUP_CANDIDATE_BY_ID, WORLD_CUP_CANDIDATES } from './candidates';
import { WORLD_CUP_CATEGORY_BY_ID, WORLD_CUP_CATEGORIES } from './categories';
import type {
  TournamentSize,
  WorldCupCandidate,
  WorldCupCategory,
  WorldCupCategoryId,
} from '../domain/types';

export const CANDIDATE_IDS = WORLD_CUP_CANDIDATES.map((candidate) => candidate.id);
export const VALID_CANDIDATE_IDS = new Set(CANDIDATE_IDS);
export const VALID_CATEGORY_IDS = new Set(WORLD_CUP_CATEGORIES.map((category) => category.id));
export const SIZE_OPTIONS: readonly TournamentSize[] = [64, 32, 16];

export const SIZE_COPY: Record<TournamentSize, string> = {
  64: '총 63번의 선택',
  32: '총 31번의 선택',
  16: '총 15번의 선택',
};

export function findCandidate(candidateId: string): WorldCupCandidate {
  const candidate = WORLD_CUP_CANDIDATE_BY_ID.get(candidateId);

  if (!candidate) {
    throw new Error(`월드컵 후보를 찾을 수 없습니다: ${candidateId}`);
  }

  return candidate;
}

export function findCategory(categoryId: WorldCupCategoryId): WorldCupCategory {
  const category = WORLD_CUP_CATEGORY_BY_ID.get(categoryId);

  if (!category) {
    throw new Error(`월드컵 주제를 찾을 수 없습니다: ${categoryId}`);
  }

  return category;
}
