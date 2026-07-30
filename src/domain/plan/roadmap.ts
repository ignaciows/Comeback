import type { PlanPhaseView } from '@/domain/plan/phases';
import { calculateMacros, type Macros } from '@/domain/plan/simulate';
import { strategyProfile } from '@/domain/plan/strategies';
import type { NutritionStrategy } from '@/domain/types';

/**
 * The whole road, month by month, in the two terms that actually change.
 *
 * A plan told as "sixteen weeks of recomposition" is not a plan anyone can
 * follow. What someone needs to see is: *for these weeks I eat this much and
 * train like this; then it changes to this*. Two things per stretch, both
 * concrete, both different from the stretch before.
 *
 * Everything here is derived from the phases the plan already produced — no
 * second model, no second set of numbers. If the plan changes, this changes
 * with it, because it is only ever a reading of the same thing.
 */

export type TrainingCharacter = {
  /** "Heavy and low-rep", "Hold the strength you have" — four words. */
  label: string;
  /** What the sessions feel like, in one sentence. */
  detail: string;
  /** What the app actually does differently in this phase. */
  emphasis: 'build' | 'maintain' | 'preserve';
};

/**
 * What training looks like in a phase, from what the phase is for.
 *
 * In a surplus there is material to build with, so the work goes up and the
 * loads climb. In a deficit there is not, and the goal changes from adding
 * muscle to keeping it: the same heavy loads, less total work, because the
 * recovery to support more is not there. Getting this backwards — chasing
 * volume in a deficit — is the classic way to lose muscle while dieting.
 */
export function trainingFor(strategy: NutritionStrategy): TrainingCharacter {
  const balance = strategyProfile(strategy).energyBalancePct;

  if (balance > 0) {
    return {
      label: 'Build',
      detail: 'Loads climb and the sets add up. This is when the plan asks the most of you.',
      emphasis: 'build',
    };
  }

  if (balance < 0) {
    return {
      label: 'Hold what you built',
      detail: 'Same weights, fewer sets. Keeping the strength matters more than adding to it.',
      emphasis: 'preserve',
    };
  }

  return {
    label: 'Steady',
    detail: 'Progress where it comes, no forcing. Nothing to recover from beyond the sessions.',
    emphasis: 'maintain',
  };
}

export type RoadmapStop = {
  phase: PlanPhaseView;
  /** "Weeks 1–6", or "Now" for the one you are in. */
  span: string;
  /** Weeks from the start of the plan. */
  fromWeek: number;
  toWeek: number;
  macros: Macros;
  training: TrainingCharacter;
  /** Body weight this phase is planned around, in kg. */
  weightKg: number;
  /** Set when the eating changes from the phase before it. */
  changeFromPrevious: string | null;
};

export type RoadmapInput = {
  phases: PlanPhaseView[];
  /** Weight now — later phases are planned around where the plan says you will be. */
  currentWeightKg: number;
  proteinGPerKg: number;
};

/**
 * Turns the phases into stops on a road, each with its own numbers.
 *
 * The weight each phase is planned around is the weight the plan expects you
 * to *be* at when it starts, not today's — protein scales with body weight, so
 * a cut that starts eight kilos heavier has a different target, and quoting
 * today's number for month five would be wrong.
 */
export function buildRoadmap({ phases, currentWeightKg, proteinGPerKg }: RoadmapInput): RoadmapStop[] {
  let weightKg = currentWeightKg;
  let week = 1;

  return phases.map((phase, index) => {
    const weeks = Math.max(1, Math.round(phase.days / 7));
    const fromWeek = week;
    const toWeek = week + weeks - 1;
    week = toWeek + 1;

    const macros = calculateMacros(phase.kcal, weightKg, proteinGPerKg);
    const previous = index > 0 ? phases[index - 1] : null;

    // Carry the projected change forward so the next phase is planned around
    // the body that will actually be doing it.
    weightKg = Math.round((weightKg + phase.weightChangeKg) * 10) / 10;

    return {
      phase,
      fromWeek,
      toWeek,
      span: weeks === 1 ? `Week ${fromWeek}` : `Weeks ${fromWeek}–${toWeek}`,
      macros,
      training: trainingFor(phase.strategy),
      weightKg,
      changeFromPrevious: describeChange(previous?.kcal ?? null, phase.kcal),
    };
  });
}

/**
 * How the eating changes at the boundary.
 *
 * Only worth saying when it is a real change — a fifty-calorie drift between
 * phases is arithmetic, not an instruction.
 */
function describeChange(previousKcal: number | null, kcal: number): string | null {
  if (previousKcal === null) return null;
  const delta = kcal - previousKcal;
  if (Math.abs(delta) < 100) return null;
  return delta > 0 ? `+${delta} kcal a day from here` : `${delta} kcal a day from here`;
}
