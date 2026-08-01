import { useEffect, useMemo } from 'react';

import { runEngine, type EngineResult } from '@/domain/engine';
import type { WorkoutSession } from '@/domain/types';
import { today as todayOf } from '@/utils/date';
import { deriveSetupSteps, deriveTodayStep, setupProgress } from '@/domain/nextStep';
import { sleepStats, type SleepNight, type SleepStats } from '@/domain/sleep/sleepStats';
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
  const planRoute = useAppStore((state) => state.planRoute);
  const bodyMeasurements = useAppStore((state) => state.bodyMeasurements);
  const baseline = useAppStore((state) => state.comebackBaseline);
  const weekStartsOn = useAppStore((state) => state.preferences.weekStartsOn);
  const defaultRestSeconds = useAppStore((state) => state.preferences.defaultRestSeconds);
  const nutrition = useAppStore((state) => state.nutritionLog);
  const weatherEnabled = useAppStore((state) => state.weatherEnabled);
  const storedWeather = useAppStore((state) => state.weather);
  const enabledHabits = useAppStore((state) => state.enabledHabits);
  const wakeHour = useAppStore((state) => state.wakeHour);
  const persistBaseline = useAppStore((state) => state.persistBaseline);

  const date = todayOf();
  // Nudges are the only time-of-day sensitive part, and the hour is the finest
  // resolution any of them need — so this is what the memo keys on rather than
  // re-running the whole engine on a timer.
  const hour = new Date().getHours();
  const weather = weatherEnabled ? storedWeather : null;

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
        planRoute,
        bodyMeasurements,
        baseline,
        weekStartsOn,
        defaultRestSeconds,
        nutrition,
        hour,
        weather,
        enabledHabits,
        wakeHour,
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
      planRoute,
      bodyMeasurements,
      baseline,
      weekStartsOn,
      defaultRestSeconds,
      nutrition,
      hour,
      weather,
      enabledHabits,
      wakeHour,
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

/**
 * What the app wants the user to do next, and what is still to be set up.
 *
 * Assembled once here rather than in each screen, so Today and Plan cannot
 * disagree about what the outstanding thing is.
 */
export function useNextStep() {
  const profile = useAppStore((state) => state.profile);
  const goal = useAppStore((state) => state.goal);
  const gyms = useAppStore((state) => state.gyms);
  const routines = useAppStore((state) => state.routines);
  const measurements = useAppStore((state) => state.bodyMeasurements);
  const checkins = useAppStore((state) => state.checkins);
  const sessions = useAppStore((state) => state.sessions);
  const plannedSessions = useAppStore((state) => state.plannedSessions);
  const planRoute = useAppStore((state) => state.planRoute);
  const assessment = useAppStore((state) => state.assessment);
  const activeSessionId = useAppStore((state) => state.activeSessionId);

  const date = todayOf();

  return useMemo(() => {
    const input = {
      today: date,
      profile,
      goal,
      gyms,
      routines,
      measurements,
      checkins,
      sessions,
      plannedSessions,
      hasRoute: planRoute !== null,
      hasAssessment: assessment !== null,
      activeSessionId,
    };

    return {
      setup: deriveSetupSteps(input),
      today: deriveTodayStep(input),
      progress: setupProgress(input),
    };
  }, [
    date,
    profile,
    goal,
    gyms,
    routines,
    measurements,
    checkins,
    sessions,
    plannedSessions,
    planRoute,
    assessment,
    activeSessionId,
  ]);
}

/**
 * Every night the app knows about, from both sources at once.
 *
 * Apple Health carries the stage split and wins where it exists; a check-in
 * the user typed only has hours, and fills the nights Health has nothing for.
 * Merging here rather than in the store keeps the imported data untouched, so
 * a night stays correctable and its real source stays visible.
 */
export function useSleepNights(): SleepNight[] {
  const sleepLog = useAppStore((state) => state.sleepLog);
  const checkins = useAppStore((state) => state.checkins);

  return useMemo(() => {
    const byDate = new Map<string, SleepNight>();

    for (const checkin of checkins) {
      if (checkin.sleepHours === null) continue;
      byDate.set(checkin.date, {
        date: checkin.date,
        hours: checkin.sleepHours,
        stages: null,
        awakeMin: null,
      });
    }
    // Second, so a measured night replaces a typed one for the same date.
    for (const night of sleepLog) byDate.set(night.date, night);

    return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [sleepLog, checkins]);
}

export function useSleepStats(windowDays = 14): SleepStats {
  const nights = useSleepNights();
  const date = todayOf();
  return useMemo(() => sleepStats(nights, date, windowDays), [nights, date, windowDays]);
}
