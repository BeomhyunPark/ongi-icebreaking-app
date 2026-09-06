import { engagementApi } from './engagementApi';
import { getEngagementIdentity } from './identity';
import type {
  EngagementContentCode,
  EngagementIdentity,
  LikeResponse,
  ShareTarget,
} from './types';

const PARTICIPATION_STORAGE_KEY = 'ongi_engagement_participations_v1';
const LIKE_CACHE_STORAGE_KEY = 'ongi_like_cache_v2';
const VISITOR_COUNT_CACHE_STORAGE_KEY = 'ongi_visitor_count_cache_v1';

type ParticipationReference = {
  participationId: number;
  requestKey: string;
  completed: boolean;
  resultCode?: string;
};

const TEST_MODE = import.meta.env.MODE === 'test';
let sessionPromise: Promise<EngagementIdentity> | null = null;
let pageViewPromise: Promise<void> | null = null;
let memoryParticipations: Partial<Record<EngagementContentCode, ParticipationReference>> = {};
const participationStartPromises = new Map<EngagementContentCode, Promise<boolean>>();

function likeCacheKey(contentCode: EngagementContentCode, variantCode: string): string {
  return `${contentCode}:${variantCode}`;
}

function readLikeCache(): Record<string, LikeResponse> {
  if (TEST_MODE) return {};
  try {
    const serialized = window.localStorage.getItem(LIKE_CACHE_STORAGE_KEY);
    return serialized ? JSON.parse(serialized) as Record<string, LikeResponse> : {};
  } catch {
    return {};
  }
}

function isCachedLikeResponse(
  value: LikeResponse | undefined,
  variantCode: string,
): value is LikeResponse {
  return value?.variantCode === variantCode
    && typeof value.liked === 'boolean'
    && Number.isSafeInteger(value.likeCount)
    && value.likeCount >= 0;
}

function cacheLike(contentCode: EngagementContentCode, response: LikeResponse): void {
  if (TEST_MODE) return;
  try {
    const cache = readLikeCache();
    cache[likeCacheKey(contentCode, response.variantCode)] = response;
    window.localStorage.setItem(LIKE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // 캐시 저장 실패는 실제 좋아요 요청에 영향을 주지 않는다.
  }
}

export function getCachedContentLike(
  contentCode: EngagementContentCode,
  variantCode: string,
): LikeResponse | null {
  const cached = readLikeCache()[likeCacheKey(contentCode, variantCode)];
  return isCachedLikeResponse(cached, variantCode) ? cached : null;
}

export function getCachedVisitorCount(): number | null {
  if (TEST_MODE) return null;
  try {
    const cached = window.localStorage.getItem(VISITOR_COUNT_CACHE_STORAGE_KEY);
    if (cached === null) return null;
    const parsed = Number(cached);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  } catch {
    return null;
  }
}

function warn(action: string, error: unknown): void {
  console.warn(`[engagement] ${action} 기록에 실패했습니다.`, error);
}

function shareCodeFromLocation(): string | undefined {
  const shareCode = new URLSearchParams(window.location.search).get('share')?.trim();
  return shareCode || undefined;
}

async function ensureSession(): Promise<EngagementIdentity> {
  if (sessionPromise) {
    return sessionPromise;
  }

  sessionPromise = (async () => {
    const identity = getEngagementIdentity();
    await engagementApi.ensureVisitor(identity.visitorKey);
    await engagementApi.ensureVisit(identity.visitKey, identity.visitorKey, shareCodeFromLocation());
    return identity;
  })();

  try {
    return await sessionPromise;
  } catch (error) {
    sessionPromise = null;
    throw error;
  }
}

function readParticipations(): Partial<Record<EngagementContentCode, ParticipationReference>> {
  try {
    const serialized = window.sessionStorage.getItem(PARTICIPATION_STORAGE_KEY);
    return serialized ? JSON.parse(serialized) as typeof memoryParticipations : memoryParticipations;
  } catch {
    return memoryParticipations;
  }
}

function saveParticipations(participations: typeof memoryParticipations): void {
  memoryParticipations = participations;
  try {
    window.sessionStorage.setItem(PARTICIPATION_STORAGE_KEY, JSON.stringify(participations));
  } catch {
    // sessionStorage가 차단되면 현재 탭의 메모리에서만 참여를 이어간다.
  }
}

function setParticipation(contentCode: EngagementContentCode, reference: ParticipationReference): void {
  saveParticipations({ ...readParticipations(), [contentCode]: reference });
}

export async function initializeEngagement(): Promise<void> {
  if (TEST_MODE) return;
  if (pageViewPromise) return pageViewPromise;

  pageViewPromise = (async () => {
    try {
      const identity = await ensureSession();
      await engagementApi.recordEvent({
        eventKey: crypto.randomUUID(),
        visitKey: identity.visitKey,
        eventType: 'PAGE_VIEW',
      });
    } catch (error) {
      warn('PAGE_VIEW', error);
    }
  })();

  return pageViewPromise;
}

export async function trackContentView(contentCode: EngagementContentCode): Promise<void> {
  if (TEST_MODE) return;
  try {
    const identity = await ensureSession();
    await engagementApi.recordEvent({
      eventKey: crypto.randomUUID(),
      visitKey: identity.visitKey,
      contentCode,
      eventType: 'CONTENT_VIEW',
    });
  } catch (error) {
    warn('CONTENT_VIEW', error);
  }
}

export async function startContentParticipation(
  contentCode: EngagementContentCode,
): Promise<boolean> {
  if (TEST_MODE) return true;
  const existing = participationStartPromises.get(contentCode);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const identity = await ensureSession();
      const requestKey = crypto.randomUUID();
      const participation = await engagementApi.startParticipation(
        identity.visitKey,
        contentCode,
        requestKey,
      );
      setParticipation(contentCode, {
        participationId: participation.participationId,
        requestKey,
        completed: false,
      });
      return true;
    } catch (error) {
      warn('참여 시작', error);
      return false;
    } finally {
      participationStartPromises.delete(contentCode);
    }
  })();
  participationStartPromises.set(contentCode, pending);
  return pending;
}

