import { assetUrl } from '../../../utils/assetUrl';
import {
  loadResultImageFile,
  preloadResultImage,
  saveResultImageFile,
  type ResultImageAction,
} from '../../../platform/resultImage';

export function getGureumiResultImageSrc(characterKey: string): string {
  return assetUrl(`images/results/gureumi/${characterKey}-story.png`);
}

function getGureumiResultImageFilename(characterKey: string): string {
  return `ongi-gureumi-${characterKey}.png`;
}

export function preloadGureumiResultImage(characterKey: string): Promise<File> {
  return preloadResultImage(
    getGureumiResultImageSrc(characterKey),
    getGureumiResultImageFilename(characterKey),
  );
}

export async function saveGureumiResultImage(
  characterKey: string,
): Promise<ResultImageAction> {
  const imageSrc = getGureumiResultImageSrc(characterKey);
  const file = await loadResultImageFile(
    imageSrc,
    getGureumiResultImageFilename(characterKey),
  );

  return saveResultImageFile(file, imageSrc);
}
