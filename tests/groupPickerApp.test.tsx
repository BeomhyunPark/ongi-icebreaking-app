// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GroupPickerApp } from '../src/features/group-picker/GroupPickerApp';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.useRealTimers();
});

function addItems(inputPlaceholder: string, items: readonly string[]) {
  const input = screen.getByPlaceholderText(inputPlaceholder);

  for (const item of items) {
    fireEvent.change(input, { target: { value: item } });
    fireEvent.keyDown(input, { key: 'Enter' });
  }
}

async function finishDraw() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1600);
  });
}

describe('오늘은 누구?', () => {
  it('동명이인을 누락하지 않고 고유한 이름으로 구분한다', () => {
    render(<GroupPickerApp onBackHome={vi.fn()} />);
    addItems('이름 입력', ['민수', '지현', '민수', '민수 (2)']);
    const participants = screen.getByLabelText('참여자 목록');
    expect(participants.children).toHaveLength(4);
    expect(screen.getByText('4/32')).toBeTruthy();
    expect(participants.textContent).toContain('민수 (2)');
    expect(participants.textContent).toContain('민수 (2) (2)');
  });

  it('다시 열어도 재추첨하지 않고 같은 결과를 보여준다', async () => {
    vi.useFakeTimers();
    const first = render(<GroupPickerApp onBackHome={vi.fn()} />);
    addItems('이름 입력', ['민수', '지현', '은혜']);
    fireEvent.click(screen.getByRole('button', { name: '기도할 사람 정하기' }));
    await finishDraw();
    const winner = document.querySelector('.group-picker-prayer-result strong')?.textContent;
    first.unmount();
    render(<GroupPickerApp onBackHome={vi.fn()} />);
    expect(screen.getByRole('heading', { name: '오늘은 바로' })).toBeTruthy();
    expect(document.querySelector('.group-picker-prayer-result strong')?.textContent).toBe(winner);
    fireEvent.click(screen.getByRole('button', { name: '설정 바꾸기' }));
    expect(screen.getByLabelText('참여자 목록').children).toHaveLength(3);
  });

  it('사다리를 만드는 중에 다시 열어도 기존 사다리를 복구한다', () => {
    const first = render(<GroupPickerApp initialGroupPickerMode="ladder" onBackHome={vi.fn()} />);
    addItems('이름 입력', ['민수', '지현', '은혜']);
    fireEvent.click(screen.getByRole('button', { name: '사다리 만들기' }));
    const saved = JSON.parse(window.localStorage.getItem('ongi.group-picker.session.v1.ladder')!);
    first.unmount();
    render(<GroupPickerApp initialGroupPickerMode="ladder" onBackHome={vi.fn()} />);
    expect(screen.getByRole('img', { name: '완성된 사다리' })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('ongi.group-picker.session.v1.ladder')!).result).toEqual(saved.result);
  });

  it('홈 바로가기에서 선택한 도구로 시작한다', () => {
    const onGroupPickerModeChange = vi.fn();
    render(
      <GroupPickerApp
        initialGroupPickerMode="groups"
        onBackHome={vi.fn()}
        onGroupPickerModeChange={onGroupPickerModeChange}
      />,
    );

    expect(screen.getByRole('button', { name: '나눔 조 짜기' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '나눔 조 편성하기' })).toBeTruthy();
    expect(onGroupPickerModeChange).toHaveBeenLastCalledWith('groups');

    fireEvent.click(screen.getByRole('button', { name: '원투원 짝 정하기' }));
    expect(onGroupPickerModeChange).toHaveBeenLastCalledWith('pairs');
  });

  it('기다리는 화면을 거친 뒤 기도 순서를 보여준다', async () => {
    vi.useFakeTimers();
    render(<GroupPickerApp onBackHome={vi.fn()} />);
    addItems('이름 입력', ['민지', '현우', '수빈']);

    fireEvent.click(screen.getByRole('button', { name: '기도할 사람 정하기' }));
    expect(screen.getByRole('status').textContent).toContain('정하고 있어요');
    expect(screen.queryByRole('heading', { name: '오늘은 바로' })).toBeNull();

    await finishDraw();

    expect(screen.getByRole('heading', { name: '오늘은 바로' })).toBeTruthy();
    expect(screen.queryByText('먼저')).toBeNull();
    expect(document.querySelectorAll('.group-picker-prayer-result strong')).toHaveLength(1);
    expect(document.querySelector('.group-picker-order')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('ongi.group-picker.names.v1') ?? '[]')).toEqual([
      '민지', '현우', '수빈',
    ]);
  });

  it('사다리는 사람을 누른 뒤 경로를 그리고 해당 결과만 공개한다', async () => {
    vi.useFakeTimers();
    render(<GroupPickerApp onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '사다리 타기' }));
    addItems('이름 입력', ['민지', '현우', '수빈']);
    addItems('결과 입력', ['커피', '간식', '통과']);
    fireEvent.click(screen.getByRole('button', { name: '사다리 만들기' }));

    expect(screen.getByRole('status').textContent).toContain('사다리를 놓고 있어요');
    await finishDraw();

    expect(screen.getByRole('img', { name: '완성된 사다리' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '누구부터 내려갈까요?' })).toBeTruthy();
    expect(screen.getAllByText('?')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: '민지' }));
    expect(document.querySelector('.ladder-trace')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    expect(screen.getAllByText('?')).toHaveLength(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '민지' }));
    expect(document.querySelector('.ladder-trace.is-replay')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    fireEvent.click(screen.getByRole('button', { name: '결과 한 번에 보기' }));
    expect(screen.queryByText('?')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: '사다리 결과' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '결과 이미지 공유하기' })).toBeTruthy();
  });

  it('한 번에 보기도 소수 결과의 경로를 먼저 보여준다', async () => {
    vi.useFakeTimers();
    render(<GroupPickerApp onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '사다리 타기' }));
    addItems('이름 입력', ['민지', '현우', '수빈', '하늘']);
    fireEvent.click(screen.getByRole('button', { name: '한 명만 꽝' }));
    fireEvent.click(screen.getByRole('button', { name: '사다리 만들기' }));
    await finishDraw();

    fireEvent.click(screen.getByRole('button', { name: '결과 한 번에 보기' }));
    expect(document.querySelector('.ladder-trace')).toBeTruthy();
    expect(screen.getAllByText('?')).toHaveLength(4);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    expect(screen.queryByText('?')).toBeNull();
    expect(document.querySelectorAll('.group-picker-ladder-results .is-special')).toHaveLength(1);
  });

  it('현재 인원수에 맞춰 내기 결과를 자동으로 채운다', () => {
    render(<GroupPickerApp onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '사다리 타기' }));
    addItems('이름 입력', ['민지', '현우', '수빈', '하늘']);

    fireEvent.click(screen.getByRole('button', { name: '커피 내기' }));

    const resultList = screen.getByLabelText('사다리 결과 목록');
    expect(resultList.children).toHaveLength(4);
    expect(resultList.textContent).toContain('커피 사기');
    expect(resultList.textContent?.match(/통과/g)).toHaveLength(3);
    expect(screen.getByText('4/4')).toBeTruthy();
  });

  it('여러 줄로 붙여넣은 명단을 한 번에 칩으로 추가한다', () => {
    render(<GroupPickerApp onBackHome={vi.fn()} />);
    const input = screen.getByPlaceholderText('이름 입력');
    fireEvent.paste(input, {
      clipboardData: { getData: () => '민지\n현우\n수빈' },
    });

    expect(screen.getByLabelText('참여자 목록').children).toHaveLength(3);
    expect(screen.getByText('3/32')).toBeTruthy();
  });

  it('참여자가 부족하면 바로 알려준다', () => {
    render(<GroupPickerApp onBackHome={vi.fn()} />);
    addItems('이름 입력', ['민지']);
    fireEvent.click(screen.getByRole('button', { name: '기도할 사람 정하기' }));

    expect(screen.getByRole('alert').textContent).toContain('두 명 이상');
  });

  it('명단 전체를 한 번에 지운다', () => {
    render(<GroupPickerApp onBackHome={vi.fn()} />);
    addItems('이름 입력', ['민지', '현우', '수빈']);

    fireEvent.click(screen.getByRole('button', { name: '모두 지우기' }));

    expect(screen.queryByLabelText('참여자 목록')).toBeNull();
    expect(screen.getByText('0/32')).toBeTruthy();
  });

  it('기도 후원 결과에 모든 일대일 방향 배정을 보여준다', async () => {
    vi.useFakeTimers();
    render(<GroupPickerApp onBackHome={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '이번 주 기도 후원자' }));
    addItems('이름 입력', ['민지', '현우', '수빈', '하늘']);
    fireEvent.click(screen.getByRole('button', { name: '기도 후원자 정하기' }));
    await finishDraw();

    const assignments = document.querySelectorAll('.group-picker-supporters li');
    expect(assignments).toHaveLength(4);
    expect(screen.getByRole('heading', { name: '이번 주 내 기도 후원자는' })).toBeTruthy();
  });
});