export async function completeContentParticipation(
  contentCode: EngagementContentCode,
  resultCode?: string,
): Promise<boolean> {
  if (TEST_MODE) return true;
  let reference = readParticipations()[contentCode];

  if (reference?.completed && reference.resultCode === resultCode) {
    return true;
  }
  const pendingStart = participationStartPromises.get(contentCode);
  if (pendingStart && !(await pendingStart)) {
    return false;
  }
  reference = readParticipations()[contentCode];
  if (!reference && !(await startContentParticipation(contentCode))) {
    return false;
  }
  reference = readParticipations()[contentCode];
  if (!reference) return false;

  try {
    const identity = await ensureSession();
    await engagementApi.completeParticipation(reference.participationId, identity.visitKey, resultCode);
    setParticipation(contentCode, { ...reference, completed: true, resultCode });
    return true;
  } catch (error) {
    warn('참여 완료', error);
    return false;
  }
}

export async function recordInstantParticipation(
  contentCode: EngagementContentCode,
): Promise<boolean> {
  return (await startContentParticipation(contentCode))
    && completeContentParticipation(contentCode);
}

export async function recordShareClick(
  contentCode: EngagementContentCode,
  target: ShareTarget,
): Promise<void> {
  if (TEST_MODE) return;
  try {
    const identity = await ensureSession();
    await engagementApi.recordEvent({
      eventKey: crypto.randomUUID(),
      visitKey: identity.visitKey,
      contentCode,
      eventType: 'SHARE_CLICK',
      data: { target },
    });
  } catch (error) {
    warn('SHARE_CLICK', error);
  }
}

export async function getContentLike(
  contentCode: EngagementContentCode,
  variantCode: string,
): Promise<LikeResponse> {
  if (TEST_MODE) return { variantCode, liked: false, likeCount: 0 };
  const identity = getEngagementIdentity();
  const response = await engagementApi.getLike(contentCode, variantCode, identity.visitorKey);
  cacheLike(contentCode, response);
  return response;
}

export async function getVisitorCount(): Promise<number> {
  if (TEST_MODE) return 0;
  await ensureSession();
  const visitorCount = (await engagementApi.getVisitorStatistics()).visitorCount;
  try {
    window.localStorage.setItem(VISITOR_COUNT_CACHE_STORAGE_KEY, String(visitorCount));
  } catch {
    // 캐시 저장 실패는 방문자 집계에 영향을 주지 않는다.
  }
  return visitorCount;
}

export async function setContentLike(
  contentCode: EngagementContentCode,
  variantCode: string,
  liked: boolean,
): Promise<LikeResponse> {
  if (TEST_MODE) return { variantCode, liked, likeCount: liked ? 1 : 0 };
  const identity = getEngagementIdentity();
  const response = await engagementApi.setLike(contentCode, variantCode, identity.visitorKey, liked);
  cacheLike(contentCode, response);
  return response;
}
