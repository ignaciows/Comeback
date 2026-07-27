import type { Confidence, ExperienceLevel, ISODate, NutritionStrategy } from '@/domain/types';
import { addDays, daysBetween } from '@/utils/date';
import { clamp, round } from '@/utils/math';
import { STRATEGIES, maintenanceCalories, monthlyMuscleGainPotential } from './strategies';

export type ProjectionInput = {
  today: ISODate;
  strategy: NutritionStrategy;
  experience: ExperienceLevel;
  currentWeightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female' | 'unspecified';
  /** Null when the goal is not a weight target. */
  targetWeightKg: number | null;
  sessionsPerWeek: number;
  /** Sessions already logged in the current goal. */
  sessionsCompleted: number;
  /** When the current goal started. */
  goalStartedAt: ISODate;
  /**
   * Weekly kg change measured from the user's own weight log. When present it
   * is blended with the model rate, so the projection converges on reality.
   */
  observedWeeklyRateKg: number | null;
  /** How reliable the observed rate is: number of weeks of weight data. */
  weeksOfWeightData: number;
  /** Share of planned sessions actually completed, 0–1. */
  adherence: number;
};

export type Milestone = {
  key: string;
  label: string;
  date: ISODate;
  weightKg: number;
  /** Days from today. */
  inDays: number;
  reached: boolean;
};

export type PlanProjection = {
  strategy: NutritionStrategy;
  /** Expected weekly change in kg (negative = losing). */
  weeklyRateKg: number;
  /** True when the user's own logged rate contributed to the number. */
  usesObservedRate: boolean;
  targetWeightKg: number | null;
  targetDate: ISODate | null;
  daysRemaining: number | null;
  weeksRemaining: number | null;
  /** Sessions between now and the target date at the planned frequency. */
  sessionsRemaining: number | null;
  sessionsCompleted: number;
  totalSessions: number | null;
  milestones: Milestone[];
  /** Estimated body-composition change over the horizon, kg. */
  leanChangeKg: number | null;
  fatChangeKg: number | null;
  /** Muscle the training itself can add over the horizon, kg. */
  muscleCeilingKg: number | null;
  maintenanceKcal: number;
  targetKcal: number;
  proteinTargetG: [number, number];
  confidence: Confidence;
  explanation: string;
};

/** Never project further out than this; beyond it the estimate is noise. */
const MAX_WEEKS = 104;

/**
 * Projects the current plan forward: when the target is reached, how many
 * sessions that takes, and roughly how the weight splits into lean and fat.
 *
 * The rate is a blend of the strategy's model rate and the rate the user is
 * actually moving at, weighted by how much weight data exists. Someone whose
 * scale disagrees with the model gets a projection that follows the scale.
 */
