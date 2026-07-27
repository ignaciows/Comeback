import { describe, expect, it } from 'vitest';

import { observedWeeklyRate } from '@/domain/plan/observedRate';
import { compareStrategies, projectPlan, type ProjectionInput } from '@/domain/plan/projection';
import {
  STRATEGIES,
  defaultStrategyFor,
  maintenanceCalories,
  monthlyMuscleGainPotential,
} from '@/domain/plan/strategies';
import type { BodyMeasurement } from '@/domain/types';
import { addDays, daysBetween } from '@/utils/date';
import { TODAY, daysAgo } from './helpers';

const base: ProjectionInput = {
  today: TODAY,
  strategy: 'lean_bulk',
  experience: 'returning',
  currentWeightKg: 77.25,
  heightCm: 186,
  age: 30,
  sex: 'unspecified',
  targetWeightKg: 81,
  sessionsPerWeek: 5,
  sessionsCompleted: 12,
  goalStartedAt: daysAgo(28),
  observedWeeklyRateKg: null,
  weeksOfWeightData: 0,
  adherence: 1,
};

function measurement(date: string, weightKg: number): BodyMeasurement {
  return { id: `m-${date}`, date, weightKg, bodyFatPercent: null, source: 'manual', createdAt: `${date}T07:00:00Z` };
}

describe('projection', () => {
  it('projects a date in the future and the sessions to get there', () => {
    const result = projectPlan(base);
    expect(result.targetDate).not.toBeNull();
    expect(daysBetween(TODAY, result.targetDate as string)).toBeGreaterThan(0);
    expect(result.sessionsRemaining as number).toBeGreaterThan(0);
    expect(result.totalSessions).toBe(base.sessionsCompleted + (result.sessionsRemaining as number));
  });

  it('gains weight on a bulk and loses it on a cut', () => {
    expect(projectPlan(base).weeklyRateKg).toBeGreaterThan(0);
    expect(projectPlan({ ...base, strategy: 'cut' }).weeklyRateKg).toBeLessThan(0);
    expect(projectPlan({ ...base, strategy: 'maintain' }).weeklyRateKg).toBe(0);
  });

  it('reaches a gaining target sooner on an aggressive bulk than a lean one', () => {
    const lean = projectPlan(base);
    const aggressive = projectPlan({ ...base, strategy: 'bulk' });
    expect(aggressive.daysRemaining as number).toBeLessThan(lean.daysRemaining as number);
    // …but the extra weight is mostly fat, which the split has to show.
    expect(aggressive.leanChangeKg as number).toBeLessThan(lean.leanChangeKg as number);
  });

  it('refuses to give a date when the strategy moves away from the target', () => {
    const result = projectPlan({ ...base, strategy: 'cut' });
    expect(result.targetDate).toBeNull();
    expect(result.daysRemaining).toBeNull();
    expect(result.explanation).toMatch(/does not move you towards/i);
  });

  it('refuses to give a date with no target weight', () => {
    const result = projectPlan({ ...base, targetWeightKg: null });
    expect(result.targetDate).toBeNull();
    expect(result.explanation).toMatch(/no target weight/i);
    // The rest of the plan is still usable.
    expect(result.targetKcal).toBeGreaterThan(0);
    expect(result.proteinTargetG[0]).toBeGreaterThan(0);
  });

  it('follows the user’s own logged rate once there is enough of it', () => {
    const modelOnly = projectPlan(base);
    const slowerInReality = projectPlan({
      ...base,
      observedWeeklyRateKg: 0.05,
      weeksOfWeightData: 8,
    });
    expect(slowerInReality.weeklyRateKg).toBeLessThan(modelOnly.weeklyRateKg);
    expect(slowerInReality.daysRemaining as number).toBeGreaterThan(modelOnly.daysRemaining as number);
    expect(slowerInReality.usesObservedRate).toBe(true);
    expect(slowerInReality.explanation).toMatch(/your logged rate/i);
  });

  it('barely moves off the model rate when there is only a week of data', () => {
    const thin = projectPlan({ ...base, observedWeeklyRateKg: 1.5, weeksOfWeightData: 1 });
    const model = projectPlan(base);
    expect(Math.abs(thin.weeklyRateKg - model.weeklyRateKg)).toBeLessThan(0.2);
  });

  it('slows the projection when sessions are being missed', () => {
    const consistent = projectPlan(base);
    const patchy = projectPlan({ ...base, adherence: 0.4 });
    expect(patchy.weeklyRateKg).toBeLessThan(consistent.weeklyRateKg);
    expect(patchy.daysRemaining as number).toBeGreaterThan(consistent.daysRemaining as number);
  });

  it('caps muscle gain by training age, not by calories', () => {
    const returning = projectPlan(base);
    const advanced = projectPlan({ ...base, experience: 'advanced' });
    expect(advanced.muscleCeilingKg as number).toBeLessThan(returning.muscleCeilingKg as number);
    expect(monthlyMuscleGainPotential('beginner')).toBeGreaterThan(monthlyMuscleGainPotential('advanced'));
  });

  it('scales protein with body weight and raises it in a deficit', () => {
    const bulking = projectPlan(base);
    const cutting = projectPlan({ ...base, strategy: 'cut', targetWeightKg: 72 });
    expect(bulking.proteinTargetG[0]).toBe(Math.round(77.25 * STRATEGIES.lean_bulk.proteinGPerKg[0]));
    expect(cutting.proteinTargetG[0]).toBeGreaterThan(bulking.proteinTargetG[0]);
  });

  it('never projects past the horizon cap', () => {
    const result = projectPlan({ ...base, targetWeightKg: 200 });
    expect(daysBetween(TODAY, result.targetDate as string)).toBeLessThanOrEqual(104 * 7);
  });

  it('reports low confidence early and higher confidence with history', () => {
    expect(projectPlan({ ...base, goalStartedAt: TODAY }).confidence).toBe('low');
    expect(
      projectPlan({ ...base, goalStartedAt: daysAgo(70), weeksOfWeightData: 6, observedWeeklyRateKg: 0.2 })
        .confidence,
    ).toBe('high');
  });

  it('lays out milestones ending at the target', () => {
    const result = projectPlan(base);
    expect(result.milestones).toHaveLength(4);
    expect(result.milestones[3].label).toBe('Target');
    expect(result.milestones[3].weightKg).toBeCloseTo(base.targetWeightKg as number, 1);
    // Dates advance monotonically.
    for (let index = 1; index < result.milestones.length; index += 1) {
      expect(result.milestones[index].inDays).toBeGreaterThanOrEqual(result.milestones[index - 1].inDays);
    }
  });
});

