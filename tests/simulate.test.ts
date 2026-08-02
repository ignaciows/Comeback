import { describe, expect, it } from 'vitest';

import { compareSpeeds, simulatePlan, suggestTargetWeight, type SimulationInput } from '@/domain/plan/simulate';
import { adaptSetCount, adaptToday } from '@/domain/training/adaptation';
import { sessionMechanics, wasReduced } from '@/domain/training/sessionMetrics';
import { TODAY, daysAgo, workout } from './helpers';

const base: SimulationInput = {
  today: TODAY,
  objective: 'build',
  speed: 'steady',
  fatTolerance: 'some',
  currentWeightKg: 77.25,
  heightCm: 186,
  age: 30,
  sex: 'male',
  experience: 'returning',
  targetWeightKg: null,
  horizonWeeks: 12,
  sessionsCompleted: 0,
  goalStartedAt: TODAY,
  observedWeeklyRateKg: null,
  weeksOfWeightData: 0,
  adherence: 1,
};

describe('plan simulator', () => {
  it('derives frequency from the pace instead of asking for it', () => {
    const cautious = simulatePlan({ ...base, speed: 'cautious' });
    const max = simulatePlan({ ...base, speed: 'max' });

    expect(cautious.daysPerWeek).toBeLessThan(max.daysPerWeek);
    expect(max.requirements.some((entry) => entry.label.includes(`${max.daysPerWeek} sessions`))).toBe(true);
  });

  it('gets you more, sooner, the faster you go', () => {
    const cautious = simulatePlan({ ...base, speed: 'cautious' });
    const fast = simulatePlan({ ...base, speed: 'fast' });

    expect(fast.outcome.weightChangeKg).toBeGreaterThan(cautious.outcome.weightChangeKg);
    expect(fast.macros.kcal).toBeGreaterThan(cautious.macros.kcal);
  });

  it('says plainly when a pace is mostly buying fat', () => {
    const max = simulatePlan({ ...base, speed: 'max', fatTolerance: 'whatever' });
    expect(max.feasibility).toBe('not_useful');
    expect(max.tradeoffs.some((entry) => entry.key === 'ceiling')).toBe(true);
  });

  it('respects a refusal to gain fat, even at speed', () => {
    const careless = simulatePlan({ ...base, speed: 'fast', fatTolerance: 'whatever' });
    const careful = simulatePlan({ ...base, speed: 'fast', fatTolerance: 'minimal' });

    expect(careful.outcome.fatChangeKg).toBeLessThan(careless.outcome.fatChangeKg);
    expect(careful.strategy).toBe('lean_bulk');
    expect(careless.strategy).toBe('moderate_bulk');
  });

  it('marks the fastest cut as demanding and says what it costs', () => {
    const result = simulatePlan({ ...base, objective: 'lean', speed: 'max' });
    expect(result.strategy).toBe('aggressive_cut');
    // Exactly 1 %/week is the top of the range that holds muscle, not past it.
    expect(result.feasibility).toBe('demanding');
    expect(result.outcome.weightChangeKg).toBeLessThan(0);
    expect(result.tradeoffs.some((entry) => /strength|lean/i.test(entry.label))).toBe(true);
  });

  it('flags losing faster than the muscle-sparing limit', () => {
    // Someone whose own scale shows a much faster drop than the model assumed.
    const result = simulatePlan({
      ...base,
      objective: 'lean',
      speed: 'max',
      observedWeeklyRateKg: -1.4,
      weeksOfWeightData: 8,
    });
    expect(result.feasibility).toBe('not_useful');
    expect(result.tradeoffs.some((entry) => entry.key === 'too_fast')).toBe(true);
  });

  it('splits macros into a complete day', () => {
    const { macros } = simulatePlan(base);
    const fromMacros = macros.proteinG * 4 + macros.carbsG * 4 + macros.fatG * 9;
    expect(Math.abs(fromMacros - macros.kcal)).toBeLessThan(30);
    expect(macros.proteinG).toBeGreaterThan(base.currentWeightKg * 1.5);
  });

  it('lines every pace up against the current one', () => {
    const withTarget = { ...base, targetWeightKg: 82 };
    const options = compareSpeeds(withTarget);

    expect(options).toHaveLength(4);
    const steady = options.find((entry) => entry.speed === 'steady');
    const fast = options.find((entry) => entry.speed === 'fast');
    expect(steady?.deltaDays).toBe(0);
    expect(fast?.deltaDays as number).toBeLessThan(0);
  });

  it('suggests a target that matches the intent', () => {
    const building = suggestTargetWeight(base);
    const leaning = suggestTargetWeight({ ...base, objective: 'lean' });

    expect(building).toBeGreaterThan(base.currentWeightKg);
    expect(leaning).toBeLessThan(base.currentWeightKg);
  });
});

