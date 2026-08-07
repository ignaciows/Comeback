import { describe, expect, it } from 'vitest';

import { SPEEDS, distinctPaces, simulatePlan, type SimulationInput } from '@/domain/plan/simulate';
import type { PlanObjective } from '@/domain/types';

const base = (objective: PlanObjective): Omit<SimulationInput, 'speed' | 'targetWeightKg'> => ({
  today: '2026-08-07',
  objective,
  fatTolerance: 'some',
  currentWeightKg: 82,
  heightCm: 178,
  age: 30,
  sex: 'unspecified',
  experience: 'returning',
  horizonWeeks: 12,
  sessionsCompleted: 0,
  goalStartedAt: '2026-08-07',
  observedWeeklyRateKg: null,
  weeksOfWeightData: 0,
  adherence: 1,
});

const allPaces = (objective: PlanObjective) =>
  SPEEDS.map((speed) => ({ speed, result: simulatePlan({ ...base(objective), speed, targetWeightKg: null }) }));

describe('the pace screen only offers real choices', () => {
  it.each(['build', 'lean', 'recomp'] as PlanObjective[])(
    'never shows two options with the same body outcome (%s)',
    (objective) => {
      const shown = distinctPaces(allPaces(objective));
      const outcomes = shown.map((option) => {
        const { weightChangeKg, leanChangeKg, fatChangeKg } = option.result.outcome;
        return `${weightChangeKg}|${leanChangeKg}|${fatChangeKg}`;
      });

      expect(new Set(outcomes).size).toBe(outcomes.length);
    },
  );

  it('actually collapses something — the four speeds are not four outcomes', () => {
    // If this ever stops being true the de-duplication is dead weight and
    // should go, rather than sitting here pretending to earn its place.
    const collapsed = (['build', 'lean', 'recomp'] as PlanObjective[]).map(
      (objective) => distinctPaces(allPaces(objective)).length,
    );

    expect(collapsed.every((count) => count < SPEEDS.length)).toBe(true);
  });

  it('keeps the pace that asks for least when two reach the same place', () => {
    const options = allPaces('build');
    const shown = distinctPaces(options);

    for (const option of shown) {
      const { weightChangeKg, leanChangeKg, fatChangeKg } = option.result.outcome;
      const sameOutcome = options.filter(
        (other) =>
          other.result.outcome.weightChangeKg === weightChangeKg &&
          other.result.outcome.leanChangeKg === leanChangeKg &&
          other.result.outcome.fatChangeKg === fatChangeKg,
      );
      const fewestDays = Math.min(...sameOutcome.map((entry) => entry.result.daysPerWeek));

      expect(option.result.daysPerWeek).toBe(fewestDays);
    }
  });

  it('leaves genuinely different paces alone', () => {
    const shown = distinctPaces(allPaces('lean'));

    expect(shown.length).toBeGreaterThan(1);
    expect(shown.map((option) => option.speed)).toContain('cautious');
  });

  it('is a no-op on a single option', () => {
    const one = [allPaces('build')[0]];

    expect(distinctPaces(one)).toEqual(one);
  });
});
