import type {
  BiologicalSex,
  ExperienceLevel,
  FatTolerance,
  ISODate,
  NutritionStrategy,
  PlanObjective,
  PlanSpeed,
} from '@/domain/types';
import { clamp, round } from '@/utils/math';
import { requiredSessionsPerWeek } from './commitments';
import { projectPlan, type PlanProjection } from './projection';
import { monthlyMuscleGainPotential, strategyProfile } from './strategies';

/**
 * Inverse planning.
 *
 * The user does not tell the app how many days a week they can train or how
 * many calories to eat. They say what they want and how fast, and this derives
 * everything needed to get there — frequency, energy balance, macros — plus
 * what that pace costs. Every number here is deterministic.
 */

export const SPEEDS: PlanSpeed[] = ['cautious', 'steady', 'fast', 'max'];

export const SPEED_LABELS: Record<PlanSpeed, string> = {
  cautious: 'Cautious',
  steady: 'Steady',
  fast: 'Fast',
  max: 'As fast as possible',
};

export const OBJECTIVE_LABELS: Record<PlanObjective, string> = {
  build: 'Build muscle',
  lean: 'Get lean',
  recomp: 'Both at once',
};

export const FAT_TOLERANCE_LABELS: Record<FatTolerance, string> = {
  minimal: 'Stay lean',
  some: 'Some is fine',
  whatever: 'Do not care',
};

/**
 * Strategy is an output, not a question. It follows from what you want, how
 * fast, and how much fat you will accept getting there.
 */
function deriveStrategy(
  objective: PlanObjective,
  speed: PlanSpeed,
  fatTolerance: FatTolerance,
): NutritionStrategy {
  if (objective === 'lean') {
    if (speed === 'cautious') return 'lean_cut';
    if (speed === 'max') return 'aggressive_cut';
    return 'cut';
  }

  if (objective === 'recomp') {
    if (speed === 'cautious' || speed === 'steady') return 'maintain';
    return 'lean_bulk';
  }

  // Building. A bigger surplus only earns its keep if fat gain is acceptable.
  if (speed === 'cautious') return 'lean_bulk';
  if (speed === 'steady') return fatTolerance === 'whatever' ? 'bulk' : 'lean_bulk';
  return fatTolerance === 'minimal' ? 'lean_bulk' : 'bulk';
}

/**
 * Sessions a week the pace actually needs.
 *
 * Faster gaining needs the volume to use the surplus, or the extra calories
 * become fat. Faster leaning needs enough stimulus to hold on to muscle, but
 * the deficit is doing most of the work, so it asks for less.
 *
 * The table lives in `commitments` and is imported rather than repeated: the
 * simulator's answer to "how many days does this need" and the plan screen's
 * answer to "how many days does this need" have to be the same number.
 */

export type Macros = {
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
};

/**
 * Protein from body weight, fat from the larger of a floor and a share of
 * intake, carbohydrate takes what is left. Standard, and stable enough that it
 * never needs to be guessed at.
 */
export function calculateMacros(kcal: number, weightKg: number, proteinGPerKg: number): Macros {
  const proteinG = Math.round(weightKg * proteinGPerKg);
  const fatG = Math.round(Math.max(weightKg * 0.7, (kcal * 0.25) / 9));
  const remaining = kcal - proteinG * 4 - fatG * 9;
  return {
    kcal,
    proteinG,
    fatG,
    carbsG: Math.max(0, Math.round(remaining / 4)),
  };
}

export type SimulationInput = {
  today: ISODate;
  objective: PlanObjective;
  speed: PlanSpeed;
  fatTolerance: FatTolerance;
  currentWeightKg: number;
  heightCm: number;
  age: number;
  sex: BiologicalSex;
  experience: ExperienceLevel;
  targetWeightKg: number | null;
  /** How far ahead the outcome view looks, when there is no target weight. */
  horizonWeeks: number;
  sessionsCompleted: number;
  goalStartedAt: ISODate;
  observedWeeklyRateKg: number | null;
  weeksOfWeightData: number;
  adherence: number;
  /** Set only when the user insists on a frequency the pace does not need. */
  daysPerWeekOverride?: number | null;
};

