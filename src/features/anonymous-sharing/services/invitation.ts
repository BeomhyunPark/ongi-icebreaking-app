export function joinUrl(roomCode: string): string {
  const url = new URL(window.location.href);
  url.search = '?activity=anonymous-sharing';
  url.hash = `join=${encodeURIComponent(roomCode)}`;
  return url.href;
}
