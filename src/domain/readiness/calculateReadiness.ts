import { readinessConfig } from '@/domain/config';
import type { Confidence, DailyCheckin } from '@/domain/types';
import { clamp, mean, normalize, round, scaleToScore } from '@/utils/math';

export type ReadinessBreakdown = {
  key: keyof typeof readinessConfig.weights;
  label: string;
  /** 0–100 contribution before weighting. Null when the field was not logged. */
  score: number | null;
  /** Difference against the user's own baseline, in points. Null if no baseline. */
  vsBaseline: number | null;
};

export type ReadinessResult = {
  /** 0–100, or null when the check-in has no usable field. */
  score: number | null;
  confidence: Confidence;
  breakdown: ReadinessBreakdown[];
  /** The user's rolling baseline score, once enough check-ins exist. */
  baseline: number | null;
  /** Points above/below the personal baseline. */
  vsBaseline: number | null;
};

const LABELS: Record<keyof typeof readinessConfig.weights, string> = {
  sleepDuration: 'Sleep duration',
  sleepQuality: 'Sleep quality',
  energy: 'Energy',
  soreness: 'Soreness',
  stress: 'Stress',
  motivation: 'Motivation',
};

function componentScores(checkin: DailyCheckin): Record<keyof typeof readinessConfig.weights, number | null> {
  return {
    sleepDuration:
      checkin.sleepHours === null
        ? null
        : normalize(checkin.sleepHours, readinessConfig.sleep.poor, readinessConfig.sleep.good),
    sleepQuality: checkin.sleepQuality === null ? null : scaleToScore(checkin.sleepQuality),
    energy: checkin.energy === null ? null : scaleToScore(checkin.energy),
    // 5 = very sore, so the scale is inverted.
    soreness: checkin.soreness === null ? null : scaleToScore(checkin.soreness, true),
    stress: checkin.stress === null ? null : scaleToScore(checkin.stress, true),
    motivation: checkin.motivation === null ? null : scaleToScore(checkin.motivation),
  };
}

/** Weighted average over the components that were actually logged. */
function weightedScore(scores: Record<keyof typeof readinessConfig.weights, number | null>): number | null {
  let weightSum = 0;
  let total = 0;
  for (const key of Object.keys(readinessConfig.weights) as (keyof typeof readinessConfig.weights)[]) {
    const score = scores[key];
    if (score === null) continue;
    const weight = readinessConfig.weights[key];
    weightSum += weight;
    total += score * weight;
  }
  if (weightSum === 0) return null;
  return clamp(round(total / weightSum, 1), 0, 100);
}

/** Score of a single check-in, ignoring history. Used to build the baseline. */
export function scoreCheckin(checkin: DailyCheckin): number | null {
  return weightedScore(componentScores(checkin));
}

/**
 * Readiness for `checkin`, compared against the user's own recent baseline.
 * `history` should be the check-ins preceding it (most recent first or last —
 * order does not matter).
 */
export function calculateReadiness(
  checkin: DailyCheckin | null,
  history: DailyCheckin[] = [],
): ReadinessResult {
  const baselineSamples = history
    .slice(-readinessConfig.baselineDays)
    .map(scoreCheckin)
    .filter((value): value is number => value !== null);

  const baseline =
    baselineSamples.length >= readinessConfig.minBaselineSamples ? round(mean(baselineSamples), 1) : null;

  if (!checkin) {
    return {
      score: null,
      confidence: 'low',
      breakdown: [],
      baseline,
      vsBaseline: null,
    };
  }

  const scores = componentScores(checkin);
  const score = weightedScore(scores);

  const baselineByComponent: Partial<Record<keyof typeof readinessConfig.weights, number>> = {};
  if (baseline !== null) {
    for (const key of Object.keys(readinessConfig.weights) as (keyof typeof readinessConfig.weights)[]) {
      const values = history
        .slice(-readinessConfig.baselineDays)
        .map((entry) => componentScores(entry)[key])
        .filter((value): value is number => value !== null);
      if (values.length >= readinessConfig.minBaselineSamples) {
        baselineByComponent[key] = round(mean(values), 1);
      }
    }
  }

  const breakdown: ReadinessBreakdown[] = (
    Object.keys(readinessConfig.weights) as (keyof typeof readinessConfig.weights)[]
  ).map((key) => {
    const componentBaseline = baselineByComponent[key];
    const componentScore = scores[key];
    return {
      key,
      label: LABELS[key],
      score: componentScore,
      vsBaseline:
        componentScore === null || componentBaseline === undefined
          ? null
          : round(componentScore - componentBaseline, 1),
    };
  });

  const sampleCount = baselineSamples.length;
  const confidence: Confidence =
    sampleCount >= readinessConfig.baselineDays * 0.5 ? 'high' : sampleCount >= readinessConfig.minBaselineSamples ? 'medium' : 'low';

  return {
    score,
    confidence,
    breakdown,
    baseline,
    vsBaseline: score === null || baseline === null ? null : round(score - baseline, 1),
  };
}

/**
 * A word for the score.
 *
 * `vsBaseline` is not optional decoration: without it the label can only speak
 * in absolutes, and it must not then borrow the language of a comparison it
 * did not make. The old version returned "Below baseline" for anything from 35
 * to 55 regardless of what the person's baseline actually was — someone whose
 * own baseline is 40 and who scores 45 was told they were below it, which is
 * the opposite of true and reads as the app knowing something it does not.
 *
 * Once there is a baseline, the comparison is the honest thing to report:
 * against yourself, a 45 is only low if your normal is higher.
 */
const BASELINE_MARGIN = 8;

export function readinessLabel(score: number | null, vsBaseline: number | null = null): string {
  if (score === null) return 'Not logged';

  if (vsBaseline !== null) {
    if (vsBaseline <= -BASELINE_MARGIN) return 'Below your usual';
    if (vsBaseline >= BASELINE_MARGIN) return 'Above your usual';
    return 'Around your usual';
  }

  if (score >= 75) return 'High';
  if (score >= 55) return 'Normal';
  if (score >= 35) return 'Low';
  return 'Very low';
}
