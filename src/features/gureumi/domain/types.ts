export const GUREUMI_QUESTION_COUNT = 27;
export const GUREUMI_PAGE_SIZE = 5;

export type GureumiChoice = 'A_VERY' | 'A_LITTLE' | 'B_LITTLE' | 'B_VERY';

export type GureumiQuestion = {
  questionId: string;
  order: number;
  prompt: string;
  optionA: string;
  optionB: string;
};

export type GureumiAnswer = {
  questionId: string;
  choice: GureumiChoice;
};

export type CreatedGureumiAttempt = {
  attemptId: string;
  resumeToken: string;
  version: string;
  attemptNo: number;
  startedAt: string;
};

export type GureumiAttemptState = {
  attemptId: string;
  version: string;
  attemptNo: number;
  completed: boolean;
  answeredCount: number;
  nextOrder: number;
  answers: GureumiAnswer[];
  startedAt: string;
  completedAt?: string;
};

export type GureumiQuestionsResponse = {
  version: string;
  questions: GureumiQuestion[];
};

export type GureumiResultType =
  | 'ARONG'
  | 'DALMONG'
  | 'HOOWOO'
  | 'SUNNY'
  | 'CHOKCHOK'
  | 'MONGSIL'
  | 'ELECTRIC'
  | 'POGEUN';

export type TraitLevel = 'LOW' | 'HIGH';

export type GureumiResult = {
  attemptId: string;
  version: string;
  resultType: GureumiResultType;
  characterKey: string;
  displayName: string;
  axes: Array<{
    key: 'NOVELTY' | 'WORRY' | 'RELATION';
    label: string;
    level: TraitLevel;
  }>;
  feedbackRating?: number;
};

export type GureumiAttemptReference = {
  attemptId: string;
  resumeToken: string;
};