describe('changing strategy', () => {
  it('shows the cost or saving in days against the current plan', () => {
    const comparisons = compareStrategies(base, ['lean_bulk', 'bulk', 'maintain']);
    const current = comparisons.find((entry) => entry.strategy === 'lean_bulk');
    const faster = comparisons.find((entry) => entry.strategy === 'bulk');

    expect(current?.deltaDays).toBe(0);
    expect(faster?.deltaDays as number).toBeLessThan(0);
  });

  it('carries completed sessions into every candidate', () => {
    const comparisons = compareStrategies(base, ['cut', 'bulk']);
    for (const entry of comparisons) {
      expect(entry.projection.sessionsCompleted).toBe(base.sessionsCompleted);
    }
  });
});

describe('observed rate', () => {
  it('needs at least three entries across a week', () => {
    expect(observedWeeklyRate([measurement(daysAgo(3), 77)], TODAY).weeklyKg).toBeNull();
    expect(
      observedWeeklyRate(
        [measurement(daysAgo(2), 77), measurement(daysAgo(1), 77.2), measurement(TODAY, 77.4)],
        TODAY,
      ).weeklyKg,
    ).toBeNull();
  });

  it('measures a rising trend from a noisy log', () => {
    const rate = observedWeeklyRate(
      [
        measurement(daysAgo(28), 76.0),
        measurement(daysAgo(21), 76.6),
        measurement(daysAgo(14), 76.4),
        measurement(daysAgo(7), 77.1),
        measurement(TODAY, 77.4),
      ],
      TODAY,
    );
    expect(rate.weeklyKg as number).toBeGreaterThan(0.2);
    expect(rate.weeklyKg as number).toBeLessThan(0.6);
    expect(rate.weeks).toBeGreaterThanOrEqual(4);
  });

  it('ignores entries outside the window', () => {
    const rate = observedWeeklyRate(
      [
        measurement(addDays(TODAY, -200), 90),
        measurement(daysAgo(14), 77),
        measurement(daysAgo(7), 77.3),
        measurement(TODAY, 77.6),
      ],
      TODAY,
    );
    expect(rate.points).toBe(3);
    expect(rate.weeklyKg as number).toBeGreaterThan(0);
  });
});

describe('strategy defaults', () => {
  it('maps each goal to a defensible starting strategy', () => {
    expect(defaultStrategyFor('lose_fat')).toBe('cut');
    expect(defaultStrategyFor('build_muscle')).toBe('lean_bulk');
    expect(defaultStrategyFor('maintain')).toBe('maintain');
  });

  it('keeps every strategy inside the rates the literature supports', () => {
    for (const profile of Object.values(STRATEGIES)) {
      expect(Math.abs(profile.weeklyWeightChangePct)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(profile.energyBalancePct)).toBeLessThanOrEqual(0.25);
      expect(profile.proteinGPerKg[0]).toBeGreaterThanOrEqual(1.6);
      expect(profile.proteinGPerKg[1]).toBeLessThanOrEqual(2.6);
    }
  });

  it('estimates maintenance calories in a plausible range', () => {
    const kcal = maintenanceCalories({
      weightKg: 77.25,
      heightCm: 186,
      age: 30,
      sex: 'male',
      sessionsPerWeek: 5,
    });
    expect(kcal).toBeGreaterThan(2200);
    expect(kcal).toBeLessThan(3600);
  });
});
