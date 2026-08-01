import { fuelConfig } from '@/domain/config';
import { calculateRecoveryScore, type ReadinessPoint } from '@/domain/momentum/components';
import type { Confidence, DailyCheckin, ISODate } from '@/domain/types';
import { daysBetween } from '@/utils/date';
import { clamp, mean, normalize, round, scaleToScore } from '@/utils/math';

/**
 * Fuel: whether today has what it needs, distinct from Momentum's "is the
 * trajectory holding up" and Readiness's "how do you feel". Three inputs:
 *
 *  · **Nutrition** — calories and protein against target, averaged over the
 *    last couple of days rather than just today, because one meal does not
 *    undo a deficit and glycogen and protein synthesis both run on a
 *    multi-day window. Comes from MIKUY through Apple Health — see
 *    `services/health/AppleHealthDataProvider`.
 *  · **Sleep** — last night's hours and quality. The same bounds as
 *    Readiness's sleep component, so the two scores never disagree about
 *    what "enough sleep" means, but Fuel only asks about sleep — not
 *    soreness, stress or motivation, which are how you feel about training,
 *    not what you have to train with.
 *  · **Training load** — literally Momentum's recovery component
 *    (readiness trend over the last week). Reused rather than reimplemented:
 *    both questions read the same fact about the last week, they just spend
 *    it differently.
 *
 * Same shape as Momentum and Readiness on purpose: a missing component drops
 * out and its weight is redistributed, never counted as zero, and confidence
 * is reported rather than assumed.
 */

export type NutritionPoint = {
  date: ISODate;
  kcal: number | null;
  proteinG: number | null;
};

export type FuelComponents = {
  nutrition: number | null;
  sleep: number | null;
  trainingLoad: number | null;
};

export type FuelBreakdown = {
  key: keyof FuelComponents;
  label: string;
  /** 0–100 contribution before weighting. Null when there was nothing to score. */
  score: number | null;
};

export type FuelResult = {
  /** 0–100, or null when nothing was logged at all. */
  score: number | null;
  confidence: Confidence;
  components: FuelComponents;
  breakdown: FuelBreakdown[];
  explanation: string;
};

export type FuelInput = {
  date: ISODate;
  /** Recent nutrition, any order — only the window around `date` is used. */
  nutrition: NutritionPoint[];
  calorieTargetKcal: number | null;
  proteinTargetG: number | null;
  /** Today's check-in, for sleep. Null if none was logged. */
  checkin: DailyCheckin | null;
  /** Precomputed readiness scores over recent history, for training load. */
  readiness: ReadinessPoint[];
};

const LABELS: Record<keyof FuelComponents, string> = {
  nutrition: 'Nutrition',
  sleep: 'Sleep',
  trainingLoad: 'Training load',
};

/**
 * 0–100 for how close `value` sits to `target`. 100 inside the ideal ratio
 * band, falling off linearly to 0 at the floor ratio, on either side —
 * eating too little costs the score exactly as eating too much does.
 */
function ratioScore(value: number, target: number): number | null {
  if (target <= 0) return null;
  const { idealRatio, floorRatio } = fuelConfig.nutrition;
  const ratio = value / target;
  if (ratio >= idealRatio.min && ratio <= idealRatio.max) return 100;
  if (ratio < idealRatio.min) {
    if (ratio <= floorRatio.min) return 0;
    return round(normalize(ratio, floorRatio.min, idealRatio.min), 1);
  }
  if (ratio >= floorRatio.max) return 0;
  return round(normalize(ratio, floorRatio.max, idealRatio.max), 1);
}

function recentNutritionAverage(
  nutrition: NutritionPoint[],
  date: ISODate,
): { kcal: number | null; proteinG: number | null } {
  const window = nutrition.filter((point) => {
    const age = daysBetween(point.date, date);
    return age >= 0 && age < fuelConfig.nutrition.windowDays;
  });
  const kcalValues = window.map((point) => point.kcal).filter((value): value is number => value !== null);
  const proteinValues = window.map((point) => point.proteinG).filter((value): value is number => value !== null);
  return {
    kcal: kcalValues.length > 0 ? mean(kcalValues) : null,
    proteinG: proteinValues.length > 0 ? mean(proteinValues) : null,
  };
}

