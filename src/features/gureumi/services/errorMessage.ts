import { GureumiApiError } from '../api/gureumiApi';

export function errorMessage(error: unknown): string {
  return error instanceof GureumiApiError
    ? error.message
    : '구르미 테스트를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
}
