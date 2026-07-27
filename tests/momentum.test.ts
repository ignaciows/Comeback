import { describe, expect, it } from 'vitest';

import { momentumConfig } from '@/domain/config';
import {
  calculateMomentumDelta,
  calculateMomentumScore,
  combineComponents,
  momentumState,
} from '@/domain/momentum/calculateMomentum';
import {
  calculateAdherenceScore,
  calculateConsistencyScore,
  calculateProgressionScore,
  type PlannedOutcome,
  type SessionSummary,
} from '@/domain/momentum/components';
import { addDays } from '@/utils/date';
import { TODAY, daysAgo, planned, readiness, session } from './helpers';

describe('adherence', () => {
  it('credits a completed session and rises above an all-skipped week', () => {
    const skipped = [planned(daysAgo(3), 'skipped'), planned(daysAgo(1), 'skipped')];
    const withCompletion = [...skipped, planned(daysAgo(2), 'completed', 'full')];

    const before = calculateAdherenceScore(skipped, TODAY);
    const after = calculateAdherenceScore(withCompletion, TODAY);

    expect(before).toBe(0);
    expect(after).toBeGreaterThan(before as number);
  });

  it('penalises a rescheduled session less than a skipped one', () => {
    const rescheduled = calculateAdherenceScore([planned(daysAgo(2), 'rescheduled')], TODAY);
    const skipped = calculateAdherenceScore([planned(daysAgo(2), 'skipped')], TODAY);

    expect(rescheduled).toBeGreaterThan(skipped as number);
    expect(rescheduled).toBeLessThan(100);
  });

  it('gives a reduced session most of the credit of a full one', () => {
    const full = calculateAdherenceScore([planned(daysAgo(2), 'completed', 'full')], TODAY) as number;
    const reduced = calculateAdherenceScore([planned(daysAgo(2), 'completed', 'reduced')], TODAY) as number;

    expect(reduced).toBeLessThan(full);
    expect(reduced).toBeGreaterThan(full * 0.8);
  });

  it('ignores planned rest days entirely', () => {
    const withRest = calculateAdherenceScore(
      [planned(daysAgo(2), 'completed', 'full'), planned(daysAgo(1), 'rest')],
      TODAY,
    );
    expect(withRest).toBe(100);
  });

  it('does not treat today’s open session as a miss', () => {
    const score = calculateAdherenceScore(
      [planned(daysAgo(1), 'completed', 'full'), planned(TODAY, 'planned')],
      TODAY,
    );
    expect(score).toBe(100);
  });

  it('returns null when nothing was planned', () => {
    expect(calculateAdherenceScore([], TODAY)).toBeNull();
  });
});

describe('consistency', () => {
  it('rises with training frequency', () => {
    const sparse = calculateConsistencyScore([session(daysAgo(6))], TODAY, 4);
    const regular = calculateConsistencyScore(
      [1, 3, 5, 8, 10, 12, 15, 17, 19].map((offset) => session(daysAgo(offset))),
      TODAY,
      4,
    );
    expect(regular).toBeGreaterThan(sparse);
  });

  it('is zero without any sessions', () => {
    expect(calculateConsistencyScore([], TODAY, 4)).toBe(0);
  });
});

describe('progression', () => {
  it('scores above neutral when performance improves', () => {
    const recent: SessionSummary[] = [
      session(daysAgo(2), { volumeKg: 7000, e1rmByExercise: { back_squat: 132 } }),
      session(daysAgo(5), { volumeKg: 6900, e1rmByExercise: { back_squat: 130 } }),
    ];
    const previous: SessionSummary[] = [
      session(daysAgo(20), { volumeKg: 6300, e1rmByExercise: { back_squat: 120 } }),
      session(daysAgo(25), { volumeKg: 6200, e1rmByExercise: { back_squat: 118 } }),
    ];

    const result = calculateProgressionScore([...recent, ...previous], TODAY);
    expect(result.score).not.toBeNull();
    expect(result.score as number).toBeGreaterThan(momentumConfig.neutralScore);
    expect(result.strengthChange as number).toBeGreaterThan(0);
  });

  it('scores below neutral when performance regresses', () => {
    const sessions: SessionSummary[] = [
      session(daysAgo(2), { volumeKg: 5000, e1rmByExercise: { back_squat: 110 } }),
      session(daysAgo(5), { volumeKg: 4900, e1rmByExercise: { back_squat: 108 } }),
      session(daysAgo(20), { volumeKg: 6300, e1rmByExercise: { back_squat: 125 } }),
      session(daysAgo(25), { volumeKg: 6200, e1rmByExercise: { back_squat: 124 } }),
    ];
    const result = calculateProgressionScore(sessions, TODAY);
    expect(result.score as number).toBeLessThan(momentumConfig.neutralScore);
  });

  it('does not reward an absurd volume spike beyond the ceiling', () => {
    const base: SessionSummary[] = [
      session(daysAgo(20), { volumeKg: 5000, e1rmByExercise: {} }),
      session(daysAgo(25), { volumeKg: 5000, e1rmByExercise: {} }),
    ];
    const doubled = calculateProgressionScore(
      [
        session(daysAgo(2), { volumeKg: 10_000, e1rmByExercise: {} }),
        session(daysAgo(4), { volumeKg: 10_000, e1rmByExercise: {} }),
        ...base,
      ],
      TODAY,
    );
    const quadrupled = calculateProgressionScore(
      [
        session(daysAgo(2), { volumeKg: 20_000, e1rmByExercise: {} }),
        session(daysAgo(4), { volumeKg: 20_000, e1rmByExercise: {} }),
        ...base,
      ],
      TODAY,
    );
    expect(doubled.score).toBe(quadrupled.score);
  });

  it('returns null when either window is too thin to compare', () => {
    const result = calculateProgressionScore([session(daysAgo(1))], TODAY);
    expect(result.score).toBeNull();
  });
});

