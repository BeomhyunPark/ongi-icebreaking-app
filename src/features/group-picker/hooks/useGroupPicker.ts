import { useEffect, useReducer } from 'react';
import { completeContentParticipation, startContentParticipation } from '../../../engagement/tracker';
import { prepareDraw as prepareResult } from '../domain/prepareDraw';
import { getPickerModeDefinition } from '../domain/modeCatalog';
import type { PickerMode } from '../domain/types';
import { loadGroupNames, saveGroupNames } from '../services/nameStorage';
import { loadPickerSession, savePickerSession } from '../services/sessionStorage';
import { createPickerState, pickerReducer } from '../state/pickerReducer';

export function useGroupPicker(initialMode: PickerMode, onModeChange?: (mode: PickerMode) => void) {
  const [state, dispatch] = useReducer(pickerReducer, initialMode, mode => {
    const saved = loadPickerSession(mode);
    const setup = saved ?? { names: loadGroupNames(), nameDraft: '', outcomes: [], outcomeDraft: '', winnerCount: 1, groupCount: 2 };
    return createPickerState(mode, setup, saved?.result, saved?.revealed);
  });
  const { mode, setup, phase, result, activeLadderStart, revealedLadderStarts } = state;

  useEffect(() => {
    saveGroupNames(setup.names);
    savePickerSession(mode, { ...setup, result, revealed: [...revealedLadderStarts] });
  }, [mode, setup, result, revealedLadderStarts]);

  useEffect(() => { onModeChange?.(mode); }, [mode, onModeChange]);
  useEffect(() => {
    if (phase !== 'drawing') return;
    const timer = window.setTimeout(() => dispatch({ type: 'DRAW_FINISHED' }), 1600);
    return () => window.clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase === 'result') void completeContentParticipation('group-picker');
  }, [phase, result]);
  useEffect(() => {
    if (activeLadderStart === null) return;
    const timer = window.setTimeout(() => dispatch({ type: 'TRACE_FINISHED' }), 1100);
    return () => window.clearTimeout(timer);
  }, [activeLadderStart, state.revealAllQueue]);

  return {
    state, ...setup, mode, error: state.error,
    activeLadderStart, revealedLadderStarts, revealAllQueue: state.revealAllQueue,
    selectedMode: getPickerModeDefinition(mode),
    selectMode: (nextMode: PickerMode) => dispatch({ type: 'SELECT_MODE', mode: nextMode }),
    setNames: (names: string[]) => dispatch({ type: 'EDIT_NAMES', names }),
    setNameDraft: (value: string) => dispatch({ type: 'EDIT_DRAFT', field: 'nameDraft', value }),
    setOutcomeDraft: (value: string) => dispatch({ type: 'EDIT_DRAFT', field: 'outcomeDraft', value }),
    setOutcomes: (outcomes: string[]) => dispatch({ type: 'EDIT_OUTCOMES', outcomes }),
    setWinnerCount: (value: number) => dispatch({ type: 'EDIT_COUNT', field: 'winnerCount', value }),
    setGroupCount: (value: number) => dispatch({ type: 'EDIT_COUNT', field: 'groupCount', value }),
    clearItems: () => dispatch({ type: 'CLEAR_ITEMS' }),
    resetToSetup: () => dispatch({ type: 'RESET_TO_SETUP' }),
    setActiveLadderStart: (index: number) => dispatch({ type: 'REVEAL_START', index }),
    revealAllLadderResults: () => dispatch({ type: 'REVEAL_ALL' }),
    prepareDraw: () => {
      const prepared = prepareResult(mode, setup);
      if (prepared.ok) void startContentParticipation('group-picker');
      dispatch({ type: 'PREPARE_DRAW', prepared });
    },
  };
}

export type PickerController = ReturnType<typeof useGroupPicker>;
