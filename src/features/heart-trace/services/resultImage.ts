import type { ResultTypeId } from '../domain/types';

export {
  isIosLikeDevice,
  isAndroidDevice,
  loadResultImageFile,
  preloadResultImage,
  saveResultImageFile,
  shareResultImageFile,
  type ResultImageAction,
} from '../../../platform/resultImage';

export function getResultImageFilename(resultId: ResultTypeId): string {
  return `result-${resultId}.png`;
}
