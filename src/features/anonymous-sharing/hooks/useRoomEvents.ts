import { useEffect, useState } from 'react';

import { roomEventsUrl } from '../api/sharingApi';

const ROOM_EVENTS = [
  'PARTICIPANT_JOINED',
  'PARTICIPANT_PROGRESS_CHANGED',
  'ROOM_ACCESS_CHANGED',
  'SHARING_STARTED',
  'ROUND_CHANGED',
  'PROFILE_REVEALED',
  'ROOM_CANCELLED',
  'ROOM_COMPLETED',
] as const;
export type RoomEventName = typeof ROOM_EVENTS[number] | 'CONNECTED';

export function useRoomEvents(roomId: string | null, onRoomEvent: (event: RoomEventName) => void) {
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (!roomId || typeof EventSource === 'undefined') {
      setReconnecting(false);
      return undefined;
    }

    let eventSource: EventSource | null = null;
    const handlers = ROOM_EVENTS.map((eventName) => ({
      eventName,
      handler: () => onRoomEvent(eventName),
    }));
    const handleOpen = () => {
      setReconnecting(false);
      // SSE has no replay: fetch changes missed while disconnected, including
      // changes between the initial snapshot and the first subscription.
      onRoomEvent('CONNECTED');
    };
    const handleError = () => setReconnecting(true);
    const disconnect = () => {
      const source = eventSource;
      if (!source) return;
      handlers.forEach(({ eventName, handler }) => source.removeEventListener(eventName, handler));
      source.removeEventListener('CONNECTED', handleOpen);
      source.onerror = null;
      source.close();
      eventSource = null;
    };
    const connect = () => {
      disconnect();
      const source = new EventSource(roomEventsUrl(roomId), { withCredentials: true });
      eventSource = source;
      source.addEventListener('CONNECTED', handleOpen);
      handlers.forEach(({ eventName, handler }) => source.addEventListener(eventName, handler));
      source.onerror = handleError;
    };
    const handleOffline = () => {
      disconnect();
      setReconnecting(true);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', connect);
    if (navigator.onLine) connect();
    else handleOffline();

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', connect);
      disconnect();
    };
  }, [onRoomEvent, roomId]);

  return reconnecting;
}
