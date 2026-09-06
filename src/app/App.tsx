import {
  lazy,
  Suspense,
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { HomeScreen, pickFeaturedActivity } from '../features/home/HomeScreen';
import type { PickerMode } from '../features/group-picker/domain/types';
import type { WorldCupCategoryId } from '../features/ideal-world-cup/domain/types';
import type { BalanceGameWeight } from '../features/balance-game/domain/types';
import { ACTIVITIES, type ActivityId } from './activityCatalog';
import {
  buildActivityUrl,
  buildPageUrl,
  parseActivitySearch,
  parsePageSearch,
  type AppPage,
  type ActivityTarget,
} from './activityNavigation';
import { SplashScreen } from './SplashScreen';
import { getActivityDefinition, preloadActivity } from './activityRegistry';
import { ActivityShareButton } from '../components/ActivityShareButton';
import { UpdatesScreen } from '../features/updates/UpdatesScreen';
import { getEngagementContentCode } from '../engagement/contentCodes';
import { initializeEngagement, trackContentView } from '../engagement/tracker';

const GureumiStatisticsApp = lazy(async () => {
  const module = await import('../features/gureumi-statistics/GureumiStatisticsApp');
  return { default: module.GureumiStatisticsApp };
});

function getDocumentScrollTop(): number {
  return Math.max(
    window.scrollY,
    document.documentElement.scrollTop,
    document.body.scrollTop,
  );
}

function updateActivityUrl(target: ActivityTarget | null, action: 'push' | 'replace'): void {
  const nextUrl = buildActivityUrl(window.location.href, target);
  const updateHistory = action === 'push'
    ? window.history.pushState.bind(window.history)
    : window.history.replaceState.bind(window.history);

  updateHistory(window.history.state, '', nextUrl);
}

function updatePageUrl(page: AppPage | null, action: 'push' | 'replace'): void {
  const nextUrl = buildPageUrl(window.location.href, page);
  const updateHistory = action === 'push'
    ? window.history.pushState.bind(window.history)
    : window.history.replaceState.bind(window.history);

  updateHistory(window.history.state, '', nextUrl);
}

export function App() {
  const [showSplash, setShowSplash] = useState(import.meta.env.MODE !== 'test');
  const [activeActivity, setActiveActivity] = useState<ActivityTarget | null>(() => (
    parseActivitySearch(window.location.search)
  ));
  const [activePage, setActivePage] = useState<AppPage | null>(() => (
    parsePageSearch(window.location.search)
  ));
  const [featuredActivityId] = useState<ActivityId | null>(() => (
    pickFeaturedActivity(ACTIVITIES, null)?.id ?? null
  ));
  const activeActivityRef = useRef(activeActivity);
  const homeScrollTop = useRef(0);
  const trackedLocation = useRef<string | null>(null);

  useEffect(() => {
    void preloadActivity('heart-trace');
  }, []);

  useEffect(() => {
    if (activePage === 'gureumi-beta-stats') return;
    void initializeEngagement();
    const contentCode = activeActivity ? getEngagementContentCode(activeActivity) : null;
    const locationKey = contentCode ?? (activePage ? `page:${activePage}` : 'home');

    if (trackedLocation.current === locationKey) {
      return;
    }
    trackedLocation.current = locationKey;

    if (contentCode) {
      void trackContentView(contentCode);
    }
  }, [activeActivity, activePage]);

  useEffect(() => {
    const handlePopState = () => {
      const nextActivity = parseActivitySearch(window.location.search);
      const nextPage = parsePageSearch(window.location.search);
      activeActivityRef.current = nextActivity;
      startTransition(() => {
        setActiveActivity(nextActivity);
        setActivePage(nextPage);
      });
    };

    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!showSplash) {
      return;
    }

    const timer = window.setTimeout(() => setShowSplash(false), 1800);

    return () => window.clearTimeout(timer);
  }, [showSplash]);

  useLayoutEffect(() => {
    if (activeActivity !== null || activePage !== null) {
      return;
    }

    document.documentElement.scrollTop = homeScrollTop.current;
    document.body.scrollTop = homeScrollTop.current;
  }, [activeActivity, activePage]);

  useLayoutEffect(() => {
    if (activePage === null) {
      return;
    }

    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activePage]);

  useLayoutEffect(() => {
    const root = document.getElementById('root');
    const isAdminDashboard = activePage === 'gureumi-beta-stats';
    root?.classList.toggle('root--admin-dashboard', isAdminDashboard);

    return () => root?.classList.remove('root--admin-dashboard');
  }, [activePage]);

  const handleGroupPickerModeChange = useCallback((mode: PickerMode) => {
    if (activeActivityRef.current?.id !== 'group-picker') {
      return;
    }

    const nextActivity = { id: 'group-picker' as const, initialGroupPickerMode: mode };

    updateActivityUrl(nextActivity, 'replace');
    activeActivityRef.current = nextActivity;
    setActiveActivity((current) => (
      current?.id !== 'group-picker' || current.initialGroupPickerMode === mode
        ? current
        : nextActivity
    ));
  }, []);

  const handleWorldCupCategoryChange = useCallback((category: WorldCupCategoryId) => {
    if (activeActivityRef.current?.id !== 'ideal-world-cup') {
      return;
    }

    const nextActivity = {
      id: 'ideal-world-cup' as const,
      initialWorldCupCategory: category,
    };

    updateActivityUrl(nextActivity, 'replace');
    activeActivityRef.current = nextActivity;
    setActiveActivity((current) => (
      current?.id !== 'ideal-world-cup' || current.initialWorldCupCategory === category
        ? current
        : nextActivity
    ));
  }, []);

  const handleBalanceGameWeightChange = useCallback((weight: BalanceGameWeight) => {
    if (activeActivityRef.current?.id !== 'balance-game') {
      return;
    }

    const nextActivity = {
      id: 'balance-game' as const,
      initialBalanceGameWeight: weight,
    };

    updateActivityUrl(nextActivity, 'replace');
    activeActivityRef.current = nextActivity;
    setActiveActivity((current) => (
      current?.id !== 'balance-game' || current.initialBalanceGameWeight === weight
        ? current
        : nextActivity
    ));
  }, []);

  if (showSplash) {
    return <SplashScreen />;
  }

  const selectActivity = (id: ActivityId, initialGroupPickerMode?: PickerMode) => {
    const target: ActivityTarget = id === 'ideal-world-cup'
      ? { id, initialWorldCupCategory: 'meal' }
      : id === 'balance-game'
        ? { id, initialBalanceGameWeight: 'light' }
        : { id, initialGroupPickerMode };

    homeScrollTop.current = getDocumentScrollTop();
    updateActivityUrl(target, 'push');
    activeActivityRef.current = target;
    startTransition(() => {
      setActivePage(null);
      setActiveActivity(target);
    });
  };

  const openUpdates = () => {
    homeScrollTop.current = getDocumentScrollTop();
    updatePageUrl('updates', 'push');
    activeActivityRef.current = null;
    startTransition(() => {
      setActiveActivity(null);
      setActivePage('updates');
    });
  };

  const returnHome = () => {
    activeActivityRef.current = null;
    updatePageUrl(null, 'replace');
    setActiveActivity(null);
    setActivePage(null);
  };

  const activity = activeActivity === null
    ? null
    : getActivityDefinition(activeActivity.id);
  const ActivityApp = activity?.Component;

  return (
    <Suspense fallback={<SplashScreen />}>
      {activePage === 'updates' ? (
        <UpdatesScreen onBackHome={returnHome} />
      ) : activePage === 'gureumi-beta-stats' ? (
        <GureumiStatisticsApp onBackHome={returnHome} />
      ) : ActivityApp && activeActivity ? (
        <div className="activity-shell">
          <ActivityApp
            initialGroupPickerMode={activeActivity.initialGroupPickerMode}
            initialWorldCupCategory={activeActivity.initialWorldCupCategory}
            initialBalanceGameWeight={activeActivity.initialBalanceGameWeight}
            onBackHome={returnHome}
            onSelectActivity={selectActivity}
            onGroupPickerModeChange={handleGroupPickerModeChange}
            onWorldCupCategoryChange={handleWorldCupCategoryChange}
            onBalanceGameWeightChange={handleBalanceGameWeightChange}
          />
          {activeActivity.id !== 'gureumi' ? (
            <ActivityShareButton
              target={activeActivity}
            />
          ) : null}
        </div>
      ) : (
        <HomeScreen
          featuredActivityId={featuredActivityId}
          onOpenUpdates={openUpdates}
          onSelectActivity={selectActivity}
        />
      )}
    </Suspense>
  );
}
