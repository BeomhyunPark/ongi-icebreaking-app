type DeviceInfo = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
};

export type ResultImageAction = 'shared' | 'downloaded' | 'cancelled' | 'ios-help';

const resultImageFiles = new Map<string, Promise<File>>();

export function isIosLikeDevice(device: DeviceInfo): boolean {
  return (
    /iPad|iPhone|iPod/i.test(device.userAgent) ||
    (device.platform === 'MacIntel' && device.maxTouchPoints > 1)
  );
}

export function isAndroidDevice(device: Pick<DeviceInfo, 'userAgent'>): boolean {
  return /Android/i.test(device.userAgent);
}

function getCurrentDevice(): DeviceInfo {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  };
}

function isShareCancellation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

export function loadResultImageFile(imageSrc: string, filename: string): Promise<File> {
  const cachedFile = resultImageFiles.get(imageSrc);

  if (cachedFile) {
    return cachedFile;
  }

  const filePromise = fetch(imageSrc)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`결과 이미지를 불러오지 못했습니다. (${response.status})`);
      }

      return response.blob();
    })
    .then(
      (blob) =>
        new File([blob], filename, {
          type: blob.type || 'image/png',
        }),
    )
    .catch((error: unknown) => {
      resultImageFiles.delete(imageSrc);
      throw error;
    });

  resultImageFiles.set(imageSrc, filePromise);
  return filePromise;
}

export function preloadResultImage(imageSrc: string, filename: string): Promise<File> {
  return loadResultImageFile(imageSrc, filename);
}

function canShareResultFile(file: File): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }

  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function downloadResultFile(file: File): void {
  const objectUrl = URL.createObjectURL(file);
  const downloadLink = document.createElement('a');

  downloadLink.href = objectUrl;
  downloadLink.download = file.name;
  downloadLink.rel = 'noopener';
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function downloadResultImage(imageSrc: string, filename: string): void {
  const downloadLink = document.createElement('a');

  downloadLink.href = imageSrc;
  downloadLink.download = filename;
  downloadLink.rel = 'noopener';
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
}

export async function saveResultImageFile(
  file: File,
  imageSrc: string,
): Promise<ResultImageAction> {
  const device = getCurrentDevice();
  const isIos = isIosLikeDevice(device);

  if (isAndroidDevice(device)) {
    downloadResultImage(imageSrc, file.name);
    return 'downloaded';
  }

  if (canShareResultFile(file)) {
    try {
      await navigator.share({
        files: [file],
      });
      return 'shared';
    } catch (error: unknown) {
      if (isShareCancellation(error)) {
        return 'cancelled';
      }

      if (isIos) {
        return 'ios-help';
      }
    }
  } else if (isIos) {
    return 'ios-help';
  }

  downloadResultFile(file);
  return 'downloaded';
}

export async function shareResultImageFile(
  file: File,
  imageSrc: string,
): Promise<ResultImageAction> {
  if (canShareResultFile(file)) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (error) {
      if (isShareCancellation(error)) return 'cancelled';
      throw error;
    }
  }
  return saveResultImageFile(file, imageSrc);
}
