import { describe, expect, it } from 'vitest';

import { durationScore, qualityScore, regularityScore, sleepStats, type SleepNight } from '@/domain/sleep/sleepStats';
import { TODAY, daysAgo } from './helpers';

function night(date: string, hours: number, overrides: Partial<SleepNight> = {}): SleepNight {
  const asleepMin = hours * 60;
  return {
    date,
    hours,
    // A healthy split by default: ~18% deep, ~22% REM.
    stages: {
      deepMin: Math.round(asleepMin * 0.18),
      remMin: Math.round(asleepMin * 0.22),
      coreMin: Math.round(asleepMin * 0.6),
    },
    awakeMin: 10,
    ...overrides,
  };
}

describe('sleep', () => {
  it('scores duration on the same scale readiness uses', () => {
    expect(durationScore(8)).toBe(100);
    expect(durationScore(4.5)).toBe(0);
    expect(durationScore(4)).toBe(0);
    expect(durationScore(6.25)).toBeGreaterThan(40);
  });

  it('refuses a quality score when the night has no stages', () => {
    expect(qualityScore(night(TODAY, 8, { stages: null }))).toBeNull();
  });

  it('scores a healthy stage split near the top', () => {
    expect(qualityScore(night(TODAY, 8)) as number).toBeGreaterThan(85);
  });

  it('penalises too little deep sleep', () => {
    const healthy = qualityScore(night(TODAY, 8)) as number;
    const shallow = qualityScore(
      night(TODAY, 8, { stages: { deepMin: 10, remMin: 105, coreMin: 365 } }),
    ) as number;
    expect(shallow).toBeLessThan(healthy);
  });

  it('penalises a broken night through efficiency', () => {
    const solid = qualityScore(night(TODAY, 7, { awakeMin: 5 })) as number;
    const broken = qualityScore(night(TODAY, 7, { awakeMin: 120 })) as number;
    expect(broken).toBeLessThan(solid);
  });

  it('needs three nights before judging regularity', () => {
    expect(regularityScore([night(daysAgo(1), 7), night(TODAY, 8)])).toBeNull();
    expect(regularityScore([night(daysAgo(2), 7), night(daysAgo(1), 7), night(TODAY, 7)])).toBe(100);
  });

  it('scores erratic sleep below steady sleep of the same average', () => {
    const steady = regularityScore([daysAgo(2), daysAgo(1), TODAY].map((d) => night(d, 7))) as number;
    const erratic = regularityScore([
      night(daysAgo(2), 4),
      night(daysAgo(1), 10),
      night(TODAY, 7),
    ]) as number;
    expect(erratic).toBeLessThan(steady);
  });

  it('reports nothing rather than zero with no data', () => {
    const stats = sleepStats([], TODAY);
    expect(stats.nights).toBe(0);
    expect(stats.averageHours).toBeNull();
    expect(stats.qualityScore).toBeNull();
    expect(stats.confidence).toBe('low');
  });

  it('ignores nights outside the window', () => {
    const stats = sleepStats([night(daysAgo(40), 8)], TODAY, 14);
    expect(stats.nights).toBe(0);
  });

  it('averages only the nights inside the window', () => {
    const stats = sleepStats([night(daysAgo(1), 6), night(TODAY, 8), night(daysAgo(30), 2)], TODAY, 14);
    expect(stats.nights).toBe(2);
    expect(stats.averageHours).toBe(7);
  });

  it('still scores duration when no source reports stages', () => {
    const stats = sleepStats(
      [daysAgo(2), daysAgo(1), TODAY].map((d) => night(d, 7, { stages: null, awakeMin: null })),
      TODAY,
    );
    expect(stats.durationScore).not.toBeNull();
    expect(stats.qualityScore).toBeNull();
    expect(stats.regularityScore).not.toBeNull();
  });

  it('counts sleep debt only against short nights', () => {
    // 8h is the target, so a 9h night must not create negative debt.
    const stats = sleepStats([night(daysAgo(1), 9), night(TODAY, 6)], TODAY);
    expect(stats.debtHours).toBe(2);
  });

  it('names regularity when the hours are fine but erratic', () => {
    const stats = sleepStats(
      [night(daysAgo(3), 4.5), night(daysAgo(2), 10), night(daysAgo(1), 5), night(TODAY, 10)],
      TODAY,
    );
    expect(stats.headline.toLowerCase()).toContain('move a lot');
  });
});

describe('the sleep window reaches back past midnight', () => {
  it('keeps a night that started the evening before the window opened', () => {
    // The bug this pins: a plain midnight-to-midnight query clipped the first
    // night of every window, because sleep starts before midnight. On the
    // chart that showed as a short first bar that moved whenever the window
    // moved — which read as broken rather than wrong.
    const from = '2026-07-20';
    const nights: SleepNight[] = [
      { date: '2026-07-20', hours: 7.5, stages: null, awakeMin: null },
      { date: '2026-07-21', hours: 7.2, stages: null, awakeMin: null },
      { date: '2026-07-22', hours: 8.0, stages: null, awakeMin: null },
    ];

    const stats = sleepStats(nights, '2026-07-22', 14);

    // All three nights survive: none is dropped for having begun "too early".
    expect(stats.nights).toBe(3);
    expect(nights.every((night) => night.date >= from)).toBe(true);
    expect(stats.averageHours).toBeCloseTo(7.6, 1);
  });
});
