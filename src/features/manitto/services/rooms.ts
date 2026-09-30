import { readStoredValue, writeStoredValue } from '../../../utils/storage';
import type { RoomReference } from '../domain/types';

const KEY = 'ongi.manitto.rooms.v1';
export const isRoomCode = (value: string) => /^[2-9A-HJ-NP-Z]{12}$/.test(value);
export const normalizeRoomCode = (value: string) => value.toUpperCase().replace(/[\s-]/g, '');

export function loadManittoRooms(): RoomReference[] {
  const saved = readStoredValue(KEY);
  if (!Array.isArray(saved)) return [];
  return saved.filter((room): room is RoomReference =>
    room !== null && typeof room === 'object' && typeof room.code === 'string' && isRoomCode(room.code)
    && typeof room.title === 'string' && typeof room.expiresAt === 'string'
    && Date.parse(room.expiresAt) > Date.now(),
  );
}
export function rememberRoom(room: RoomReference) {
  writeStoredValue(KEY, [
    { code: room.code, title: room.title, expiresAt: room.expiresAt },
    ...loadManittoRooms().filter(({ code }) => code !== room.code),
  ]);
}
export function forgetRoom(code: string) {
  writeStoredValue(KEY, loadManittoRooms().filter((room) => room.code !== code));
}
export function invitedRoom(): string {
  const code = normalizeRoomCode(new URLSearchParams(window.location.search).get('manittoRoom') ?? '');
  return isRoomCode(code) ? code : '';
}
export function updateRoomUrl(code: string) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('manittoRoom', code);
  else url.searchParams.delete('manittoRoom');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
}
export function invitationUrl(code: string) {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ activity: 'manitto', manittoRoom: code }).toString();
  url.hash = '';
  return url.toString();
}
export async function copyInvitation(code: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(invitationUrl(code)); return true; }
  catch { return false; }
}