describe('daily adaptation', () => {
  const day = {
    momentum: 65,
    readiness: 62,
    readinessVsBaseline: 2,
    sessionsThisWeek: 2,
    targetSessionsPerWeek: 4,
    missedThisWeek: 0,
    daysSinceLastSession: 2,
  };

  it('runs the plan as written on an ordinary day', () => {
    const result = adaptToday(day);
    expect(result.volumeMultiplier).toBe(1);
    expect(result.setDelta).toBe(0);
  });

  it('adds work on a good day when the week is behind', () => {
    const result = adaptToday({ ...day, readiness: 82, readinessVsBaseline: 12, missedThisWeek: 1 });
    expect(result.volumeMultiplier).toBeGreaterThan(1);
    expect(result.setDelta).toBe(1);
    expect(result.headline).toMatch(/make up ground/i);
  });

  it('shrinks the session instead of cancelling it on a bad day', () => {
    const result = adaptToday({ ...day, readiness: 30, readinessVsBaseline: -22 });
    expect(result.volumeMultiplier).toBeLessThan(1);
    expect(result.volumeMultiplier).toBeGreaterThan(0.5);
    expect(result.setDelta).toBe(-1);
  });

  it('eases back in after a long break', () => {
    const result = adaptToday({ ...day, daysSinceLastSession: 10 });
    expect(result.volumeMultiplier).toBeLessThan(1);
    expect(result.headline).toMatch(/ease back/i);
  });

  it('does not guess without a check-in', () => {
    const result = adaptToday({ ...day, readiness: null, readinessVsBaseline: null });
    expect(result.volumeMultiplier).toBe(1);
    expect(result.confidence).toBe('low');
  });

  it('never moves a set count more than one step', () => {
    const good = adaptToday({ ...day, readiness: 85, readinessVsBaseline: 14, missedThisWeek: 2 });
    const bad = adaptToday({ ...day, readiness: 25, readinessVsBaseline: -25 });

    expect(adaptSetCount(4, good, true)).toBeLessThanOrEqual(5);
    expect(adaptSetCount(4, bad, true)).toBeGreaterThanOrEqual(1);
    expect(adaptSetCount(1, bad, false)).toBeGreaterThanOrEqual(1);
  });
});

describe('session mechanics', () => {
  it('derives duration, rest and pauses from the set timestamps', () => {
    const session = workout(TODAY, [
      { weightKg: 60, reps: 8 },
      { weightKg: 60, reps: 8 },
      { weightKg: 60, reps: 8 },
    ]);
    const mechanics = sessionMechanics(session);

    expect(mechanics.workingSets).toBe(3);
    expect(mechanics.durationMinutes).toBe(60);
    expect(mechanics.medianRestSeconds).toBe(60);
    expect(mechanics.pauses).toBe(0);
    expect(mechanics.setsPerHour).toBe(3);
  });

  it('counts a long gap as a pause rather than rest', () => {
    const session = workout(TODAY, [{ weightKg: 60, reps: 8 }, { weightKg: 60, reps: 8 }]);
    // Push the second set twenty minutes out.
    session.exercises[0].sets[1].completedAt = `${TODAY}T18:30:00.000Z`;
    const mechanics = sessionMechanics(session);

    expect(mechanics.pauses).toBe(1);
    expect(mechanics.longestGapSeconds).toBeGreaterThan(600);
    expect(mechanics.medianRestSeconds).toBeNull();
  });

  it('treats a mostly unfinished session as a reduced one', () => {
    const session = workout(daysAgo(1), [{ weightKg: 60, reps: 8 }]);
    expect(wasReduced(sessionMechanics(session, 12))).toBe(true);
    expect(wasReduced(sessionMechanics(session, 1))).toBe(false);
  });
});

describe('the four paces are four plans', () => {
  const SPEEDS = ['cautious', 'steady', 'fast', 'max'] as const;
  const OBJECTIVES = ['build', 'lean', 'recomp'] as const;
  const TOLERANCES = ['minimal', 'some', 'whatever'] as const;

  // The picker showed four cards where two pairs carried identical calories
  // and an identical fat projection, because the pace ladder collapsed onto
  // two strategies. Choosing between them was choosing between labels.
  it('never gives two paces the same numbers', () => {
    for (const objective of OBJECTIVES) {
      for (const fatTolerance of TOLERANCES) {
        const seen = SPEEDS.map((speed) => {
          const plan = simulatePlan({ ...base, objective, speed, fatTolerance });
          return `${plan.strategy}|${plan.macros.kcal}|${plan.outcome.fatChangeKg}`;
        });
        expect(new Set(seen).size, `${objective}/${fatTolerance}: ${seen.join(' , ')}`).toBe(4);
      }
    }
  });

  it('keeps the fat number moving with the pace when building', () => {
    const fat = SPEEDS.map(
      (speed) => simulatePlan({ ...base, objective: 'build', speed }).outcome.fatChangeKg,
    );
    for (let i = 1; i < fat.length; i += 1) {
      expect(fat[i], `${SPEEDS[i]} vs ${SPEEDS[i - 1]}`).toBeGreaterThan(fat[i - 1]);
    }
  });

  it('still lets fat tolerance change the answer', () => {
    const lean = simulatePlan({ ...base, objective: 'build', fatTolerance: 'minimal' });
    const loose = simulatePlan({ ...base, objective: 'build', fatTolerance: 'whatever' });
    expect(lean.strategy).not.toBe(loose.strategy);
    expect(lean.outcome.fatChangeKg).toBeLessThan(loose.outcome.fatChangeKg);
  });
});
