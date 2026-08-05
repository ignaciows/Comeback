import { describe, expect, it } from 'vitest';

import { sessionLevels } from '@/domain/training/sessionLevels';
import type { WorkoutSession, WorkoutSet } from '@/domain/types';

let counter = 0;
const set = (patch: Partial<WorkoutSet> = {}): WorkoutSet => {
  counter += 1;
  return {
    id: `set-${counter}`,
    order: counter,
    weightKg: 60,
    reps: 8,
    rir: 2,
    warmup: false,
    completed: false,
    completedAt: null,
    ...patch,
  };
};

const session = (
  exercises: { exerciseId: string; sets: WorkoutSet[]; skipped?: boolean }[],
): WorkoutSession => ({
  id: 'session-1',
  date: '2026-02-02',
  startedAt: '2026-02-02T10:00:00.000Z',
  endedAt: null,
  name: 'Upper A',
  routineId: null,
  routineDayId: null,
  plannedSessionId: null,
  intent: 'full',
  status: 'active',
  notes: null,
  pauses: [],
  exercises: exercises.map((entry, index) => ({
    id: `ex-${index}`,
    exerciseId: entry.exerciseId,
    order: index,
    substitutedFrom: null,
    note: null,
    skipped: entry.skipped ?? false,
    sets: entry.sets,
  })),
});

describe('the session as levels', () => {
  it('shows only the sublevels of the level you are on', () => {
    // The whole point of the redesign: twenty-four segments for six exercises
    // asks you to hold the entire workout in your head while doing one set.
    const levels = sessionLevels(
      session([
        { exerciseId: 'bench_press', sets: [set({ completed: true }), set(), set(), set()] },
        { exerciseId: 'row', sets: [set(), set(), set()] },
        { exerciseId: 'ohp', sets: [set(), set()] },
      ]),
    );

    expect(levels!.sublevels).toHaveLength(4);
    expect(levels!.sublevelCount).toBe(4);
    expect(levels!.title).toBe('Level 1 · set 2 of 4');
  });

  it('counts the level among the exercises, and the sublevel among its sets', () => {
    const levels = sessionLevels(
      session([
        { exerciseId: 'bench_press', sets: [set({ completed: true }), set({ completed: true })] },
        { exerciseId: 'row', sets: [set({ completed: true }), set(), set(), set()] },
        { exerciseId: 'ohp', sets: [set(), set()] },
      ]),
    );

    expect(levels!.level).toBe(2);
    expect(levels!.levelCount).toBe(3);
    expect(levels!.sublevel).toBe(2);
    expect(levels!.title).toBe('Level 2 · set 2 of 4');
  });

  it('marks the set that clears the level, before it is logged', () => {
    // Armed on the set in front of you rather than after it, so the pulse
    // lands on the tap instead of a frame later.
    const levels = sessionLevels(
      session([
        {
          exerciseId: 'bench_press',
          sets: [set({ completed: true }), set({ completed: true }), set()],
        },
        { exerciseId: 'row', sets: [set()] },
      ]),
    );

    expect(levels!.lastOfLevel).toBe(true);
  });

  it('does not arm the celebration with sets still to come', () => {
    const levels = sessionLevels(
      session([{ exerciseId: 'bench_press', sets: [set({ completed: true }), set(), set()] }]),
    );

    expect(levels!.lastOfLevel).toBe(false);
  });

  it('reports the whole workout at the foot, with no sublevels in it', () => {
    // Two of five working sets done across two exercises, neither cleared.
    const levels = sessionLevels(
      session([
        { exerciseId: 'bench_press', sets: [set({ completed: true }), set({ completed: true }), set()] },
        { exerciseId: 'row', sets: [set(), set()] },
      ]),
    );

    expect(levels!.overall).toBe(0.4);
    expect(levels!.caption).toBe('0 of 2 exercises · 40 % of the workout');
  });

  it('counts a level as cleared only when every working set of it is done', () => {
    const levels = sessionLevels(
      session([
        { exerciseId: 'bench_press', sets: [set({ completed: true }), set({ completed: true })] },
        { exerciseId: 'row', sets: [set({ completed: true }), set()] },
      ]),
    );

    expect(levels!.levelsCleared).toBe(1);
    expect(levels!.caption).toContain('1 of 2 exercises');
  });

  it('leaves warm-up sets out of the sublevels', () => {
    // A sublevel you cannot fail is not a sublevel, and numbering the first
    // working set as "set 3 of 5" is a lie about what the plan asked for.
    const levels = sessionLevels(
      session([
        {
          exerciseId: 'bench_press',
          sets: [
            set({ warmup: true, completed: true }),
            set({ warmup: true, completed: true }),
            set(),
            set(),
            set(),
          ],
        },
      ]),
    );

    expect(levels!.sublevelCount).toBe(3);
    expect(levels!.title).toBe('Level 1 · set 1 of 3');
  });

  it('says warm-up while the warm-up sets are still in front of you', () => {
    const levels = sessionLevels(
      session([{ exerciseId: 'bench_press', sets: [set({ warmup: true }), set(), set()] }]),
    );

    expect(levels!.sublevel).toBe(0);
    expect(levels!.title).toBe('Level 1 · warm-up');
  });

  it('does not make a skipped exercise a level you failed to clear', () => {
    const levels = sessionLevels(
      session([
        { exerciseId: 'bench_press', sets: [set({ completed: true })] },
        { exerciseId: 'row', sets: [set(), set()], skipped: true },
        { exerciseId: 'ohp', sets: [set()] },
      ]),
    );

    expect(levels!.levelCount).toBe(2);
    expect(levels!.level).toBe(2);
    expect(levels!.exerciseId).toBe('ohp');
    expect(levels!.caption).toContain('1 of 2 exercises');
  });

  it('has no level when the session is empty or finished', () => {
    // Both are states the screen handles on their own, and a hollow level
    // would make "not started" and "finished" look the same to anything
    // reading this.
    expect(sessionLevels(session([]))).toBeNull();
    expect(
      sessionLevels(session([{ exerciseId: 'bench_press', sets: [set({ completed: true })] }])),
    ).toBeNull();
  });
});
