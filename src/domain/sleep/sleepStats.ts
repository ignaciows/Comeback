import { readinessConfig } from '@/domain/config';
import type { Confidence, ISODate } from '@/domain/types';
import { daysBetween } from '@/utils/date';
import { clamp, mean, round, standardDeviation } from '@/utils/math';

/**
 * What the sleep data actually supports saying.
 *
 * Total hours is the number everyone quotes and the weakest of the three
 * signals here. Two nights of seven hours are not equivalent if one was
 * fragmented and short on deep sleep, and someone who sleeps seven hours at
 * a different time every night is not rested the way a regular sleeper is.
 * So this reports three things and keeps them separate rather than folding
 * them into one figure:
 *
 *  · **Duration** — hours against the same bounds Readiness and Fuel use, so
 *    nothing in the app disagrees about what "enough" means.
 *  · **Quality** — from the stage split, when the source gives one. Deep
 *    sleep is the physically restorative stage and REM the one tied to
 *    learning and mood; the healthy adult proportions are roughly 13–23%
 *    deep and 20–25% REM, and this scores distance from those bands rather
 *    than rewarding "more is better" without limit. Efficiency — asleep over
 *    time in bed — is folded in, because time awake in bed is the clearest
 *    marker of a broken night.
 *  · **Regularity** — how much bedtime and duration move night to night.
 *    Consistency predicts how rested someone is beyond total hours alone.
 *
 * When a source cannot answer one of these it returns null and says so. A
 * watch that reports a night as simply "asleep" has no stages, and inventing
 * a quality score from a single number would be making it up.
 */

export type SleepNight = {
  date: ISODate;
  hours: number;
  stages: { deepMin: number; remMin: number; coreMin: number } | null;
  awakeMin: number | null;
};

export type SleepStats = {
  /** Nights in the window with data. */
  nights: number;
  /** Mean hours over the window, or null with nothing to average. */
  averageHours: number | null;
  /** Last night, or null. */
  lastNight: SleepNight | null;
  /** 0–100 from hours, on Readiness's bounds. Null without data. */
  durationScore: number | null;
  /** 0–100 from stage split and efficiency. Null when no source reports stages. */
  qualityScore: number | null;
  /** 0–100; how little duration varies night to night. Null under 3 nights. */
  regularityScore: number | null;
  /** Hours below target across the window. Positive means short. */
  debtHours: number | null;
  confidence: Confidence;
  /** One sentence naming the weakest link. */
  headline: string;
};

/** Healthy adult proportions; scored as bands, not as "more is better". */
const DEEP_BAND = { min: 0.13, max: 0.23 } as const;
const REM_BAND = { min: 0.2, max: 0.25 } as const;

/** Beyond this much night-to-night swing, regularity scores zero. */
const MAX_SD_HOURS = 2.5;

function inBandScore(value: number, min: number, max: number): number {
  if (value >= min && value <= max) return 100;
  // Distance outside the band, scaled by the band's own width, so a narrow
  // band is not punished more harshly than a wide one for the same miss.
  const width = max - min;
  const distance = value < min ? min - value : value - max;
  return clamp(100 - (distance / width) * 100, 0, 100);
}

export function durationScore(hours: number): number {
  const { poor, good } = readinessConfig.sleep;
  return round(clamp(((hours - poor) / (good - poor)) * 100, 0, 100), 1);
}

/**
 * Quality from the stage split. Null unless the night was actually staged —
 * a single "asleep" block carries no information about quality.
 */
export function qualityScore(night: SleepNight): number | null {
  if (!night.stages) return null;
  const asleepMin = night.hours * 60;
  if (asleepMin <= 0) return null;

  const deepShare = night.stages.deepMin / asleepMin;
  const remShare = night.stages.remMin / asleepMin;

  const deep = inBandScore(deepShare, DEEP_BAND.min, DEEP_BAND.max);
  const rem = inBandScore(remShare, REM_BAND.min, REM_BAND.max);

  // Sleep efficiency: asleep over total time in bed.
  const efficiency =
    night.awakeMin === null || night.awakeMin < 0
      ? null
      : clamp((asleepMin / (asleepMin + night.awakeMin)) * 100, 0, 100);

  // Efficiency is only a third of the picture when we have it, and the stage
  // bands carry the rest; without it they carry all of it.
  const parts = efficiency === null ? [deep, rem] : [deep, rem, efficiency];
  return round(mean(parts), 1);
}

/** 0–100 from how little duration swings night to night. Needs 3 nights. */
export function regularityScore(nights: SleepNight[]): number | null {
  if (nights.length < 3) return null;
  const sd = standardDeviation(nights.map((night) => night.hours));
  return round(clamp(100 - (sd / MAX_SD_HOURS) * 100, 0, 100), 1);
}

export function sleepStats(all: SleepNight[], today: ISODate, windowDays = 14): SleepStats {
  const window = all
    .filter((night) => {
      const age = daysBetween(night.date, today);
      return age >= 0 && age < windowDays;
    })
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const lastNight = window[window.length - 1] ?? null;

  if (window.length === 0) {
    return {
      nights: 0,
      averageHours: null,
      lastNight: null,
      durationScore: null,
      qualityScore: null,
      regularityScore: null,
      debtHours: null,
      confidence: 'low',
      headline: 'No sleep data yet. Connect Apple Health or log a check-in.',
    };
  }

  const averageHours = round(mean(window.map((night) => night.hours)), 1);
  const duration = durationScore(averageHours);

  const staged = window.map(qualityScore).filter((value): value is number => value !== null);
  const quality = staged.length > 0 ? round(mean(staged), 1) : null;

  const regularity = regularityScore(window);

  const { good } = readinessConfig.sleep;
  const debtHours = round(
    window.reduce((total, night) => total + Math.max(0, good - night.hours), 0),
    1,
  );

  const confidence: Confidence =
    window.length >= windowDays * 0.7 && quality !== null
      ? 'high'
      : window.length >= 4
        ? 'medium'
        : 'low';

  return {
    nights: window.length,
    averageHours,
    lastNight,
    durationScore: duration,
    qualityScore: quality,
    regularityScore: regularity,
    debtHours,
    confidence,
    headline: headlineFor(duration, quality, regularity, averageHours),
  };
}

function headlineFor(
  duration: number,
  quality: number | null,
  regularity: number | null,
  averageHours: number,
): string {
  const scored: { label: string; value: number }[] = [{ label: 'duration', value: duration }];
  if (quality !== null) scored.push({ label: 'quality', value: quality });
  if (regularity !== null) scored.push({ label: 'regularity', value: regularity });

  const weakest = [...scored].sort((a, b) => a.value - b.value)[0];
  if (weakest.value >= 70) return `Averaging ${averageHours}h. Nothing here is holding you back.`;

  if (weakest.label === 'duration') return `Averaging ${averageHours}h — short is the main problem.`;
  if (weakest.label === 'regularity') {
    return `You sleep enough on average, but the hours move a lot night to night.`;
  }
  return `Hours are fine; the nights themselves are broken or light on deep sleep.`;
}
