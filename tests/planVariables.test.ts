import { describe, expect, it } from 'vitest';

import {
  PLAN_VARIABLES,
  changedVariables,
  describeChange,
  planVariablesOf,
  valueLabel,
  type PlanVariables,
} from '@/domain/plan/planVariables';
import type { Goal, TrainingPreferences } from '@/domain/types';

const goal: Goal = {
  id: 'goal-1',
  type: 'build_muscle',
  objective: 'build',
  speed: 'steady',
  fatTolerance: 'some',
  maxBodyFatPercent: 17,
  strategy: 'lean_bulk',
  muscleFocus: ['chest', 'back'],
  targetWeightKg: 85,
  proteinTargetG: 160,
  horizonWeeks: 24,
  startedAt: '2026-01-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const training: TrainingPreferences = {
  minDaysPerWeek: 3,
  preferredDaysPerWeek: 4,
  sessionMinutes: 60,
  preferredWeekdays: [1, 3, 5],
  location: 'gym',
  gymId: null,
  guided: true,
};

const variables = (patch: Partial<PlanVariables> = {}): PlanVariables => ({
  ...planVariablesOf(goal, training),
  ...patch,
});

describe('the plan variables, gathered in one place', () => {
  it('reads every lever off the stored goal and training preferences', () => {
    const current = planVariablesOf(goal, training);

    expect(current).toEqual({
      objective: 'build',
      speed: 'steady',
      fatTolerance: 'some',
      maxBodyFatPercent: 17,
      muscleFocus: ['chest', 'back'],
      daysPerWeek: 4,
      sessionMinutes: 60,
      horizonWeeks: 24,
    });
  });

  it('covers every lever with a definition the screen can render', () => {
    // The screen is generated from this list rather than hand-written, which
    // is what stops a lever being added later that quietly skips the recalc.
    const keys = PLAN_VARIABLES.map((definition) => definition.key).sort();
    const fields = Object.keys(planVariablesOf(goal, training)).sort();

    expect(keys).toEqual(fields);
  });

  it('offers the current value as one of the options, for every lever', () => {
    // A control that cannot display the value it is holding reads as broken.
    const current = planVariablesOf(goal, training);

    for (const definition of PLAN_VARIABLES) {
      if (definition.kind === 'muscles') continue;
      const values = definition.options.map((option) => option.value);
      expect(values, definition.key).toContain(current[definition.key]);
    }
  });

  it('notices a change to any lever, including the ones that are lists', () => {
    expect(changedVariables(variables(), variables())).toEqual([]);
    expect(changedVariables(variables(), variables({ speed: 'fast' }))).toEqual(['speed']);
    expect(changedVariables(variables(), variables({ maxBodyFatPercent: null }))).toEqual([
      'maxBodyFatPercent',
    ]);
    expect(changedVariables(variables(), variables({ muscleFocus: ['chest'] }))).toEqual([
      'muscleFocus',
    ]);
    expect(changedVariables(variables(), variables({ muscleFocus: ['back', 'chest'] }))).toEqual([
      'muscleFocus',
    ]);
  });

  it('names what moved, rather than warning about nothing in particular', () => {
    // "This will change your plan" with no subject is a confirmation people
    // learn to tap through without reading.
    const change = describeChange(variables(), variables({ speed: 'max' }));

    expect(change!.headline).toContain('How fast');
    expect(change!.headline).toContain('→');
    expect(change!.detail).toMatch(/Recalculate\?$/);
  });

  it('says nothing when nothing moved', () => {
    expect(describeChange(variables(), variables())).toBeNull();
  });

  it('counts the rest when several levers moved at once', () => {
    const change = describeChange(variables(), variables({ speed: 'max', daysPerWeek: 6 }));

    expect(change!.detail).toContain('1 other change');
  });

  it('reads a ceiling of none as words rather than as null', () => {
    const definition = PLAN_VARIABLES.find((entry) => entry.key === 'maxBodyFatPercent')!;

    expect(valueLabel(definition, null)).toBe('No limit');
    expect(valueLabel(definition, 17)).toBe('17 %');
  });

  it('reads an empty muscle focus as balanced', () => {
    const definition = PLAN_VARIABLES.find((entry) => entry.key === 'muscleFocus')!;

    expect(valueLabel(definition, [])).toBe('Balanced');
    expect(valueLabel(definition, ['chest'])).toContain('Chest');
  });
});