export function projectPlan(input: ProjectionInput): PlanProjection {
  const profile = STRATEGIES[input.strategy];

  const modelRateKg = input.currentWeightKg * profile.weeklyWeightChangePct;

  // Trust in the observed rate grows with weeks of data, capped at 70 % so a
  // noisy fortnight cannot fully drive the projection.
  const observedWeight = input.observedWeeklyRateKg === null
    ? 0
    : clamp(input.weeksOfWeightData / 8, 0, 1) * 0.7;

  const blendedRate =
    input.observedWeeklyRateKg === null
      ? modelRateKg
      : modelRateKg * (1 - observedWeight) + input.observedWeeklyRateKg * observedWeight;

  // Missing sessions slows a bulk and, to a lesser degree, a cut.
  const adherenceFactor = clamp(0.55 + input.adherence * 0.45, 0.55, 1);
  const weeklyRateKg = round(blendedRate * adherenceFactor, 3);

  const maintenance = maintenanceCalories({
    weightKg: input.currentWeightKg,
    heightCm: input.heightCm,
    age: input.age,
    sex: input.sex,
    sessionsPerWeek: input.sessionsPerWeek,
  });

  const proteinTargetG: [number, number] = [
    Math.round(input.currentWeightKg * profile.proteinGPerKg[0]),
    Math.round(input.currentWeightKg * profile.proteinGPerKg[1]),
  ];

  const base = {
    strategy: input.strategy,
    weeklyRateKg,
    usesObservedRate: observedWeight > 0.05,
    targetWeightKg: input.targetWeightKg,
    sessionsCompleted: input.sessionsCompleted,
    maintenanceKcal: maintenance,
    targetKcal: Math.round(maintenance * (1 + profile.energyBalancePct)),
    proteinTargetG,
  };

  const weeksOfHistory = Math.max(0, Math.floor(daysBetween(input.goalStartedAt, input.today) / 7));
  const confidence: Confidence =
    weeksOfHistory >= 8 && input.weeksOfWeightData >= 4
      ? 'high'
      : weeksOfHistory >= 3 && input.weeksOfWeightData >= 2
        ? 'medium'
        : 'low';

  // No weight target, or a rate that never reaches it: report the plan without
  // inventing a date.
  const delta = input.targetWeightKg === null ? null : input.targetWeightKg - input.currentWeightKg;
  const movingTowardsTarget =
    delta !== null && Math.abs(delta) > 0.05 && Math.sign(delta) === Math.sign(weeklyRateKg) && weeklyRateKg !== 0;

  if (!movingTowardsTarget) {
    const reason =
      delta === null
        ? 'No target weight is set, so there is no date to project.'
        : Math.abs(delta) <= 0.05
          ? 'You are at your target weight.'
          : 'Your current strategy does not move you towards your target weight.';
    return {
      ...base,
      targetDate: null,
      daysRemaining: null,
      weeksRemaining: null,
      sessionsRemaining: null,
      totalSessions: null,
      milestones: [],
      leanChangeKg: null,
      fatChangeKg: null,
      muscleCeilingKg: null,
      confidence,
      explanation: reason,
    };
  }

  const weeksRemaining = clamp(Math.abs((delta as number) / weeklyRateKg), 0, MAX_WEEKS);
  const daysRemaining = Math.round(weeksRemaining * 7);
  const targetDate = addDays(input.today, daysRemaining);
  const sessionsRemaining = Math.round(weeksRemaining * input.sessionsPerWeek);

  // Body composition split. On a gain, `qualityRatio` is the lean share; on a
  // loss it is the share of the loss coming from fat.
  const gaining = weeklyRateKg > 0;
  const totalChange = delta as number;
  const leanChangeKg = gaining
    ? round(totalChange * profile.qualityRatio, 1)
    : round(totalChange * (1 - profile.qualityRatio), 1);
  const fatChangeKg = round(totalChange - leanChangeKg, 1);

  // What training alone can add over the same window, independent of the scale.
  const months = weeksRemaining / 4.345;
  const muscleCeilingKg = round(
    input.currentWeightKg *
      monthlyMuscleGainPotential(input.experience) *
      months *
      profile.hypertrophyRate *
      adherenceFactor,
    1,
  );

  const milestones = buildMilestones(input, weeksRemaining, weeklyRateKg, totalChange);

  const explanation = base.usesObservedRate
    ? `Projected from your logged rate of ${Math.abs(round(input.observedWeeklyRateKg as number, 2))} kg per week, blended with the model for ${STRATEGIES[input.strategy].label.toLowerCase()}.`
    : `Projected from the model rate for ${STRATEGIES[input.strategy].label.toLowerCase()}. Log your weight weekly and this will follow your real rate.`;

  return {
    ...base,
    targetDate,
    daysRemaining,
    weeksRemaining: round(weeksRemaining, 1),
    sessionsRemaining,
    totalSessions: input.sessionsCompleted + sessionsRemaining,
    milestones,
    leanChangeKg,
    fatChangeKg,
    muscleCeilingKg,
    confidence,
    explanation,
  };
}

/** Quarter-way markers between here and the target, plus the target itself. */
function buildMilestones(
  input: ProjectionInput,
  weeksRemaining: number,
  weeklyRateKg: number,
  totalChange: number,
): Milestone[] {
  const steps = [0.25, 0.5, 0.75, 1];
  return steps.map((fraction, index) => {
    const weeks = weeksRemaining * fraction;
    const inDays = Math.round(weeks * 7);
    return {
      key: `milestone-${index}`,
      label:
        fraction === 1
          ? 'Target'
          : `${Math.round(fraction * 100)}% of the way`,
      date: addDays(input.today, inDays),
      weightKg: round(input.currentWeightKg + totalChange * fraction, 1),
      inDays,
      reached: false,
    };
  });
}

/**
 * What changing strategy does to the plan. Both projections are computed from
 * the same current state, so the comparison is like for like — progress already
 * made is carried into the new plan, not reset.
 */
export type StrategyComparison = {
  strategy: NutritionStrategy;
  projection: PlanProjection;
  /** Days later (+) or earlier (−) than the current strategy. */
  deltaDays: number | null;
};

export function compareStrategies(
  input: ProjectionInput,
  candidates: NutritionStrategy[],
): StrategyComparison[] {
  const current = projectPlan(input);
  return candidates.map((strategy) => {
    const projection = projectPlan({ ...input, strategy });
    const deltaDays =
      current.daysRemaining === null || projection.daysRemaining === null
        ? null
        : projection.daysRemaining - current.daysRemaining;
    return { strategy, projection, deltaDays };
  });
}
