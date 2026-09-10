/** Only accept this app's room invitations; never navigate to arbitrary scanned URLs. */
export function invitationCode(value: string, baseUrl = window.location.href): string | null {
  try {
    const base = new URL(baseUrl);
    const url = new URL(value);
    const code = new URLSearchParams(url.hash.slice(1)).get('join');
    if (url.origin !== base.origin || url.pathname !== base.pathname ||
        url.searchParams.get('activity') !== 'anonymous-sharing' ||
        !code || !/^[A-Z0-9]{4}-?[A-Z0-9]{4}$/.test(code)) return null;
    return code;
  } catch {
    return null;
  }
}

export async function startQrScanner(
  video: HTMLVideoElement,
  signal: AbortSignal,
  onScan: (value: string) => void,
): Promise<void> {
  let stream: MediaStream | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    clearTimeout(timer);
    stream?.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  };
  if (signal.aborted) return;
  signal.addEventListener('abort', stop, { once: true });
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    if (signal.aborted) { stop(); return; }
    video.srcObject = stream;
    const { default: jsQR } = await import('jsqr');
    if (signal.aborted) { stop(); return; }
    await video.play();
    if (signal.aborted) { stop(); return; }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Camera canvas unavailable');
    const scan = () => {
      if (signal.aborted) return;
      if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
        const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = context.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' });
        if (result) onScan(result.data);
      }
      if (!signal.aborted) timer = setTimeout(scan, 180);
    };
    scan();
  } catch (error) {
    stop();
    signal.removeEventListener('abort', stop);
    if (!signal.aborted) throw error;
  }
}
