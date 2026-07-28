import { describe, expect, it } from 'vitest';

import { buildInitialRoutine } from '@/data/routineTemplates';
import { getExercise } from '@/data/exercises';
import {
  VOLUME_BANDS,
  applyEmphasis,
  volumeBreakdown,
  weeklySetsByMuscle,
} from '@/domain/training/volume';
import type { MuscleGroup } from '@/domain/types';

const routine = buildInitialRoutine({
  daysPerWeek: 4,
  sessionMinutes: 70,
  location: 'gym',
  goalType: 'recomposition',
  layoffWeeks: 0,
});

describe('weekly volume', () => {
  it('counts the muscle an exercise is built around in full', () => {
    const sets = weeklySetsByMuscle(routine);
    expect(sets.chest ?? 0).toBeGreaterThan(0);
    expect(sets.back ?? 0).toBeGreaterThan(0);
  });

  it('counts an assisting muscle at half', () => {
    const single = {
      ...routine,
      days: [
        {
          id: 'd',
          order: 0,
          name: 'Day',
          focus: ['chest' as MuscleGroup],
          exercises: [
            { id: 'e', exerciseId: 'barbell_bench_press', order: 0, sets: 4, repMin: 6, repMax: 8, restSeconds: 180 },
          ],
        },
      ],
    };

    const sets = weeklySetsByMuscle(single);
    expect(sets.chest).toBe(4);
    expect(sets.triceps).toBe(2);
  });

  it('has nothing to report without a routine', () => {
    expect(weeklySetsByMuscle(null)).toEqual({});
  });

  it('marks a muscle under the maintenance floor', () => {
    const breakdown = volumeBreakdown(routine);
    const calves = breakdown.find((entry) => entry.muscle === 'calves');
    // A four-day upper/lower does not carry much direct calf work.
    expect(calves).toBeDefined();
    if ((calves?.sets ?? 0) < VOLUME_BANDS.maintenance) {
      expect(calves?.status).toBe('under');
    }
  });

  it('holds a focused muscle to a higher floor than a carried one', () => {
    const plain = volumeBreakdown(routine).find((entry) => entry.muscle === 'biceps');
    const focused = volumeBreakdown(routine, ['biceps']).find((entry) => entry.muscle === 'biceps');

    expect(plain?.sets).toBe(focused?.sets);
    expect(focused?.focused).toBe(true);
    // Same volume, judged against a stricter bar once it is the priority.
    if ((plain?.sets ?? 0) >= VOLUME_BANDS.maintenance && (plain?.sets ?? 0) < VOLUME_BANDS.target) {
      expect(plain?.status).toBe('in_range');
      expect(focused?.status).toBe('under');
    }
  });
});

describe('shifting the routine towards chosen muscles', () => {
  it('changes nothing when no muscle is picked', () => {
    const result = applyEmphasis(routine, []);
    expect(result.changed).toBe(false);
    expect(result.routine).toBe(routine);
  });

  it('adds volume to the picked muscle', () => {
    const before = weeklySetsByMuscle(routine).shoulders ?? 0;
    const result = applyEmphasis(routine, ['shoulders']);
    const after = weeklySetsByMuscle(result.routine).shoulders ?? 0;

    expect(after).toBeGreaterThan(before);
    expect(result.deltas.shoulders).toBeGreaterThan(0);
    expect(result.changed).toBe(true);
  });

  it('takes the volume from somewhere rather than only adding', () => {
    const result = applyEmphasis(routine, ['biceps']);
    const removed = Object.entries(result.deltas).filter(([, delta]) => (delta as number) < 0);
    expect(removed.length).toBeGreaterThan(0);
  });

  it('never cuts a muscle below the maintenance floor', () => {
    const result = applyEmphasis(routine, ['calves']);
    const after = weeklySetsByMuscle(result.routine);
    const before = weeklySetsByMuscle(routine);

    for (const [muscle, sets] of Object.entries(after)) {
      const previous = before[muscle as MuscleGroup] ?? 0;
      // Anything that started above the floor stays at or above it.
      if (previous >= VOLUME_BANDS.maintenance) {
        expect(sets).toBeGreaterThanOrEqual(VOLUME_BANDS.maintenance);
      }
    }
  });

  it('never stacks more than five working sets on one movement', () => {
    const result = applyEmphasis(routine, ['chest', 'back', 'shoulders']);
    for (const day of result.routine.days) {
      for (const entry of day.exercises) {
        expect(entry.sets).toBeLessThanOrEqual(5);
        expect(entry.sets).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('will not add a movement the gym cannot do', () => {
    // A machines-only gym: nothing added may need a barbell or dumbbells.
    const result = applyEmphasis(routine, ['calves'], {
      barbell: 'unavailable',
      dumbbell: 'unavailable',
      rack: 'unavailable',
      machine: 'available',
      cable: 'available',
      bench: 'available',
      bodyweight: 'available',
    });

    const existing = new Set(routine.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId)));
    const added = result.routine.days
      .flatMap((day) => day.exercises.map((entry) => entry.exerciseId))
      .filter((id) => !existing.has(id));

    for (const id of added) {
      const exercise = getExercise(id);
      expect(exercise?.equipment).not.toContain('barbell');
      expect(exercise?.equipment).not.toContain('dumbbell');
    }
  });

  it('keeps the original routine untouched', () => {
    const snapshot = JSON.stringify(routine);
    applyEmphasis(routine, ['chest']);
    expect(JSON.stringify(routine)).toBe(snapshot);
  });
});
