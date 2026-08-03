import { describe, expect, it } from 'vitest';

import { calculateFuel } from '@/domain/fuel/calculateFuel';
import { calculateConsistencyScore, calculateLoggingScore, type SessionSummary } from '@/domain/momentum/components';
import { calculateMomentumScore } from '@/domain/momentum/calculateMomentum';
import { readinessLabel } from '@/domain/readiness/calculateReadiness';

const REFERENCE = '2026-06-10';

const daysBefore = (n: number) => {
  const d = new Date(REFERENCE);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const session = (age: number): SessionSummary => ({
  id: `s${age}`,
  date: daysBefore(age),
  volumeKg: 8000,
  setCount: 18,
  e1rmByExercise: {},
});

describe('formula audit', () => {
  it('does not credit a check-in that scored nothing', () => {
    const days = [0, 1, 2, 3, 4, 5, 6].map(daysBefore);
    const filledIn = days.map((date) => ({ date, score: 70 }));
    const savedEmpty = days.map((date) => ({ date, score: null }));

    // Opening the screen and saving a blank form used to score identically to
    // filling it in, while every other component ignored those points.
    expect(calculateLoggingScore(savedEmpty, [], REFERENCE, 4)).toBeLessThan(
      calculateLoggingScore(filledIn, [], REFERENCE, 4),
    );
  });

  it('does not dock consistency for the weeks before you started', () => {
    // Perfect attendance, three a week, every week since installing — two
    // weeks ago. Nothing about that is inconsistent.
    const twoWeeksIn = [1, 3, 5, 8, 10, 12].map(session);
    const fourWeeksIn = [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26].map(session);

    const short = calculateConsistencyScore(twoWeeksIn, REFERENCE, 3);
    const long = calculateConsistencyScore(fourWeeksIn, REFERENCE, 3);

    expect(short).toBeGreaterThan(80);
    // The four-week lifter has more history, so more credit — but the newcomer
    // must not be punished for a fortnight they could not have trained in.
    expect(long - short).toBeLessThan(20);
  });

  it('does not count tomorrow as evidence', () => {
    const base = {
      date: REFERENCE,
      calorieTargetKcal: 2800,
      proteinTargetG: 160,
      checkin: {
        id: 'c',
        date: REFERENCE,
        sleepHours: 8,
        sleepQuality: 4,
        energy: 4,
        soreness: 2,
        stress: 2,
        motivation: 4,
        source: 'manual' as const,
        createdAt: `${REFERENCE}T08:00:00Z`,
        updatedAt: `${REFERENCE}T08:00:00Z`,
      },
      readiness: [0, 1, 2].map((age) => ({ date: daysBefore(age), score: 70 })),
    };

    const oneRealDay = calculateFuel({
      ...base,
      nutrition: [{ date: REFERENCE, kcal: 2800, proteinG: 160 }],
    });
    const paddedWithTomorrow = calculateFuel({
      ...base,
      nutrition: [
        { date: REFERENCE, kcal: 2800, proteinG: 160 },
        { date: '2026-06-11', kcal: 2800, proteinG: 160 },
      ],
    });

    // A meal nobody has eaten yet must not make the app more certain.
    expect(paddedWithTomorrow.confidence).toBe(oneRealDay.confidence);
    expect(paddedWithTomorrow.score).toBe(oneRealDay.score);
  });

  it('does not let a future session raise momentum confidence', () => {
    const past = [1, 2, 3].map(session);
    const withFuture = [...past, { ...session(0), date: '2026-07-01', id: 'future' }];
    const readiness = [1, 2, 3].map((age) => ({ date: daysBefore(age), score: 70 }));

    const real = calculateMomentumScore({
      date: REFERENCE, planned: [], sessions: past, readiness,
      targetSessionsPerWeek: 4, previousScore: null,
    });
    const padded = calculateMomentumScore({
      date: REFERENCE, planned: [], sessions: withFuture, readiness,
      targetSessionsPerWeek: 4, previousScore: null,
    });

    expect(padded.confidence).toBe(real.confidence);
  });

  it('only says "baseline" when it has actually compared to one', () => {
    // Absolute, no baseline known: it must not borrow comparative language.
    expect(readinessLabel(45)).not.toContain('baseline');
    expect(readinessLabel(45)).not.toContain('usual');

    // With a baseline, the comparison is the honest report. Someone whose own
    // baseline is 40 and who scores 45 is above it, not below.
    expect(readinessLabel(45, 5)).toContain('usual');
    expect(readinessLabel(45, 5)).not.toContain('Below');
    expect(readinessLabel(45, -20)).toContain('Below');
    expect(readinessLabel(90, -20)).toContain('Below');
  });
});
