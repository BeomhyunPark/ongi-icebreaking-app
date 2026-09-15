type ShareActivityId =
  | 'heart-trace'
  | 'gureumi'
  | 'balance-game'
  | 'ideal-world-cup'
  | 'group-picker'
  | 'anonymous-sharing';

type SharePickerMode =
  | 'prayer'
  | 'sharing'
  | 'lottery'
  | 'ladder'
  | 'groups'
  | 'pairs'
  | 'supporter';

type ShareWorldCupCategory =
  | 'meal'
  | 'dessert'
  | 'late-night'
  | 'travel'
  | 'free-pass'
  | 'life-cheat';

export type ShareActivityTarget = {
  id: ShareActivityId;
  initialGroupPickerMode?: SharePickerMode;
  initialWorldCupCategory?: ShareWorldCupCategory;
};

type ShareLookupTarget = {
  id: string;
  initialGroupPickerMode?: string;
  initialWorldCupCategory?: string;
};

export type ShareTarget = {
  slug: string;
  target: ShareActivityTarget;
  label: string;
  title: string;
  description: string;
  eyebrow: string;
  symbol: string;
  accent: string;
  secondary: string;
};

const PLAY_SHARE_TARGETS: readonly ShareTarget[] = [
  {
    slug: 'heart-trace',
    target: { id: 'heart-trace' },
    label: '마음속 흔적 찾기',
    title: '마음속 흔적 찾기 | 온기',
    description: '내 마음과 가장 닮은 흔적이는 누구일까요?',
    eyebrow: '온기 · 성격검사',
    symbol: '✦',
    accent: '#f48faa',
    secondary: '#ffc98f',
  },
  {
    slug: 'gureumi',
    target: { id: 'gureumi' },
    label: '구르미 테스트',
    title: '나는 어떤 구르미일까? | 온기',
    description: '27개의 선택으로 만나는 나의 구르미. 서로 다른 반응을 가볍게 알아보세요.',
    eyebrow: '온기 · 놀이형 자기이해',
    symbol: '☁',
    accent: '#6b86ea',
    secondary: '#f08dc1',
  },
  {
    slug: 'balance-game',
    target: { id: 'balance-game' },
    label: '극과 극 밸런스 게임',
    title: '극과 극 밸런스 게임 | 온기',
    description: '정답보다 서로의 이유가 더 재미있는 시간이에요.',
    eyebrow: '온기 · VS 놀이',
    symbol: 'VS',
    accent: '#ff8c68',
    secondary: '#55ddf2',
  },
  {
    // 기존에 공유된 링크를 깨지 않기 위한 legacy entry다. 새 공유는 아래 카테고리별 entry를 사용한다.
    slug: 'ideal-world-cup',
    target: { id: 'ideal-world-cup' },
    label: '최애 월드컵',
    title: '최애 월드컵 | 온기',
    description: '하나만 남을 때까지 이어지는 취향 토너먼트.',
    eyebrow: '온기 · 토너먼트',
    symbol: '★',
    accent: '#ffd36e',
    secondary: '#86d9f2',
  },
];

const WORLD_CUP_SHARE_TARGETS: readonly ShareTarget[] = [
  {
    slug: 'ideal-world-cup-meal',
    target: { id: 'ideal-world-cup', initialWorldCupCategory: 'meal' },
    label: '든든한 한 끼 최애 월드컵',
    title: '든든한 한 끼 최애 월드컵 | 온기',
    description: '오늘 딱 하나만 고른다면? 든든한 한 끼 취향 토너먼트.',
    eyebrow: '온기 · 한 끼 월드컵',
    symbol: '★',
    accent: '#ffd36e',
    secondary: '#86d9f2',
  },
  {
    slug: 'ideal-world-cup-dessert',
    target: { id: 'ideal-world-cup', initialWorldCupCategory: 'dessert' },
    label: '디저트 최애 월드컵',
    title: '디저트 최애 월드컵 | 온기',
    description: '달콤한 후보 중 마지막까지 남을 나의 최애 디저트는?',
    eyebrow: '온기 · 디저트 월드컵',
    symbol: '★',
    accent: '#f48faa',
    secondary: '#ffd36e',
  },
  {
    slug: 'ideal-world-cup-late-night',
    target: { id: 'ideal-world-cup', initialWorldCupCategory: 'late-night' },
    label: '야식 최애 월드컵',
    title: '야식 최애 월드컵 | 온기',
    description: '늦은 밤 가장 간절한 하나를 고르는 야식 토너먼트.',
    eyebrow: '온기 · 야식 월드컵',
    symbol: '★',
    accent: '#b4a0ff',
    secondary: '#ff8c68',
  },
  {
    slug: 'ideal-world-cup-travel',
    target: { id: 'ideal-world-cup', initialWorldCupCategory: 'travel' },
    label: '여행지 최애 월드컵',
    title: '여행지 최애 월드컵 | 온기',
    description: '지금 떠날 수 있다면 어디로? 여행 취향 토너먼트.',
    eyebrow: '온기 · 여행지 월드컵',
    symbol: '★',
    accent: '#86d9f2',
    secondary: '#78e2c6',
  },
  {
    slug: 'ideal-world-cup-free-pass',
    target: { id: 'ideal-world-cup', initialWorldCupCategory: 'free-pass' },
    label: '평생 무료 이용권 월드컵',
    title: '평생 무료 이용권 월드컵 | 온기',
    description: '평생 하나가 무료라면? 가장 탐나는 이용권을 골라보세요.',
    eyebrow: '온기 · 무료 이용권 월드컵',
    symbol: '★',
    accent: '#78e2c6',
    secondary: '#ffd36e',
  },
  {
    slug: 'ideal-world-cup-life-cheat',
    target: { id: 'ideal-world-cup', initialWorldCupCategory: 'life-cheat' },
    label: '인생 치트키 월드컵',
    title: '인생 치트키 월드컵 | 온기',
    description: '딱 하나 가질 수 있다면? 나만의 인생 치트키 토너먼트.',
    eyebrow: '온기 · 인생 치트키 월드컵',
    symbol: '★',
    accent: '#c8adff',
    secondary: '#86d9f2',
  },
];

