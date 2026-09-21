const STORAGE_KEY = 'ongi.anonymous-sharing.room.v1';

export function loadRoomReference(): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveRoomReference(roomId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, roomId);
  } catch {
    // A room remains recoverable from the URL even when storage is unavailable.
  }
}

export function clearRoomReference(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

export function readSharingHash(hash = window.location.hash): { roomId: string | null; joinCode: string | null } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const roomId = params.get('room');
  const joinCode = params.get('join');
  return {
    roomId: roomId && /^[0-9a-f-]{36}$/i.test(roomId) ? roomId : null,
    joinCode: joinCode?.slice(0, 9) ?? null,
  };
}

function updateSharingHash(kind: 'room' | 'join' | null, value: string | undefined, action: 'push' | 'replace'): void {
  const url = new URL(window.location.href);
  url.hash = kind && value ? `${kind}=${encodeURIComponent(value)}` : '';
  window.history[`${action}State`](window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

export function replaceSharingHash(kind: 'room' | 'join' | null, value?: string): void {
  updateSharingHash(kind, value, 'replace');
}

export function pushSharingHash(kind: 'room' | 'join', value: string): void {
  updateSharingHash(kind, value, 'push');
}
