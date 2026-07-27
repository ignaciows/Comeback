import { useEffect, useMemo } from 'react';

import { runEngine, type EngineResult } from '@/domain/engine';
import type { WorkoutSession } from '@/domain/types';
import { today as todayOf } from '@/utils/date';
import { useAppStore } from './useAppStore';

/**
 * Runs the models over the current state, memoised on the data they read.
 * Screens consume this instead of recomputing anything themselves.
 */
export function useEngine(): EngineResult {
  const sessions = useAppStore((state) => state.sessions);
  const plannedSessions = useAppStore((state) => state.plannedSessions);
  const checkins = useAppStore((state) => state.checkins);
  const training = useAppStore((state) => state.training);
  const routines = useAppStore((state) => state.routines);
  const activeRoutineId = useAppStore((state) => state.activeRoutineId);
  const goal = useAppStore((state) => state.goal);
  const profile = useAppStore((state) => state.profile);
  const bodyMeasurements = useAppStore((state) => state.bodyMeasurements);
  const baseline = useAppStore((state) => state.comebackBaseline);
  const weekStartsOn = useAppStore((state) => state.preferences.weekStartsOn);
  const persistBaseline = useAppStore((state) => state.persistBaseline);

  const date = todayOf();

  const result = useMemo(
    () =>
      runEngine({
        today: date,
        sessions,
        plannedSessions,
        checkins,
        training,
        routines,
        activeRoutineId,
        goal,
        profile,
        bodyMeasurements,
        baseline,
        weekStartsOn,
      }),
    [
      date,
      sessions,
      plannedSessions,
      checkins,
      training,
      routines,
      activeRoutineId,
      goal,
      profile,
      bodyMeasurements,
      baseline,
      weekStartsOn,
    ],
  );

  // The first observed baseline is written back once, so later comparisons are
  // made against a fixed reference instead of a moving one.
  useEffect(() => {
    if (result.derivedBaseline) persistBaseline(result.derivedBaseline);
  }, [result.derivedBaseline, persistBaseline]);

  return result;
}

export function useActiveSession(): WorkoutSession | null {
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sessions = useAppStore((state) => state.sessions);
  return useMemo(
    () => sessions.find((session) => session.id === activeSessionId && session.status === 'active') ?? null,
    [sessions, activeSessionId],
  );
}

export function useSession(sessionId: string | undefined): WorkoutSession | null {
  const sessions = useAppStore((state) => state.sessions);
  return useMemo(() => sessions.find((session) => session.id === sessionId) ?? null, [sessions, sessionId]);
}

export function useCompletedSessions(): WorkoutSession[] {
  const sessions = useAppStore((state) => state.sessions);
  return useMemo(
    () =>
      sessions
        .filter((session) => session.status === 'completed')
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [sessions],
  );
}

export function useTodayCheckin() {
  const checkins = useAppStore((state) => state.checkins);
  const date = todayOf();
  return useMemo(() => checkins.find((checkin) => checkin.date === date) ?? null, [checkins, date]);
}

export function useActiveRoutine() {
  const routines = useAppStore((state) => state.routines);
  const activeRoutineId = useAppStore((state) => state.activeRoutineId);
  return useMemo(
    () => routines.find((routine) => routine.id === activeRoutineId) ?? routines[0] ?? null,
    [routines, activeRoutineId],
  );
}

export function useBodyWeightSeries() {
  const measurements = useAppStore((state) => state.bodyMeasurements);
  return useMemo(
    () => [...measurements].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [measurements],
  );
}