export type Requirement = { key: string; label: string };

export type SimulationResult = {
  strategy: NutritionStrategy;
  strategyLabel: string;
  daysPerWeek: number;
  projection: PlanProjection;
  macros: Macros;
  /** What you get if you hold this for `horizonWeeks`, regardless of target. */
  outcome: {
    weeks: number;
    weightChangeKg: number;
    leanChangeKg: number;
    fatChangeKg: number;
    /** Muscle the training can actually add in that time. */
    muscleKg: number;
  };
  /** Whether the pace is worth it, physiologically. */
  feasibility: 'comfortable' | 'demanding' | 'not_useful';
  /** What this pace asks of you. */
  requirements: Requirement[];
  /** What it costs. Never hidden behind the benefit. */
  tradeoffs: Requirement[];
};

/** Runs one full plan from an intent. Pure. */
export function simulatePlan(input: SimulationInput): SimulationResult {
  const strategy = deriveStrategy(input.objective, input.speed, input.fatTolerance);
  const profile = strategyProfile(strategy);
  const daysPerWeek = input.daysPerWeekOverride ?? requiredSessionsPerWeek(input.objective, input.speed);

  const projection = projectPlan({
    today: input.today,
    strategy,
    experience: input.experience,
    currentWeightKg: input.currentWeightKg,
    heightCm: input.heightCm,
    age: input.age,
    sex: input.sex,
    targetWeightKg: input.targetWeightKg,
    sessionsPerWeek: daysPerWeek,
    sessionsCompleted: input.sessionsCompleted,
    goalStartedAt: input.goalStartedAt,
    observedWeeklyRateKg: input.observedWeeklyRateKg,
    weeksOfWeightData: input.weeksOfWeightData,
    adherence: input.adherence,
  });

  const macros = calculateMacros(
    projection.targetKcal,
    input.currentWeightKg,
    (profile.proteinGPerKg[0] + profile.proteinGPerKg[1]) / 2,
  );

  // Outcome over the horizon, independent of whether a target exists.
  const weeks = input.horizonWeeks;
  const weightChangeKg = round(projection.weeklyRateKg * weeks, 1);
  const gaining = weightChangeKg > 0;
  const leanChangeKg = gaining
    ? round(weightChangeKg * profile.qualityRatio, 1)
    : round(weightChangeKg * (1 - profile.qualityRatio), 1);
  const muscleKg = round(
    input.currentWeightKg *
      monthlyMuscleGainPotential(input.experience) *
      (weeks / 4.345) *
      profile.hypertrophyRate *
      clamp(0.55 + input.adherence * 0.45, 0.55, 1),
    1,
  );

  const outcome = {
    weeks,
    weightChangeKg,
    leanChangeKg,
    fatChangeKg: round(weightChangeKg - leanChangeKg, 1),
    muscleKg,
  };

  // A surplus is only useful up to what training can turn into muscle. Gaining
  // at more than twice that rate means over half of it is fat by definition.
  const monthlyMuscleKg = input.currentWeightKg * monthlyMuscleGainPotential(input.experience);
  const weeklyMuscleCeiling = (monthlyMuscleKg / 4.345) * profile.hypertrophyRate;
  const overshooting = gaining && projection.weeklyRateKg > weeklyMuscleCeiling * 2;
  // 1 % of body weight a week is the top of the range that holds on to muscle;
  // past it, the loss starts coming out of lean tissue.
  const overCutting = !gaining && Math.abs(projection.weeklyRateKg) > input.currentWeightKg * 0.01;

  const feasibility: SimulationResult['feasibility'] =
    overshooting || overCutting
      ? 'not_useful'
      : daysPerWeek >= 5 || Math.abs(profile.energyBalancePct) >= 0.2
        ? 'demanding'
        : 'comfortable';

  const requirements: Requirement[] = [
    { key: 'frequency', label: `${daysPerWeek} sessions a week` },
    {
      key: 'calories',
      label:
        profile.energyBalancePct === 0
          ? `${macros.kcal} kcal a day, at maintenance`
          : `${macros.kcal} kcal a day (${profile.energyBalancePct > 0 ? '+' : ''}${Math.round(
              projection.targetKcal - projection.maintenanceKcal,
            )} vs maintenance)`,
    },
    { key: 'protein', label: `${macros.proteinG} g protein a day` },
  ];

  const tradeoffs: Requirement[] = [{ key: 'strategy', label: profile.tradeoff }];
  if (gaining && outcome.fatChangeKg > 0) {
    tradeoffs.push({
      key: 'fat',
      label: `About ${Math.abs(outcome.fatChangeKg)} kg of the ${Math.abs(outcome.weightChangeKg)} kg you gain will be fat`,
    });
  }
  if (!gaining && outcome.leanChangeKg < 0) {
    tradeoffs.push({
      key: 'lean',
      label: `About ${Math.abs(outcome.leanChangeKg)} kg of the ${Math.abs(outcome.weightChangeKg)} kg you lose will be lean tissue`,
    });
  }
  if (overshooting) {
    tradeoffs.push({
      key: 'ceiling',
      label: `Your training can only add about ${muscleKg} kg of muscle in ${weeks} weeks. Gaining faster than that adds fat, not muscle.`,
    });
  }
  if (overCutting) {
    tradeoffs.push({
      key: 'too_fast',
      label: 'Losing faster than about 1 % of body weight a week costs muscle and session quality.',
    });
  }

  return {
    strategy,
    strategyLabel: profile.label,
    daysPerWeek,
    projection,
    macros,
    outcome,
    feasibility,
    requirements,
    tradeoffs,
  };
}