function nutritionScore(input: FuelInput): number | null {
  const avg = recentNutritionAverage(input.nutrition, input.date);
  const calorieScore =
    avg.kcal !== null && input.calorieTargetKcal ? ratioScore(avg.kcal, input.calorieTargetKcal) : null;
  const proteinScore =
    avg.proteinG !== null && input.proteinTargetG ? ratioScore(avg.proteinG, input.proteinTargetG) : null;

  if (calorieScore === null && proteinScore === null) return null;
  if (calorieScore === null) return proteinScore;
  if (proteinScore === null) return calorieScore;

  const { proteinWeight, calorieWeight } = fuelConfig.nutrition;
  return round(
    clamp((proteinScore * proteinWeight + calorieScore * calorieWeight) / (proteinWeight + calorieWeight), 0, 100),
    1,
  );
}

function sleepScore(checkin: DailyCheckin | null): number | null {
  if (!checkin) return null;
  const { poor, good } = fuelConfig.sleep;
  const durationScore = checkin.sleepHours === null ? null : normalize(checkin.sleepHours, poor, good);
  const qualityScore = checkin.sleepQuality === null ? null : scaleToScore(checkin.sleepQuality);
  if (durationScore === null && qualityScore === null) return null;
  if (durationScore === null) return round(qualityScore as number, 1);
  if (qualityScore === null) return round(durationScore, 1);
  return round(durationScore * 0.6 + qualityScore * 0.4, 1);
}

/** Weighted average over the components that actually have data. */
function combine(components: FuelComponents): number | null {
  const entries: { value: number; weight: number }[] = [];
  for (const key of Object.keys(components) as (keyof FuelComponents)[]) {
    const value = components[key];
    if (value === null) continue;
    entries.push({ value, weight: fuelConfig.weights[key] });
  }

  if (entries.length === 0) return null;
  const weightSum = entries.reduce((total, entry) => total + entry.weight, 0);
  const weighted = entries.reduce((total, entry) => total + entry.value * entry.weight, 0);
  return round(clamp(weighted / weightSum, 0, 100), 1);
}

function determineConfidence(input: FuelInput, components: FuelComponents): Confidence {
  const present = (Object.values(components) as (number | null)[]).filter((value) => value !== null).length;
  const nutritionDays = new Set(
    input.nutrition
      .filter((point) => daysBetween(point.date, input.date) < fuelConfig.nutrition.windowDays)
      .map((point) => point.date),
  ).size;

  if (present === 3 && nutritionDays >= fuelConfig.nutrition.windowDays) return 'high';
  if (present >= 2) return 'medium';
  return 'low';
}

function buildExplanation(components: FuelComponents, confidence: Confidence): string {
  const entries = (Object.keys(components) as (keyof FuelComponents)[])
    .map((key) => ({ key, value: components[key] }))
    .filter((entry): entry is { key: keyof FuelComponents; value: number } => entry.value !== null);

  if (entries.length === 0) return 'Not enough logged today to score fuel.';

  const weakest = [...entries].sort((a, b) => a.value - b.value)[0];
  const strongest = [...entries].sort((a, b) => b.value - a.value)[0];

  if (entries.length === 1) {
    return `Based only on ${LABELS[weakest.key].toLowerCase()} so far today.`;
  }

  const caveat = confidence === 'low' ? ' Log more to sharpen this.' : '';
  if (weakest.value < 45) {
    return `${LABELS[weakest.key]} is holding this back the most.${caveat}`;
  }
  return `Led by ${LABELS[strongest.key].toLowerCase()}.${caveat}`;
}

export function calculateFuel(input: FuelInput): FuelResult {
  const components: FuelComponents = {
    nutrition: nutritionScore(input),
    sleep: sleepScore(input.checkin),
    trainingLoad: calculateRecoveryScore(input.readiness, input.date),
  };

  const score = combine(components);
  const confidence = determineConfidence(input, components);

  const breakdown: FuelBreakdown[] = (Object.keys(components) as (keyof FuelComponents)[]).map((key) => ({
    key,
    label: LABELS[key],
    score: components[key],
  }));

  return {
    score,
    confidence,
    components,
    breakdown,
    explanation: buildExplanation(components, confidence),
  };
}

export function fuelLabel(score: number | null): string {
  if (score === null) return 'Not logged';
  if (score >= 80) return 'Fully fueled';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Running low';
  return 'Depleted';
}
