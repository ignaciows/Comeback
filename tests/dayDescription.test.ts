import { describe, expect, it } from 'vitest';

import { buildInitialRoutine } from '@/data/routineTemplates';
import { describeDay } from '@/domain/training/dayDescription';
import type { RoutineDay } from '@/domain/types';

const day = (exercises: { exerciseId: string; sets: number }[]): RoutineDay => ({
  id: 'd1',
  order: 0,
  name: 'Upper A',
  focus: [],
  exercises: exercises.map((entry, index) => ({
    id: `e${index}`,
    order: index,
    exerciseId: entry.exerciseId,
    sets: entry.sets,
    repMin: 8,
    repMax: 12,
    restSeconds: 120,
  })),
});

describe('explaining what a training day is', () => {
  it('names the muscles from the exercises, not from the day name', () => {
    const description = describeDay(
      day([
        { exerciseId: 'barbell_bench_press', sets: 4 },
        { exerciseId: 'barbell_row', sets: 4 },
        { exerciseId: 'overhead_press', sets: 3 },
      ]),
    );

    expect(description.muscles).toMatch(/chest/);
    expect(description.muscles).toMatch(/back/);
    expect(description.plain).toMatch(/above the waist/i);
    expect(description.exercises).toBe(3);
    expect(description.sets).toBe(11);
  });

  it('calls a leg day a leg day', () => {
    const description = describeDay(
      day([
        { exerciseId: 'back_squat', sets: 4 },
        { exerciseId: 'romanian_deadlift', sets: 3 },
        { exerciseId: 'leg_press', sets: 3 },
      ]),
    );

    expect(description.plain).toMatch(/legs and hips/i);
  });

  it('calls a mixed day a whole-body day', () => {
    const description = describeDay(
      day([
        { exerciseId: 'back_squat', sets: 4 },
        { exerciseId: 'barbell_bench_press', sets: 4 },
        { exerciseId: 'barbell_row', sets: 4 },
      ]),
    );

    expect(description.plain).toMatch(/whole body/i);
  });

  it('leaves out a muscle that is barely touched', () => {
    // One set of calves at the end of a chest day is not what the day is about,
    // and listing it makes the sentence useless.
    const description = describeDay(
      day([
        { exerciseId: 'barbell_bench_press', sets: 5 },
        { exerciseId: 'incline_dumbbell_press', sets: 4 },
        { exerciseId: 'cable_fly', sets: 4 },
        { exerciseId: 'standing_calf_raise', sets: 1 },
      ]),
    );

    expect(description.groups).not.toContain('calves');
  });

  it('reads as a sentence, not a database row', () => {
    const description = describeDay(
      day([
        { exerciseId: 'barbell_bench_press', sets: 4 },
        { exerciseId: 'barbell_row', sets: 4 },
        { exerciseId: 'overhead_press', sets: 4 },
      ]),
    );

    expect(description.muscles).toMatch(/ and /);
    expect(description.muscles).not.toMatch(/,\s*\w+$/);
  });

  it('says something for every day of every routine the app can build', () => {
    for (const daysPerWeek of [2, 3, 4, 5, 6]) {
      const routine = buildInitialRoutine({
        daysPerWeek,
        sessionMinutes: 60,
        location: 'gym',
        goalType: 'recomposition',
        layoffWeeks: 4,
      });

      for (const entry of routine.days) {
        const description = describeDay(entry);
        expect(description.plain.length, `${daysPerWeek} days: ${entry.name}`).toBeGreaterThan(20);
        expect(description.groups.length, `${daysPerWeek} days: ${entry.name}`).toBeGreaterThan(0);
        expect(description.plain).not.toMatch(/undefined|NaN/);
      }
    }
  });

  it('copes with an empty day rather than producing a broken sentence', () => {
    const description = describeDay(day([]));

    expect(description.groups).toEqual([]);
    expect(description.plain).toMatch(/nothing/i);
  });
});
