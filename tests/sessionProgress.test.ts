import { describe, expect, it } from 'vitest';

import { describePause, formatClock, sessionProgress, sessionStage } from '@/domain/training/sessionProgress';
import { buildPhases } from '@/domain/plan/phases';
import type { SessionPause, WorkoutSession } from '@/domain/types';

const START = '2026-05-01T18:00:00.000Z';

function session(options: {
  pauses?: SessionPause[];
  endedAt?: string | null;
  exercises?: { sets: number; done: number; skipped?: boolean }[];
} = {}): WorkoutSession {
  const { pauses = [], endedAt = null, exercises = [{ sets: 3, done: 1 }] } = options;

  return {
    id: 's1',
    date: '2026-05-01',
    startedAt: START,
    endedAt,
    name: 'Session',
    routineId: null,
    routineDayId: null,
    plannedSessionId: null,
    intent: 'full',
    status: endedAt ? 'completed' : 'active',
    notes: null,
    pauses,
    exercises: exercises.map((entry, index) => ({
      id: `we${index}`,
      exerciseId: 'barbell_bench_press',
      order: index,
      substitutedFrom: null,
      note: null,
      skipped: entry.skipped ?? false,
      sets: Array.from({ length: entry.sets }, (_, setIndex) => ({
        id: `set${index}-${setIndex}`,
        order: setIndex,
        weightKg: 60,
        reps: 8,
        rir: null,
        warmup: false,
        completed: setIndex < entry.done,
        completedAt: setIndex < entry.done ? START : null,
      })),
    })),
  };
}

/** Twenty minutes after the session started. */
const at = (minutes: number) => new Date(new Date(START).getTime() + minutes * 60_000);

describe('how far into the session you are', () => {
  it('counts working sets against what is laid out', () => {
    const progress = sessionProgress(session({ exercises: [{ sets: 4, done: 3 }] }), at(20));

    expect(progress.setsDone).toBe(3);
    expect(progress.setsPlanned).toBe(4);
    expect(progress.completion).toBe(0.75);
  });

  it('does not count a skipped exercise against you', () => {
    const progress = sessionProgress(
      session({ exercises: [{ sets: 3, done: 3 }, { sets: 3, done: 0, skipped: true }] }),
      at(20),
    );

    // Leaving one out is a decision, not a shortfall.
    expect(progress.setsPlanned).toBe(3);
    expect(progress.completion).toBe(1);
    expect(progress.exercisesPlanned).toBe(1);
  });

  it('subtracts paused time from the session length', () => {
    const pauses: SessionPause[] = [
      { id: 'p1', startedAt: at(5).toISOString(), endedAt: at(12).toISOString() },
    ];
    const progress = sessionProgress(session({ pauses }), at(30));

    expect(progress.elapsedSeconds).toBe(30 * 60);
    expect(progress.pausedSeconds).toBe(7 * 60);
    expect(progress.activeSeconds).toBe(23 * 60);
    expect(progress.isPaused).toBe(false);
  });

  it('reports a pause that is still running', () => {
    const pauses: SessionPause[] = [{ id: 'p1', startedAt: at(10).toISOString(), endedAt: null }];
    const progress = sessionProgress(session({ pauses }), at(14));

    expect(progress.isPaused).toBe(true);
    expect(progress.currentPauseSeconds).toBe(4 * 60);
    expect(progress.activeSeconds).toBe(10 * 60);
  });

  it('changes nothing for someone who never pauses', () => {
    const progress = sessionProgress(session(), at(45));

    expect(progress.pausedSeconds).toBe(0);
    expect(progress.activeSeconds).toBe(progress.elapsedSeconds);
    expect(progress.currentPauseSeconds).toBeNull();
  });

  it('stops the clock at the end of a finished session', () => {
    const progress = sessionProgress(
      session({ endedAt: at(50).toISOString() }),
      // Read an hour after it finished; the length must not grow.
      at(110),
    );

    expect(progress.elapsedSeconds).toBe(50 * 60);
  });
});

describe('the session clock', () => {
  it('reads as a clock', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });

  it('describes a pause against your own rest, without judging it', () => {
    expect(describePause(60, 120)).toMatch(/normal rest/i);
    expect(describePause(240, 120)).toMatch(/longer/i);
    expect(describePause(600, 120)).toMatch(/lighter first set/i);
    expect(describePause(1800, 120)).toMatch(/warm up again/i);
  });
});

describe('phases of the plan', () => {
  it('has nothing to show without a route or a horizon', () => {
    expect(buildPhases({ today: '2026-05-01', sessions: [], simulation: null, fallback: null })).toEqual([]);
  });

  it('cuts a long single stretch into readable phases', () => {
    const phases = buildPhases({
      today: '2026-05-01',
      sessions: [],
      simulation: null,
      fallback: {
        startsOn: '2026-05-01',
        endsOn: '2026-11-01',
        strategy: 'lean_bulk',
        totalWeightChangeKg: 6,
        leanChangeKg: 4,
        fatChangeKg: 2,
        kcal: 2800,
      },
    });

    // Six months is not one phase, and not thirty either.
    expect(phases.length).toBeGreaterThan(2);
    expect(phases.length).toBeLessThanOrEqual(8);
    expect(phases[0].state).toBe('current');
    expect(phases[phases.length - 1].state).toBe('ahead');
  });

  it('says what a building phase costs, and where it gets fixed', () => {
    const phases = buildPhases({
      today: '2026-05-01',
      sessions: [],
      simulation: null,
      fallback: {
        startsOn: '2026-05-01',
        endsOn: '2026-08-01',
        strategy: 'bulk',
        totalWeightChangeKg: 6,
        leanChangeKg: 3,
        fatChangeKg: 3,
        kcal: 3000,
      },
    });

    expect(phases[0].story).toMatch(/gain/i);
    expect(phases[0].story).toMatch(/muscle/i);
    // Fat is named rather than hidden behind the muscle number.
    expect(phases[0].story).toMatch(/fat/i);
  });

  it('tells someone holding weight to stop watching the scale', () => {
    const phases = buildPhases({
      today: '2026-05-01',
      sessions: [],
      simulation: null,
      fallback: {
        startsOn: '2026-05-01',
        endsOn: '2026-08-01',
        strategy: 'maintain',
        totalWeightChangeKg: 0,
        leanChangeKg: 1.5,
        fatChangeKg: -1.5,
        kcal: 2600,
      },
    });

    expect(phases[0].story).toMatch(/scale is the wrong thing/i);
  });
});

describe('telling an empty session from a finished one', () => {
  it('calls a session with nothing laid out empty, not complete', () => {
    // A free session starts with no exercises. Congratulating someone who has
    // not lifted anything — and offering to save it — is the bug this guards.
    const progress = sessionProgress(session({ exercises: [] }));

    expect(progress.setsPlanned).toBe(0);
    expect(sessionStage(progress)).toBe('empty');
  });

  it('calls it complete only once every laid-out set is done', () => {
    expect(sessionStage(sessionProgress(session({ exercises: [{ sets: 3, done: 1 }] })))).toBe('working');
    expect(sessionStage(sessionProgress(session({ exercises: [{ sets: 3, done: 3 }] })))).toBe('complete');
  });

  it('ignores skipped exercises when deciding, so skipping the rest finishes the session', () => {
    const progress = sessionProgress(
      session({ exercises: [{ sets: 2, done: 2 }, { sets: 3, done: 0, skipped: true }] }),
    );

    expect(sessionStage(progress)).toBe('complete');
  });
});
