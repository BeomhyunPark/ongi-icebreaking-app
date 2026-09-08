import type { ActivityTarget } from './activityNavigation';
import { getActivityDefinition } from './activityRegistry';
import type { PickerMode } from '../features/group-picker/domain/types';
import type { WorldCupCategoryId } from '../features/ideal-world-cup/domain/types';
import type { BalanceGameWeight } from '../features/balance-game/domain/types';

type ActivityRendererProps = {
  target: ActivityTarget;
  onBackHome: () => void;
  onGroupPickerModeChange: (mode: PickerMode) => void;
  onWorldCupCategoryChange: (category: WorldCupCategoryId) => void;
  onBalanceGameWeightChange: (weight: BalanceGameWeight) => void;
};

// Only the app shell adapts navigation to activity-specific props. Features do
// not receive another activity's configuration or know about the registry.
export function ActivityRenderer({ target, ...navigation }: ActivityRendererProps) {
  switch (target.id) {
    case 'group-picker': {
      const { Component } = getActivityDefinition('group-picker');
      return (
        <Component
          onBackHome={navigation.onBackHome}
          initialGroupPickerMode={target.initialGroupPickerMode}
          onGroupPickerModeChange={navigation.onGroupPickerModeChange}
        />
      );
    }
    case 'ideal-world-cup': {
      const { Component } = getActivityDefinition('ideal-world-cup');
      return (
        <Component
          onBackHome={navigation.onBackHome}
          initialWorldCupCategory={target.initialWorldCupCategory}
          onWorldCupCategoryChange={navigation.onWorldCupCategoryChange}
        />
      );
    }
    case 'balance-game': {
      const { Component } = getActivityDefinition('balance-game');
      return (
        <Component
          onBackHome={navigation.onBackHome}
          initialBalanceGameWeight={target.initialBalanceGameWeight}
          onBalanceGameWeightChange={navigation.onBalanceGameWeightChange}
        />
      );
    }
    case 'heart-trace': {
      const { Component } = getActivityDefinition('heart-trace');
      return <Component onBackHome={navigation.onBackHome} />;
    }
    case 'gureumi': {
      const { Component } = getActivityDefinition('gureumi');
      return <Component onBackHome={navigation.onBackHome} />;
    }
    case 'anonymous-sharing': {
      const { Component } = getActivityDefinition('anonymous-sharing');
      return <Component onBackHome={navigation.onBackHome} />;
    }
  }
}
