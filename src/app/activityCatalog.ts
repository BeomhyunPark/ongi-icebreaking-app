export type ActivityId =
  | 'heart-trace'
  | 'gureumi'
  | 'balance-game'
  | 'ideal-world-cup'
  | 'group-picker'
  | 'anonymous-sharing';

export type ActivityKind =
  | '성격검사'
  | '새로운 테스트'
  | 'VS 놀이'
  | '토너먼트'
  | '모임 도구'
  | '소그룹 나눔';
export type ActivityGroup = 'play' | 'community-tool' | 'teaser';
export type ActivityIntent = 'test' | 'play' | 'tools';

export type Activity = {
  id: ActivityId;
  group: ActivityGroup;
  intent: ActivityIntent;
  kind: ActivityKind;
  title: string;
  description: string;
  meta: string;
  badge?: string;
  available: boolean;
};

export const ACTIVITIES: readonly Activity[] = [
  {
    id: 'heart-trace',
    intent: 'test',
    group: 'play',
    kind: '성격검사',
    title: '마음속 흔적 찾기',
    description: '내 마음과 가장 닮은 흔적이는 누구일까요?',
    meta: '약 4분 · 20문항 · 5가지 결과',
    available: true,
  },
  {
    id: 'gureumi',
    intent: 'test',
    group: 'teaser',
    kind: '새로운 테스트',
    title: '구르미 테스트',
    description: '27개의 선택을 따라가며 나와 닮은 구르미를 만나보세요.',
    meta: 'Beta v0.1 · 27문항 · 약 4~5분',
    badge: 'BETA',
    available: true,
  },
  {
    id: 'balance-game',
    intent: 'play',
    group: 'play',
    kind: 'VS 놀이',
    title: '극과 극 밸런스 게임',
    description: '어려운 선택일수록 더 재미있는 우리 이야기',
    meta: '가볍게 · 직접 선택 · 8문항',
    badge: 'NEW',
    available: true,
  },
  {
    id: 'ideal-world-cup',
    intent: 'play',
    group: 'play',
    kind: '토너먼트',
    title: '최애 월드컵',
    description: '하나만 남을 때까지 이어지는 취향 토너먼트',
    meta: '한 끼 · 디저트 · 야식 · 32강',
    badge: 'NEW',
    available: true,
  },
  {
    id: 'group-picker',
    intent: 'tools',
    group: 'community-tool',
    kind: '모임 도구',
    title: '오늘은 누구?',
    description: '사다리부터 기도와 나눔 순서까지 한 번에',
    meta: '사다리 · 제비뽑기 · 기도 · 나눔 · 조 편성 · 원투원 · 기도 후원',
    badge: 'NEW',
    available: true,
  },
  {
    id: 'anonymous-sharing',
    intent: 'tools',
    group: 'community-tool',
    kind: '소그룹 나눔',
    title: '익명으로 만나는 우리',
    description: '이름보다 이야기를 먼저 만나고, 준비됐을 때 직접 나를 소개해요.',
    meta: 'Room 참여 · 익명 프로필',
    badge: 'NEW',
    available: true,
  },
] as const;
