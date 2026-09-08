import type { BalanceGameCategory, BalanceGameWeight } from '../domain/types';

export const CATEGORY_LABELS: Record<BalanceGameCategory, string> = {
  daily: '일상 · 성향',
  faith: '교회 · 신앙',
};

export const FILTER_LABELS: Record<BalanceGameWeight, Record<BalanceGameCategory, string>> = {
  light: CATEGORY_LABELS,
  deep: {
    daily: '일상 · 관계',
    faith: '신앙 · 공동체',
  },
};
