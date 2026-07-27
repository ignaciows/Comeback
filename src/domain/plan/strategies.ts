import type { ExperienceLevel, GoalType, NutritionStrategy } from '@/domain/types';

/**
 * Nutrition strategies and the rates the projections are built from.
 *
 * The numbers below are the consensus ranges in the applied literature, taken
 * conservatively. They are population averages used to project a trajectory —
 * they are not predictions about one person, and everything derived from them
 * is presented as an estimate with a confidence level.
 *
 * Sources (see `src/data/trainingPrinciples.ts` for the full list):
 *  · Weight-loss rate 0.5–1.0 %BW/week preserves lean mass best — Helms et al.,
 *    2014, "Evidence-based recommendations for natural bodybuilding contest
 *    preparation".
 *  · Faster loss (~1.4 %BW/wk) costs lean mass and performance versus slower
 *    loss (~0.7 %BW/wk) — Garthe et al., 2011.
 *  · Surplus beyond ~10–20 % of maintenance adds fat without adding muscle —
 *    Garthe et al., 2013; Slater et al., 2019.
 *  · Muscle gain potential by training age — Aragon & Schoenfeld's rate model,
 *    ~1–1.5 %BW/month untrained, 0.5–1 % intermediate, 0.25–0.5 % advanced.
 *  · Protein 1.6 g/kg saturates most of the hypertrophy response, with benefit
 *    up to ~2.2 g/kg; higher in a deficit — Morton et al., 2018 meta-analysis.
 */

export type StrategyProfile = {
  id: NutritionStrategy;
  label: string;
  /** One line the user sees on the plan picker. */
  summary: string;
  /** Expected weekly body-weight change, as a fraction of body weight. */
  weeklyWeightChangePct: number;
  /** Energy balance relative to maintenance, e.g. -0.20 = 20 % deficit. */
  energyBalancePct: number;
  /**
   * Of the weight *gained*, the share that is lean tissue. For losing
   * strategies this is the share of the loss that comes from fat.
   */
  qualityRatio: number;
  /** Protein target range in g per kg of body weight. */
  proteinGPerKg: [number, number];
  /** How much of the achievable muscle-gain rate this strategy allows. */
  hypertrophyRate: number;
  /** What the strategy costs; shown next to the benefit, never hidden. */
  tradeoff: string;
};

export const STRATEGIES: Record<NutritionStrategy, StrategyProfile> = {
  aggressive_cut: {
    id: 'aggressive_cut',
    label: 'Aggressive cut',
    summary: 'Fastest fat loss, at the cost of strength and recovery.',
    weeklyWeightChangePct: -0.01,
    energyBalancePct: -0.25,
    qualityRatio: 0.75,
    proteinGPerKg: [2.2, 2.6],
    hypertrophyRate: 0.2,
    tradeoff: 'Expect flat or falling lifts and lower session quality.',
  },
  cut: {
    id: 'cut',
    label: 'Cut',
    summary: 'Steady fat loss while holding most of your strength.',
    weeklyWeightChangePct: -0.007,
    energyBalancePct: -0.2,
    qualityRatio: 0.85,
    proteinGPerKg: [2.0, 2.4],
    hypertrophyRate: 0.4,
    tradeoff: 'Small strength losses on the heaviest sets are normal.',
  },
  lean_cut: {
    id: 'lean_cut',
    label: 'Slow cut',
    summary: 'Slow fat loss that protects performance and muscle.',
    weeklyWeightChangePct: -0.004,
    energyBalancePct: -0.12,
    qualityRatio: 0.92,
    proteinGPerKg: [1.8, 2.2],
    hypertrophyRate: 0.65,
    tradeoff: 'Takes roughly twice as long as a standard cut.',
  },
  maintain: {
    id: 'maintain',
    label: 'Maintain',
    summary: 'Hold your weight and let training do the work.',
    weeklyWeightChangePct: 0,
    energyBalancePct: 0,
    qualityRatio: 1,
    proteinGPerKg: [1.6, 2.0],
    hypertrophyRate: 0.8,
    tradeoff: 'Recomposition is slow unless you are new or returning.',
  },
  lean_bulk: {
    id: 'lean_bulk',
    label: 'Lean bulk',
    summary: 'Best muscle-to-fat ratio. The default for building.',
    weeklyWeightChangePct: 0.0025,
    energyBalancePct: 0.1,
    qualityRatio: 0.55,
    proteinGPerKg: [1.6, 2.2],
    hypertrophyRate: 1,
    tradeoff: 'Scale moves slowly; judge it over months, not weeks.',
  },
  bulk: {
    id: 'bulk',
    label: 'Aggressive bulk',
    summary: 'Maximum weight gain. Most of the extra is fat.',
    weeklyWeightChangePct: 0.005,
    energyBalancePct: 0.2,
    qualityRatio: 0.35,
    proteinGPerKg: [1.6, 2.2],
    hypertrophyRate: 1,
    tradeoff: 'Above roughly +20 % of maintenance, added calories go to fat.',
  },
};

export const STRATEGY_ORDER: NutritionStrategy[] = [
  'aggressive_cut',
  'cut',
  'lean_cut',
  'maintain',
  'lean_bulk',
  'bulk',
];

/** Achievable muscle gain, as a fraction of body weight per month. */
export function monthlyMuscleGainPotential(experience: ExperienceLevel): number {
  switch (experience) {
    case 'beginner':
      return 0.0125;
    // Returning lifters regain faster than they built it the first time.
    case 'returning':
      return 0.01;
    case 'intermediate':
      return 0.0075;
    case 'advanced':
      return 0.00375;
  }
}

/**
 * Mifflin-St Jeor resting energy expenditure. `sex` is optional: when it is not
 * set, the constant used is the midpoint of the male and female terms, which
 * keeps the estimate honest rather than assuming.
 */
export function restingEnergyExpenditure(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female' | 'unspecified';
}): number {
  const constant = input.sex === 'male' ? 5 : input.sex === 'female' ? -161 : -78;
  return Math.round(10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + constant);
}

/** Activity multiplier from weekly training frequency. */
export function activityFactor(sessionsPerWeek: number): number {
  return Math.min(1.6, 1.2 + 0.045 * Math.max(0, sessionsPerWeek));
}

export function maintenanceCalories(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female' | 'unspecified';
  sessionsPerWeek: number;
}): number {
  return Math.round(restingEnergyExpenditure(input) * activityFactor(input.sessionsPerWeek));
}

/** The strategy that best matches a stated goal, used as the starting point. */
export function defaultStrategyFor(goalType: GoalType): NutritionStrategy {
  switch (goalType) {
    case 'lose_fat':
      return 'cut';
    case 'build_muscle':
    case 'build_strength':
      return 'lean_bulk';
    case 'recomposition':
      // Muscle-first recomposition: a small surplus beats maintenance for
      // anyone who is not brand new to training.
      return 'lean_bulk';
    case 'regain_condition':
    case 'maintain':
      return 'maintain';
  }
}
