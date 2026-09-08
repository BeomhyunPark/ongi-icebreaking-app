import { useEffect, useState } from 'react';
import { chooseWinner, createTournament, startNextRound } from '../domain/tournament';
import type { TournamentSize, WorldCupCategoryId, WorldCupSession } from '../domain/types';
import { findCategory, VALID_CANDIDATE_IDS, VALID_CATEGORY_IDS } from '../data/catalog';
import {
  clearWorldCupSession,
  loadWorldCupSession,
  saveWorldCupSession,
} from '../services/sessionStorage';
import {
  completeContentParticipation,
  startContentParticipation,
} from '../../../engagement/tracker';

function createSession(
  categoryId: WorldCupCategoryId,
  tournamentSize: TournamentSize,
): WorldCupSession {
  const category = findCategory(categoryId);

  return {
    version: 2,
    categoryId,
    current: createTournament(category.candidateIds, tournamentSize),
    previous: null,
  };
}

export function useWorldCup(
  initialWorldCupCategory: WorldCupCategoryId,
  onWorldCupCategoryChange?: (category: WorldCupCategoryId) => void,
) {
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<WorldCupCategoryId>(initialWorldCupCategory);
  const [selectedSize, setSelectedSize] = useState<TournamentSize>(32);
  const [savedSession, setSavedSession] = useState<WorldCupSession | null>(() =>
    loadWorldCupSession(VALID_CANDIDATE_IDS, VALID_CATEGORY_IDS),
  );
  const [activeSession, setActiveSession] = useState<WorldCupSession | null>(() =>
    savedSession?.categoryId === initialWorldCupCategory &&
    savedSession.current.phase === 'champion'
      ? savedSession
      : null,
  );

  useEffect(() => {
    if (!activeSession) {
      setSelectedCategoryId(initialWorldCupCategory);
    }
  }, [activeSession, initialWorldCupCategory]);

  useEffect(() => {
    onWorldCupCategoryChange?.(activeSession?.categoryId ?? selectedCategoryId);
  }, [activeSession?.categoryId, onWorldCupCategoryChange, selectedCategoryId]);

  useEffect(() => {
    if (activeSession) {
      saveWorldCupSession(activeSession);
    }
  }, [activeSession]);

  useEffect(() => {
    if (activeSession?.current.phase === 'champion' && activeSession.current.championId) {
      void completeContentParticipation('ideal-world-cup');
    }
  }, [activeSession]);

  const startNewTournament = (categoryId: WorldCupCategoryId, tournamentSize: TournamentSize) => {
    clearWorldCupSession();
    setSavedSession(null);

    void startContentParticipation('ideal-world-cup');
    setActiveSession(createSession(categoryId, tournamentSize));
  };

  const resetToSetup = () => {
    clearWorldCupSession();
    setSavedSession(null);
    setActiveSession(null);
  };

  const undoLastChoice = () => {
    setActiveSession((session) => {
      if (!session?.previous) {
        return session;
      }

      return {
        ...session,
        current: session.previous,
        previous: null,
      };
    });
  };

  return {
    selectedCategoryId,
    selectedSize,
    savedSession,
    activeSession,
    startNewTournament,
    resetToSetup,
    undoLastChoice,
    setSelectedSize,
    selectCategory: (categoryId: WorldCupCategoryId) => {
      setSelectedCategoryId(categoryId);
      if (selectedSize > findCategory(categoryId).candidateIds.length) setSelectedSize(32);
    },
    resumeTournament: () => {
      if (!savedSession) return;
      setSelectedCategoryId(savedSession.categoryId);
      setActiveSession(savedSession);
    },
    clearSavedTournament: () => {
      clearWorldCupSession();
      setSavedSession(null);
    },
    nextRound: () =>
      setActiveSession((session) =>
        session ? { ...session, current: startNextRound(session.current) } : session,
      ),
    selectWinner: (id: string) =>
      setActiveSession((session) =>
        session
          ? { ...session, current: chooseWinner(session.current, id), previous: session.current }
          : session,
      ),
  };
}

export type WorldCupController = ReturnType<typeof useWorldCup>;
