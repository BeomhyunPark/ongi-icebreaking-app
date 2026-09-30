import { useEffect, useRef, useState } from 'react';
import { ManittoApiError, manittoApi } from '../api/manittoApi';
import type { ManittoRoom } from '../domain/types';
import { forgetRoom, invitedRoom, loadManittoRooms, rememberRoom, updateRoomUrl } from '../services/rooms';

export function useManitto() {
  const [rooms, setRooms] = useState(loadManittoRooms);
  const [code, setCode] = useState(invitedRoom);
  const [room, setRoom] = useState<ManittoRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(code));
  const [error, setError] = useState('');
  const [needsJoin, setNeedsJoin] = useState(false);
  const alive = useRef(false);
  const epoch = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; epoch.current++; };
  }, []);

  const apply = (next: ManittoRoom) => {
    setRoom(next);
    rememberRoom(next);
    setRooms(loadManittoRooms());
    setNeedsJoin(false);
  };
  const handleError = (cause: unknown, target: string) => {
    setError(cause instanceof Error ? cause.message : '다시 시도해주세요.');
    if (cause instanceof ManittoApiError && (cause.status === 401 || cause.status === 404)) {
      setRoom(null);
      setNeedsJoin(cause.status === 401);
      forgetRoom(target);
      setRooms(loadManittoRooms());
    }
  };

  useEffect(() => {
    if (!code || needsJoin) { setLoading(false); return; }
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let reading = false;
    const refresh = async () => {
      clearTimeout(timer);
      if (reading || inFlight.current) {
        timer = setTimeout(() => void refresh(), 5000);
        return;
      }
      reading = true;
      const version = epoch.current;
      let retry = true;
      try {
        const next = await manittoApi.state(code);
        if (active && alive.current && version === epoch.current) { apply(next); setError(''); }
      } catch (cause) {
        if (active && alive.current && version === epoch.current) {
          handleError(cause, code);
          retry = !(cause instanceof ManittoApiError && [401, 404].includes(cause.status));
        }
      } finally {
        reading = false;
        if (active) {
          setLoading(false);
          if (retry) timer = setTimeout(() => void refresh(), 5000);
        }
      }
    };
    const wake = () => { if (document.visibilityState === 'visible') void refresh(); };
    void refresh();
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
    return () => {
      active = false; clearTimeout(timer);
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [code, needsJoin]);

  const open = (next: string) => {
    epoch.current++;
    setRoom(null); setError(''); setNeedsJoin(false); setLoading(Boolean(next));
    setCode(next); updateRoomUrl(next);
  };
  const run = async (action: () => Promise<ManittoRoom>) => {
    if (inFlight.current) return false;
    inFlight.current = true;
    const version = ++epoch.current;
    setBusy(true); setError('');
    try {
      const next = await action();
      if (alive.current && version === epoch.current) {
        apply(next); setCode(next.code); updateRoomUrl(next.code);
      }
      return alive.current && version === epoch.current;
    } catch (cause) {
      if (alive.current && version === epoch.current) handleError(cause, code);
      return false;
    } finally {
      inFlight.current = false;
      if (alive.current) { setBusy(false); setLoading(false); }
    }
  };
  const close = async () => {
    if (!room || inFlight.current) return;
    inFlight.current = true;
    const target = room.code;
    const version = ++epoch.current;
    setBusy(true); setError('');
    try {
      await manittoApi.close(target);
      forgetRoom(target);
      if (alive.current && version === epoch.current) { setRooms(loadManittoRooms()); open(''); }
    } catch (cause) {
      if (alive.current && version === epoch.current) handleError(cause, target);
    } finally { inFlight.current = false; if (alive.current) setBusy(false); }
  };
  return {
    rooms, code, room, busy, loading, error, needsJoin, open, close,
    create: (title: string, name: string, participating: boolean) => run(() => manittoApi.create(title, name, participating)),
    join: (target: string, name: string) => run(() => manittoApi.join(target, name)),
    assign: () => run(() => manittoApi.assign(code)),
    mission: (id: string, content: string) => run(() => manittoApi.mission(code, id, content)),
    complete: (id: string, completed: boolean) => run(() => manittoApi.complete(code, id, completed)),
  };
}
