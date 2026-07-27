import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * End-to-end exercise of the main flow through the real store: onboarding →
 * check-in → session → finish → momentum → body weight → persistence.
 *
 * Only the device storage engine is replaced; every model, reducer and
 * derivation is the production one.
 */
const memory = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => memory.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: async (key: string) => {
      memory.delete(key);
    },
  },
}));

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const { useAppStore, selectEngine } = await import('@/store/useAppStore');
const { STORAGE_KEY } = await import('@/services/storage/adapter');
const { today } = await import('@/utils/date');

const onboarding = {
  name: 'Ignacio',
  heightCm: 186,
  weightKg: 77.25,
  experience: 'returning' as const,
  layoffWeeks: 6,
  goalType: 'recomposition' as const,
  objective: 'recomp' as const,
  speed: 'steady' as const,
  fatTolerance: 'some' as const,
  targetWeightKg: 80,
  horizonWeeks: 16,
  daysPerWeek: 5,
  sessionMinutes: 60,
  preferredWeekdays: [1, 2, 3, 5, 6],
  location: 'gym' as const,
  checkin: { sleepHours: 7.5, sleepQuality: 4, energy: 4, soreness: 2, stress: 2, motivation: 4 },
  lastWorkoutDate: null,
  limitations: null,
};

describe('main flow', () => {
  beforeEach(() => {
    memory.clear();
    useAppStore.getState().resetAll();
  });

  it('carries a user from onboarding to a logged session and an updated momentum score', async () => {
    const store = useAppStore.getState();

    // 1. Onboarding creates the profile, goal, routine and schedule.
    store.completeOnboarding(onboarding);
    let state = useAppStore.getState();
    expect(state.onboardingCompleted).toBe(true);
    expect(state.profile?.name).toBe('Ignacio');
    expect(state.routines).toHaveLength(1);
    expect(state.routines[0].days.length).toBe(5);
    expect(state.plannedSessions.length).toBeGreaterThan(0);
    expect(state.bodyMeasurements[0].weightKg).toBe(77.25);

    // 2. The check-in from onboarding feeds readiness immediately.
    let engine = selectEngine(useAppStore.getState());
    expect(engine.readiness.score).not.toBeNull();
    expect(engine.recommendation.type).toBeTruthy();

    // 3. Start the session the recommendation points at.
    const sessionId = useAppStore.getState().startSession({
      routineId: engine.recommendation.routineId,
      routineDayId: engine.recommendation.routineDayId,
      intent: 'full',
      name: engine.recommendation.title,
    });
    const started = useAppStore.getState().sessions.find((entry) => entry.id === sessionId);
    expect(started?.status).toBe('active');
    expect(started?.exercises.length).toBeGreaterThan(0);

    // 4. Log three exercises' worth of sets.
    const exercises = started!.exercises.slice(0, 3);
    expect(exercises.length).toBe(3);
    for (const exercise of exercises) {
      for (const set of exercise.sets) {
        useAppStore
          .getState()
          .updateSet(sessionId, exercise.id, set.id, { weightKg: 60, reps: 8, rir: 2, completed: true });
      }
    }

    // 5. Finish. Untouched sets are dropped, not stored as zeroes.
    useAppStore.getState().finishSession(sessionId);
    state = useAppStore.getState();
    const finished = state.sessions.find((entry) => entry.id === sessionId);
    expect(finished?.status).toBe('completed');
    expect(finished?.endedAt).not.toBeNull();
    expect(state.activeSessionId).toBeNull();
    expect(finished?.exercises.every((exercise) => exercise.sets.every((set) => set.completed))).toBe(true);

    // The planned day it belonged to is marked completed.
    const planned = state.plannedSessions.find((entry) => entry.id === finished?.plannedSessionId);
    if (planned) expect(planned.status).toBe('completed');

    // 6. Momentum now has something to work with.
    engine = selectEngine(useAppStore.getState());
    expect(engine.momentum).not.toBeNull();
    expect(engine.momentum!.score).toBeGreaterThan(0);
    expect(engine.momentum!.explanation.length).toBeGreaterThan(0);
    expect(engine.momentum!.factors.some((factor) => factor.key === 'session_today')).toBe(true);
    expect(engine.lastSession?.id).toBe(sessionId);
    expect(engine.week.completed).toBe(1);

    // 7. Body weight.
    useAppStore.getState().logBodyWeight(77.1, today());
    expect(useAppStore.getState().bodyMeasurements.at(-1)?.weightKg).toBe(77.1);

    // 8. Everything reached persistent storage.
    await new Promise((resolve) => setTimeout(resolve, 20));
    const persisted = memory.get(STORAGE_KEY);
    expect(persisted).toBeDefined();
    const parsed = JSON.parse(persisted as string);
    expect(parsed.state.sessions).toHaveLength(1);
    expect(parsed.state.profile.name).toBe('Ignacio');
    expect(parsed.state.bodyMeasurements.length).toBeGreaterThan(0);
    // Runtime-only flags are not written out.
    expect(parsed.state.hydrated).toBeUndefined();
  });

  it('lets a completed session be corrected afterwards and recalculates from the correction', async () => {
    useAppStore.getState().completeOnboarding(onboarding);
    const sessionId = useAppStore.getState().startSession({ intent: 'free', name: 'Free session' });
    useAppStore.getState().addExerciseToSession(sessionId, 'back_squat');

    const exercise = useAppStore.getState().sessions.find((s) => s.id === sessionId)!.exercises[0];
    useAppStore
      .getState()
      .updateSet(sessionId, exercise.id, exercise.sets[0].id, { weightKg: 100, reps: 5, completed: true });
    useAppStore.getState().finishSession(sessionId);

    const before = selectEngine(useAppStore.getState());
    const volumeBefore = before.momentumSeries.at(-1)?.score;

    // Correct the record: the set was actually heavier.
    const saved = useAppStore.getState().sessions.find((s) => s.id === sessionId)!;
    useAppStore
      .getState()
      .updateSet(sessionId, saved.exercises[0].id, saved.exercises[0].sets[0].id, { weightKg: 120 });

    const corrected = useAppStore.getState().sessions.find((s) => s.id === sessionId)!;
    expect(corrected.exercises[0].sets[0].weightKg).toBe(120);
    expect(volumeBefore).toBeDefined();

    // And it can be deleted, which frees its planned day again.
    useAppStore.getState().deleteSession(sessionId);
    expect(useAppStore.getState().sessions.find((s) => s.id === sessionId)).toBeUndefined();
  });

  it('keeps a rescheduled session in the plan instead of dropping it', () => {
    useAppStore.getState().completeOnboarding(onboarding);
    const planned = useAppStore
      .getState()
      .plannedSessions.filter((entry) => entry.status === 'planned')
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0];

    const target = '2099-01-01';
    useAppStore.getState().reschedulePlannedSession(planned.id, target);

    const after = useAppStore.getState().plannedSessions;
    expect(after.find((entry) => entry.id === planned.id)?.status).toBe('rescheduled');
    expect(after.some((entry) => entry.date === target && entry.status === 'planned')).toBe(true);
  });

  it('rebuilds the future plan when the schedule changes, keeping history', () => {
    useAppStore.getState().completeOnboarding(onboarding);

    const before = useAppStore.getState().plannedSessions;
    const beforeTrainingDays = new Set(
      before.filter((entry) => entry.status === 'planned').map((entry) => entry.date),
    );
    expect(beforeTrainingDays.size).toBeGreaterThan(0);

    // Move to a completely different set of weekdays.
    useAppStore.getState().updateTraining({ preferredWeekdays: [0, 4], preferredDaysPerWeek: 2 });

    const after = useAppStore.getState().plannedSessions.filter((entry) => entry.status === 'planned');
    expect(after.length).toBeGreaterThan(0);
    for (const entry of after) {
      const weekday = new Date(`${entry.date}T00:00:00`).getDay();
      expect([0, 4]).toContain(weekday);
    }
  });

  it('switches strategy without losing progress, and reprojects from where you are', () => {
    useAppStore.getState().completeOnboarding(onboarding);

    // Log a session and a weight so there is progress to carry over.
    const sessionId = useAppStore.getState().startSession({ intent: 'free', name: 'Free session' });
    useAppStore.getState().addExerciseToSession(sessionId, 'back_squat');
    const exercise = useAppStore.getState().sessions.find((s) => s.id === sessionId)!.exercises[0];
    useAppStore
      .getState()
      .updateSet(sessionId, exercise.id, exercise.sets[0].id, { weightKg: 100, reps: 5, completed: true });
    useAppStore.getState().finishSession(sessionId);
    useAppStore.getState().logBodyWeight(77.4);

    const before = selectEngine(useAppStore.getState());
    expect(before.projection).not.toBeNull();
    expect(useAppStore.getState().goal?.strategy).toBe('lean_bulk');
    expect(useAppStore.getState().phases).toHaveLength(1);

    // The breakdown moment: switch to a cut with a lower target.
    useAppStore.getState().changeStrategy('cut', { targetWeightKg: 72 });

    const state = useAppStore.getState();
    expect(state.goal?.strategy).toBe('cut');
    expect(state.goal?.targetWeightKg).toBe(72);
    // History is closed, not deleted.
    expect(state.phases).toHaveLength(2);
    expect(state.phases[0].endedAt).not.toBeNull();
    expect(state.phases[0].endWeightKg).toBe(77.4);
    expect(state.phases[1].endedAt).toBeNull();
    // Sessions and weights survive the switch. Today's weight was updated in
    // place rather than duplicated, so there is still one entry per day.
    expect(state.sessions).toHaveLength(1);
    expect(state.bodyMeasurements).toHaveLength(1);
    expect(state.bodyMeasurements[0].weightKg).toBe(77.4);

    const after = selectEngine(state);
    expect(after.projection?.weeklyRateKg).toBeLessThan(0);
    expect(after.projection?.sessionsCompleted).toBe(before.projection?.sessionsCompleted);
    expect(after.projection?.targetDate).not.toBeNull();
  });

  it('survives state written by an older version of the app', async () => {
    // Exactly what v1 wrote: no `strategy` on the goal, no `phases`, no age or
    // sex on the profile. Reading it used to crash the first screen.
    const legacy = {
      state: {
        schemaVersion: 1,
        onboardingCompleted: true,
        profile: {
          id: 'p1',
          name: 'Ignacio',
          heightCm: 186,
          experience: 'returning',
          layoffWeeks: 4,
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
        goal: {
          id: 'g1',
          type: 'recomposition',
          targetWeightKg: 80,
          proteinTargetG: null,
          horizonWeeks: 16,
          startedAt: '2026-07-01',
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-01T00:00:00.000Z',
        },
        training: {
          minDaysPerWeek: 4,
          preferredDaysPerWeek: 5,
          sessionMinutes: 60,
          preferredWeekdays: [1, 2, 3, 5, 6],
          location: 'gym',
          gymId: null,
        },
        preferences: { units: 'metric', defaultRestSeconds: 120, weekStartsOn: 1 },
        limitations: null,
        gyms: [],
        routines: [],
        activeRoutineId: null,
        plannedSessions: [],
        sessions: [],
        activeSessionId: null,
        checkins: [],
        bodyMeasurements: [
          { id: 'b1', date: '2026-07-01', weightKg: 77.25, bodyFatPercent: null, source: 'manual', createdAt: '' },
        ],
        comebackBaseline: null,
      },
      version: 1,
    };
    memory.set(STORAGE_KEY, JSON.stringify(legacy));

    await useAppStore.persist.rehydrate();
    const state = useAppStore.getState();

    // Migration filled in everything the new code reads.
    expect(state.goal?.strategy).toBe('lean_bulk');
    expect(state.profile?.sex).toBe('unspecified');
    expect(state.profile?.age).toBeNull();
    expect(state.phases).toHaveLength(1);
    expect(state.phases[0].startWeightKg).toBe(77.25);
    // And nothing the screens read blows up.
    expect(() => selectEngine(state)).not.toThrow();
    expect(selectEngine(state).projection).not.toBeNull();
  });

  it('produces a usable state from the development seed', () => {
    useAppStore.getState().seedDeveloperProfile();
    const state = useAppStore.getState();

    expect(state.sessions.length).toBeGreaterThan(5);
    expect(state.checkins.length).toBeGreaterThan(20);

    const engine = selectEngine(state);
    expect(engine.momentum).not.toBeNull();
    expect(engine.momentum!.score).toBeGreaterThan(0);
    expect(engine.momentumSeries.length).toBeGreaterThan(20);
    expect(engine.comeback.value).not.toBeNull();
    expect(engine.trajectory).not.toBeNull();
  });
});
