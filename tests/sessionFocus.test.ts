import { describe, expect, it } from 'vitest';

import { focusLabel, sessionFocus } from '@/domain/training/sessionFocus';
import type { WorkoutExercise, WorkoutSession } from '@/domain/types';

let counter = 0;
const set = (opts: { done?: boolean; warmup?: boolean; kg?: number; reps?: number } = {}) => ({
  id: `set${(counter += 1)}`,
  order: counter,
  weightKg: opts.kg ?? 60,
  reps: opts.reps ?? 8,
  rir: null,
  warmup: opts.warmup ?? false,
  completed: opts.done ?? false,
  completedAt: null,
});

const exercise = (id: string, sets: ReturnType<typeof set>[], skipped = false): WorkoutExercise => ({
  id,
  exerciseId: 'barbell_bench_press',
  order: 0,
  substitutedFrom: null,
  note: null,
  skipped,
  sets,
});

const session = (exercises: WorkoutExercise[]): WorkoutSession => ({
  id: 's',
  date: '2026-06-10',
  startedAt: '2026-06-10T10:00:00Z',
  endedAt: null,
  name: 'Push',
  routineId: null,
  routineDayId: null,
  plannedSessionId: null,
  intent: 'full',
  status: 'active',
  notes: null,
  pauses: [],
  exercises,
});

describe('session focus', () => {
  it('opens exactly one exercise, the first with work left', () => {
    const focus = sessionFocus(
      session([
        exercise('a', [set({ done: true }), set({ done: true })]),
        exercise('b', [set({ done: true }), set()]),
        exercise('c', [set(), set()]),
      ]),
    );

    expect(focus.items.map((item) => item.state)).toEqual(['done', 'current', 'upcoming']);
    expect(focus.currentId).toBe('b');
    expect(focus.items.filter((item) => item.state === 'current')).toHaveLength(1);
  });

  it('moves along on its own when the last set is ticked', () => {
    const before = sessionFocus(session([exercise('a', [set({ done: true }), set()]), exercise('b', [set()])]));
    const after = sessionFocus(session([exercise('a', [set({ done: true }), set({ done: true })]), exercise('b', [set()])]));

    expect(before.currentId).toBe('a');
    expect(after.currentId).toBe('b');
  });

  it('counts only what you are actually doing', () => {
    const focus = sessionFocus(
      session([
        exercise('a', [set({ done: true })]),
        exercise('b', [set()], true), // skipped
        exercise('c', [set()]),
      ]),
    );

    // Skipping the second movement must move you to "2 of 2", not leave a hole.
    expect(focus.total).toBe(2);
    expect(focus.position).toBe(2);
    expect(focusLabel(focus)).toBe('2 of 2');
  });

  it('ignores warm-up sets, which are not progress', () => {
    const focus = sessionFocus(
      session([exercise('a', [set({ warmup: true }), set({ warmup: true }), set({ done: true }), set()])]),
    );

    expect(focus.items[0].setsPlanned).toBe(2);
    expect(focus.items[0].setsDone).toBe(1);
  });

  it('says the session is finished rather than pointing at nothing', () => {
    const focus = sessionFocus(session([exercise('a', [set({ done: true })]), exercise('b', [set({ done: true })])]));

    expect(focus.currentId).toBeNull();
    expect(focus.position).toBe(2);
    expect(focusLabel(focus)).toBe('All 2 done');
  });

  it('summarises a finished exercise by its top set', () => {
    const focus = sessionFocus(
      session([exercise('a', [set({ done: true, kg: 60 }), set({ done: true, kg: 80 }), set({ done: true, kg: 70 })])]),
    );
    expect(focus.items[0].summary).toBe('3 sets · top 80 kg');
  });

  it('summarises an upcoming exercise by the work it asks for', () => {
    const focus = sessionFocus(
      session([exercise('a', [set({ done: true })]), exercise('b', [set({ reps: 10 }), set({ reps: 10 }), set({ reps: 10 })])]),
    );
    expect(focus.items[1].summary).toBe('3 × 10');
  });

  it('handles a session nobody has filled in', () => {
    const focus = sessionFocus(session([]));
    expect(focus.currentId).toBeNull();
    expect(focusLabel(focus)).toBe('Nothing added yet');
  });
});