export type SpeedOption = {
  speed: PlanSpeed;
  result: SimulationResult;
  /** Days sooner (negative) or later (positive) than the current speed. */
  deltaDays: number | null;
};

/**
 * The same goal at every pace, side by side. This is the screen that answers
 * "how fast can I get there, and what would it take".
 */
export function compareSpeeds(input: SimulationInput): SpeedOption[] {
  const current = simulatePlan(input);
  return SPEEDS.map((speed) => {
    const result = simulatePlan({ ...input, speed });
    const deltaDays =
      current.projection.daysRemaining === null || result.projection.daysRemaining === null
        ? null
        : result.projection.daysRemaining - current.projection.daysRemaining;
    return { speed, result, deltaDays };
  });
}

/**
 * The paces that are actually different from each other.
 *
 * There are four speeds, and depending on the objective two or three of them
 * land on the same body. Building at "cautious" and at "steady" both come out
 * at +2.5 kg, 1.4 of it lean; at "recomp" they agree on the calories and the
 * days as well, which is to say they are the same option printed twice. A
 * screen that offers four choices where two are identical is not offering
 * choice, it is asking someone to find a difference that is not there — and
 * they will look, because you put it in front of them.
 *
 * Where two paces reach the same outcome, the gentler one wins. Same result,
 * fewer sessions a week demanded, so there is no version of this where the
 * harder one is the better offer.
 *
 * This is presentation, not physiology: nothing here changes what any pace
 * does, it only stops the app from claiming a distinction it cannot back.
 */
export function distinctPaces<T extends { speed: PlanSpeed; result: SimulationResult }>(options: T[]): T[] {
  const seen = new Map<string, T>();

  // SPEEDS is ordered gentlest first, so the first arrival at any outcome is
  // already the one that asks for least.
  for (const option of options) {
    const { weightChangeKg, leanChangeKg, fatChangeKg } = option.result.outcome;
    const key = `${weightChangeKg}|${leanChangeKg}|${fatChangeKg}`;
    if (!seen.has(key)) seen.set(key, option);
  }

  return [...seen.values()];
}

/**
 * A target weight that matches the intent, so the user never has to invent one.
 * Building adds what training can plausibly support; leaning aims at a sane
 * amount of fat loss over the horizon.
 */
export function suggestTargetWeight(input: Omit<SimulationInput, 'targetWeightKg'>): number {
  const strategy = deriveStrategy(input.objective, input.speed, input.fatTolerance);
  const rate = strategyProfile(strategy).weeklyWeightChangePct * input.currentWeightKg;
  return round(input.currentWeightKg + rate * input.horizonWeeks, 1);
}
