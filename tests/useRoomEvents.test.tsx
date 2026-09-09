// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useRoomEvents } from '../src/features/anonymous-sharing/hooks/useRoomEvents';

class FakeEventSource extends EventTarget {
  static instances: FakeEventSource[] = [];

  onerror: ((event: Event) => void) | null = null;
  close = vi.fn();

  constructor() {
    super();
    FakeEventSource.instances.push(this);
  }
}

const handleRoomEvent = vi.fn();

function RoomEventsHarness({ roomId }: { roomId: string | null }) {
  const reconnecting = useRoomEvents(roomId, handleRoomEvent);

  return <p>{reconnecting ? '재연결 중' : '연결 안내 없음'}</p>;
}

describe('Room SSE 연결 상태', () => {
  it('재연결하면 놓친 변경을 다시 조회하고 기존 연결의 이벤트를 무시한다', () => {
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    render(<RoomEventsHarness roomId="room-one" />);
    const first = FakeEventSource.instances[0];
    act(() => first.dispatchEvent(new Event('CONNECTED')));
    expect(handleRoomEvent).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event('offline')));
    expect(first.close).toHaveBeenCalledOnce();
    expect(screen.getByText('재연결 중')).toBeTruthy();
    act(() => first.dispatchEvent(new Event('ROUND_CHANGED')));
    expect(handleRoomEvent).toHaveBeenCalledTimes(1);
    act(() => window.dispatchEvent(new Event('online')));
    const second = FakeEventSource.instances[1];
    act(() => second.dispatchEvent(new Event('CONNECTED')));
    expect(handleRoomEvent).toHaveBeenCalledTimes(2);
    expect(screen.getByText('연결 안내 없음')).toBeTruthy();
  });

  it('브라우저 자체 SSE 재접속도 새 스냅샷을 가져온다', () => {
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    render(<RoomEventsHarness roomId="room-one" />);
    const source = FakeEventSource.instances[0];
    act(() => source.dispatchEvent(new Event('CONNECTED')));
    act(() => source.onerror?.(new Event('error')));
    act(() => source.dispatchEvent(new Event('CONNECTED')));
    expect(handleRoomEvent).toHaveBeenCalledTimes(2);
    expect(screen.getByText('연결 안내 없음')).toBeTruthy();
  });
  afterEach(() => {
    cleanup();
    FakeEventSource.instances = [];
    handleRoomEvent.mockReset();
    vi.unstubAllGlobals();
  });

  it('Room이 완료되어 SSE 구독을 닫으면 재연결 안내도 즉시 없앤다', () => {
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
    const { rerender } = render(<RoomEventsHarness roomId="room-one" />);

    act(() => {
      FakeEventSource.instances[0].onerror?.(new Event('error'));
    });
    expect(screen.getByText('재연결 중')).toBeTruthy();

    rerender(<RoomEventsHarness roomId={null} />);

    expect(screen.getByText('연결 안내 없음')).toBeTruthy();
    expect(FakeEventSource.instances[0].close).toHaveBeenCalledOnce();
  });
});
