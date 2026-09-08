import type { RoomState } from './types';

export type SharingScreen = 'host-lobby' | 'writing' | 'waiting' | 'story' | 'completed' | 'idle';

export function selectSharingScreen(room: RoomState, hostWriting: boolean): SharingScreen {
  if (room.status === 'COMPLETED') return 'completed';
  if (room.status === 'SHARING') return 'story';
  if (room.role === 'HOST' && !hostWriting) return 'host-lobby';
  if (room.status === 'WRITING' || room.status === 'LOCKED') {
    if (room.participantJoined && !room.responseCompleted) return 'writing';
    if (room.role === 'PARTICIPANT' && room.responseCompleted) return 'waiting';
  }
  return 'idle';
}
