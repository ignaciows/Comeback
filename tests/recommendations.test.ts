import { describe, expect, it } from 'vitest';

import {
  generateDailyRecommendation,
  type RecommendationInput,
} from '@/domain/recommendations/generateDailyRecommendation';
import { TODAY, daysAgo } from './helpers';

const base: RecommendationInput = {
  date: TODAY,
  planned: { routineId: 'routine-1', routineDayId: 'day-1', name: 'Upper A', estimatedMinutes: 60 },
  isPlannedRestDay: false,
  missedThisWeek: [],
  readiness: 70,
  readinessVsBaseline: 2,
  daysSinceLastSession: 2,
  consecutiveTrainingDays: 1,
  sessionsThisWeek: 2,
  targetSessionsPerWeek: 4,
  momentumScore: 62,
  dataConfidence: 'medium',
};

describe('daily recommendation', () => {
  it('follows the plan when readiness is normal', () => {
    const result = generateDailyRecommendation(base);
    expect(result.type).toBe('full');
    expect(result.title).toBe('Upper A');
    expect(result.routineDayId).toBe('day-1');
  });

  it('shortens the session when readiness dips below the comfortable band', () => {
    const result = generateDailyRecommendation({ ...base, readiness: 45, readinessVsBaseline: -18 });
    expect(result.type).toBe('reduced');
    expect(result.estimatedMinutes).toBeLessThan(base.planned!.estimatedMinutes);
  });

  it('does not force rest on low sleep when consistency is already low', () => {
    const result = generateDailyRecommendation({
      ...base,
      readiness: 25,
      readinessVsBaseline: -30,
      momentumScore: 30,
      daysSinceLastSession: 6,
    });
    expect(result.type).toBe('reduced');
    expect(result.reason).toMatch(/frequency is low/i);
  });

  it('rests when recovery is very low and training has been consistent', () => {
    const result = generateDailyRecommendation({
      ...base,
      readiness: 20,
      readinessVsBaseline: -35,
      momentumScore: 75,
      daysSinceLastSession: 1,
    });
    expect(result.type).toBe('rest');
  });

  it('suggests recovery after too many consecutive training days', () => {
    const result = generateDailyRecommendation({
      ...base,
      consecutiveTrainingDays: 6,
      readiness: 48,
      daysSinceLastSession: 0,
    });
    expect(result.type).toBe('recovery');
  });

  it('offers to catch up a missed session on an open day', () => {
    const result = generateDailyRecommendation({
      ...base,
      planned: null,
      isPlannedRestDay: true,
      missedThisWeek: [
        {
          routineId: 'routine-1',
          routineDayId: 'day-2',
          name: 'Lower A',
          estimatedMinutes: 60,
          date: daysAgo(2),
        },
      ],
    });
    expect(result.type).toBe('rescheduled');
    expect(result.routineDayId).toBe('day-2');
  });

  it('keeps a planned rest day when nothing is outstanding', () => {
    const result = generateDailyRecommendation({ ...base, planned: null, isPlannedRestDay: true });
    expect(result.type).toBe('rest');
    expect(result.reason).toMatch(/does not reduce momentum/i);
  });

  it('reports low confidence and asks for a check-in when none was logged', () => {
    const result = generateDailyRecommendation({ ...base, readiness: null, readinessVsBaseline: null });
    expect(result.confidence).toBe('low');
    expect(result.reason).toMatch(/check-in/i);
  });

  it('always explains itself and lists the factors it used', () => {
    const result = generateDailyRecommendation(base);
    expect(result.reason.length).toBeGreaterThan(10);
    expect(result.factors.length).toBeGreaterThan(0);
  });
});