const TOOL_SHARE_TARGETS: readonly ShareTarget[] = [
  {
    slug: 'tool-ladder',
    target: { id: 'group-picker', initialGroupPickerMode: 'ladder' },
    label: '사다리 타기',
    title: '사다리 타기 | 온기',
    description: '이름과 결과를 넣고 함께 사다리를 타보세요.',
    eyebrow: '온기 · 모임 도구',
    symbol: '↘',
    accent: '#78e2c6',
    secondary: '#85a8ed',
  },
  {
    slug: 'tool-lottery',
    target: { id: 'group-picker', initialGroupPickerMode: 'lottery' },
    label: '제비뽑기',
    title: '제비뽑기 | 온기',
    description: '공평하고 간단하게 오늘의 주인공을 뽑아보세요.',
    eyebrow: '온기 · 모임 도구',
    symbol: '✓',
    accent: '#80e0c2',
    secondary: '#f7d687',
  },
  {
    slug: 'tool-prayer',
    target: { id: 'group-picker', initialGroupPickerMode: 'prayer' },
    label: '기도할 사람 정하기',
    title: '기도할 사람 정하기 | 온기',
    description: '함께 기도할 한 사람을 따뜻하게 정해보세요.',
    eyebrow: '온기 · 모임 도구',
    symbol: '✦',
    accent: '#baf5e6',
    secondary: '#b4a0ff',
  },
  {
    slug: 'tool-sharing',
    target: { id: 'group-picker', initialGroupPickerMode: 'sharing' },
    label: '나눔 순서 정하기',
    title: '나눔 순서 정하기 | 온기',
    description: '누가 먼저 시작할지 부담 없이 순서를 정해보세요.',
    eyebrow: '온기 · 모임 도구',
    symbol: '1',
    accent: '#78e2c6',
    secondary: '#f48faa',
  },
  {
    slug: 'tool-groups',
    target: { id: 'group-picker', initialGroupPickerMode: 'groups' },
    label: '나눔 조 편성하기',
    title: '나눔 조 편성하기 | 온기',
    description: '함께할 사람들을 고르게 섞어 나눔 조를 만들어요.',
    eyebrow: '온기 · 모임 도구',
    symbol: '#',
    accent: '#85a8ed',
    secondary: '#78e2c6',
  },
  {
    slug: 'tool-pairs',
    target: { id: 'group-picker', initialGroupPickerMode: 'pairs' },
    label: '원투원 짝 정하기',
    title: '원투원 짝 정하기 | 온기',
    description: '서로 함께할 원투원 짝을 공평하게 정해보세요.',
    eyebrow: '온기 · 모임 도구',
    symbol: '1:1',
    accent: '#c8adff',
    secondary: '#78e2c6',
  },
  {
    slug: 'tool-supporter',
    target: { id: 'group-picker', initialGroupPickerMode: 'supporter' },
    label: '기도 후원자 정하기',
    title: '기도 후원자 정하기 | 온기',
    description: '이번 주 서로를 위해 기도할 후원자를 연결해요.',
    eyebrow: '온기 · 모임 도구',
    symbol: '♡',
    accent: '#f48faa',
    secondary: '#78e2c6',
  },
];

export const SHARE_TARGETS: readonly ShareTarget[] = [
  ...PLAY_SHARE_TARGETS,
  ...WORLD_CUP_SHARE_TARGETS,
  ...TOOL_SHARE_TARGETS,
];

function matchesTarget(
  candidate: ShareActivityTarget,
  target: ShareLookupTarget,
): boolean {
  return candidate.id === target.id
    && candidate.initialGroupPickerMode === target.initialGroupPickerMode
    && candidate.initialWorldCupCategory === target.initialWorldCupCategory;
}

export function getShareTarget(target: ShareLookupTarget): ShareTarget | null {
  const normalizedTarget = target.id === 'ideal-world-cup'
    ? { ...target, initialWorldCupCategory: target.initialWorldCupCategory ?? 'meal' }
    : target;

  return SHARE_TARGETS.find((candidate) => matchesTarget(candidate.target, normalizedTarget)) ?? null;
}

export function getActivityDestination(target: ShareActivityTarget): string {
  if (target.id === 'group-picker' && target.initialGroupPickerMode) {
    return `?tool=${target.initialGroupPickerMode}`;
  }

  if (target.id === 'ideal-world-cup' && target.initialWorldCupCategory) {
    return `?activity=ideal-world-cup&category=${target.initialWorldCupCategory}`;
  }

  return `?activity=${target.id}`;
}