describe('combining and smoothing', () => {
  it('redistributes the weight of missing components instead of scoring them zero', () => {
    const partial = combineComponents({
      adherence: 80,
      consistency: 80,
      progression: null,
      recovery: null,
      logging: null,
    });
    expect(partial).toBe(80);
  });

  it('caps how far the score can move in one day', () => {
    const delta = calculateMomentumDelta(50, 100);
    expect(Math.abs(delta)).toBeLessThanOrEqual(momentumConfig.maxDailyChange);
  });

  it('reports a low but rising score as recovering', () => {
    expect(momentumState(40, 4)).toBe('recovering');
    expect(momentumState(40, 0)).toBe('at_risk');
    expect(momentumState(85, 0)).toBe('strong');
  });
});

describe('daily evaluation', () => {
  const baseHistory = (upTo: string) => {
    const sessions: SessionSummary[] = [];
    const outcomes: PlannedOutcome[] = [];
    const points = [];
    for (let offset = 28; offset >= 1; offset -= 1) {
      const date = addDays(upTo, -offset);
      points.push(readiness(date, 70));
      if (offset % 2 === 0) {
        sessions.push(session(date));
        outcomes.push(planned(date, 'completed', 'full'));
      }
    }
    return { sessions, outcomes, points };
  };

  it('does not collapse after a single bad session', () => {
    const { sessions, outcomes, points } = baseHistory(TODAY);

    const before = calculateMomentumScore({
      date: daysAgo(1),
      planned: outcomes,
      sessions,
      readiness: points,
      targetSessionsPerWeek: 4,
      previousScore: null,
    });

    const after = calculateMomentumScore({
      date: TODAY,
      planned: [...outcomes, planned(TODAY, 'skipped')],
      sessions,
      readiness: [...points, readiness(TODAY, 20)],
      targetSessionsPerWeek: 4,
      previousScore: before.score,
    });

    expect(before.score - after.score).toBeLessThanOrEqual(momentumConfig.maxDailyChange);
    expect(after.score).toBeGreaterThan(before.score * 0.8);
  });

  it('decays gradually across inactive days and recovers when training resumes', () => {
    const { sessions, outcomes, points } = baseHistory(TODAY);

    let score = calculateMomentumScore({
      date: TODAY,
      planned: outcomes,
      sessions,
      readiness: points,
      targetSessionsPerWeek: 4,
      previousScore: null,
    }).score;

    const trail: number[] = [score];
    for (let day = 1; day <= 10; day += 1) {
      const date = addDays(TODAY, day);
      score = calculateMomentumScore({
        date,
        planned: outcomes,
        sessions,
        readiness: points,
        targetSessionsPerWeek: 4,
        previousScore: score,
      }).score;
      trail.push(score);
    }

    // Monotonic decay, never more than the daily cap at a time.
    for (let index = 1; index < trail.length; index += 1) {
      expect(trail[index]).toBeLessThanOrEqual(trail[index - 1]);
      expect(trail[index - 1] - trail[index]).toBeLessThanOrEqual(momentumConfig.maxDailyChange);
    }
    expect(trail[trail.length - 1]).toBeLessThan(trail[0]);

    // Coming back lifts the score again.
    const resumeDate = addDays(TODAY, 11);
    const resumed = calculateMomentumScore({
      date: resumeDate,
      planned: [...outcomes, planned(resumeDate, 'completed', 'full')],
      sessions: [...sessions, session(resumeDate)],
      readiness: [...points, readiness(resumeDate, 75)],
      targetSessionsPerWeek: 4,
      previousScore: trail[trail.length - 1],
    });

    expect(resumed.score).toBeGreaterThan(trail[trail.length - 1]);
    expect(resumed.explanation).toMatch(/increased/i);
  });

  it('reports low confidence when there is barely any data', () => {
    const thin = calculateMomentumScore({
      date: TODAY,
      planned: [planned(daysAgo(1), 'completed', 'full')],
      sessions: [session(daysAgo(1))],
      readiness: [readiness(daysAgo(1), 70)],
      targetSessionsPerWeek: 4,
      previousScore: null,
    });
    expect(thin.confidence).toBe('low');

    const { sessions, outcomes, points } = baseHistory(TODAY);
    const rich = calculateMomentumScore({
      date: TODAY,
      planned: outcomes,
      sessions,
      readiness: points,
      targetSessionsPerWeek: 4,
      previousScore: null,
    });
    expect(rich.confidence).toBe('high');
  });

  it('always produces a score inside 0–100 with an explanation', () => {
    const result = calculateMomentumScore({
      date: TODAY,
      planned: [],
      sessions: [],
      readiness: [],
      targetSessionsPerWeek: 5,
      previousScore: null,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.explanation.length).toBeGreaterThan(0);
  });
});
