import { describe, expect, it } from 'vitest';

import { finishLine, scoreLine, sessionScore } from '@/domain/training/sessionScore';
import type { WorkoutExercise, WorkoutSession } from '@/domain/types';

let n = 0;
const set = (done = false, warmup = false) => ({
  id: `s${(n += 1)}`, order: n, weightKg: 60, reps: 8, rir: null, warmup, completed: done, completedAt: null,
});
const ex = (id: string, sets: ReturnType<typeof set>[], skipped = false): WorkoutExercise => ({
  id, exerciseId: 'back_squat', order: 0, substitutedFrom: null, note: null, skipped, sets,
});
const session = (exercises: WorkoutExercise[]): WorkoutSession => ({
  id: 's', date: '2026-06-10', startedAt: '2026-06-10T10:00:00Z', endedAt: null, name: 'Push',
  routineId: null, routineDayId: null, plannedSessionId: null, intent: 'full', status: 'active',
  notes: null, pauses: [], exercises,
});
const name = () => 'Back squat';

describe('session score', () => {
  it('lets a session finish even after skipping something', () => {
    // The old bar counted every planned set, so skipping one exercise left it
    // permanently short — and a bar that cannot fill stops being looked at.
    const score = sessionScore(
      session([ex('a', [set(true), set(true)]), ex('b', [set(), set()], true)]),
      name,
    );

    expect(score.progress).toBe(1);
    expect(score.ofPlanned).toBe(0.5);
    expect(score.exercisesSkipped).toBe(1);
  });

  it('keeps the sets you did before giving up on an exercise', () => {
    const score = sessionScore(session([ex('a', [set(true), set(), set()], true)]), name);
    expect(score.setsDone).toBe(1);
    expect(score.setsPlanned).toBe(3);
  });

  it('draws one cell per set so the grid fills as you go', () => {
    const score = sessionScore(session([ex('a', [set(true), set(true), set(), set()])]), name);
    expect(score.blocks[0].cells).toEqual(['done', 'done', 'todo', 'todo']);
    expect(score.blocks[0].state).toBe('current');
  });

  it('marks the unfinished cells of a skipped exercise as skipped, not pending', () => {
    const score = sessionScore(session([ex('a', [set(true), set()], true)]), name);
    expect(score.blocks[0].cells).toEqual(['done', 'skipped']);
  });

  it('never counts warm-up towards the score', () => {
    const score = sessionScore(session([ex('a', [set(true, true), set(true), set()])]), name);
    expect(score.setsDone).toBe(1);
    expect(score.setsCommitted).toBe(2);
  });

  it('says what was skipped rather than leaving the total unexplained', () => {
    const score = sessionScore(session([ex('a', [set(true)]), ex('b', [set()], true)]), name);
    expect(scoreLine(score)).toBe('1 of 1 sets · 1 skipped');
  });

  it('calls finishing what you committed to finishing', () => {
    const partial = sessionScore(session([ex('a', [set(true)]), ex('b', [set()], true)]), name);
    expect(finishLine(partial)).toContain('Finished what you committed to');

    const whole = sessionScore(session([ex('a', [set(true), set(true)])]), name);
    expect(finishLine(whole)).toContain('start to finish');

    expect(finishLine(sessionScore(session([ex('a', [set()])]), name))).toContain('Nothing logged');
  });

  it('opens exactly one current exercise', () => {
    const score = sessionScore(
      session([ex('a', [set(true)]), ex('b', [set()]), ex('c', [set()])]),
      name,
    );
    expect(score.blocks.map((b) => b.state)).toEqual(['done', 'current', 'ahead']);
  });
});
