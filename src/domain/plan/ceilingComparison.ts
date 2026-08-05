import { CEILING_ROUTE_ID, ceilingRoute, resolveCeiling } from '@/domain/plan/fatCeiling';
import { ROUTES, simulateRoute, type RouteInput, type RouteSimulation } from '@/domain/plan/routes';
import type { NutritionStrategy } from '@/domain/types';
import { round } from '@/utils/math';

/**
 * The ceiling route, judged against the plans it is competing with.
 *
 * On its own, "never past seventeen percent" is a promise with nothing to
 * weigh it against — the user cannot tell whether the limit cost them two
 * weeks or two months, so they either accept it blindly or ignore it. The
 * trade only becomes a decision when the alternatives are on the screen with
 * the same starting body and the same simulator behind them: this one is
 * slower, and it is the only one that never crosses.
 *
 * Every route here goes through `simulateRoute`, including the ceiling route
 * itself. Checking our own plan with the same instrument as the rivals is the
 * point — a promise verified by the model that made it is not verified.
 */

export type CeilingCheck = {
  routeId: string;
  name: string;
  weeks: number;
  muscleGainKg: number;
  /** Highest body fat reached on the way; null when body fat is unknown. */
  peakBodyFatPercent: number | null;
  /** Points past the ceiling at the worst moment. Zero when it never crosses. */
  overshoot: number;
  crosses: boolean;
};

export type CeilingComparison = {
  ceiling: number;
  /** The ceiling plan, simulated like any other route. */
  simulation: RouteSimulation;
  ours: CeilingCheck;
  /** The named routes, worst overshoot first. */
  others: CeilingCheck[];
  /** What the limit costs, in one sentence. Null when it costs nothing. */
  trade: string | null;
};

export type CeilingComparisonOptions = {
  buildStrategy?: NutritionStrategy;
  cutStrategy?: NutritionStrategy;
  /** How far out to plan. Matches the horizon the rest of the plan uses. */
  horizonWeeks?: number;
};

/**
 * Returns null when body fat is unknown, because every claim this makes is
 * about body fat and a comparison built on a guessed starting point would be
 * confidently wrong rather than absent.
 */
export function compareAgainstCeiling(
  input: RouteInput,
  ceilingPercent: number,
  options: CeilingComparisonOptions = {},
): CeilingComparison | null {
  const startPercent = input.bodyFatPercent;
  if (startPercent === null) return null;

  const ceiling = resolveCeiling(ceilingPercent);
  const route = ceilingRoute({
    weightKg: input.currentWeightKg,
    bodyFatPercent: startPercent,
    ceilingPercent,
    buildStrategy: options.buildStrategy ?? 'lean_bulk',
    cutStrategy: options.cutStrategy ?? 'cut',
    experience: input.experience,
    horizonWeeks: options.horizonWeeks ?? 32,
  });

  if (route.blocks.length === 0) return null;

  const simulation = simulateRoute(input, route);
  const ours = check(simulation, ceiling, startPercent);
  const others = ROUTES.filter((candidate) => candidate.id !== CEILING_ROUTE_ID)
    .map((candidate) => check(simulateRoute(input, candidate), ceiling, startPercent))
    .sort((a, b) => b.overshoot - a.overshoot);

  return { ceiling, simulation, ours, others, trade: tradeSentence(ceiling, ours, others) };
}

/**
 * Crossing means the route takes you somewhere worse than where it found you.
 *
 * Someone starting at 18.7 % with a 17 % limit is over the line before any
 * plan has done anything, and measuring against the bare ceiling would mark
 * every route — including the one that cuts immediately — as breaking a
 * promise it is in the middle of keeping. The line to judge against is
 * therefore the worse of the ceiling and the starting point.
 */
function check(simulation: RouteSimulation, ceiling: number, startPercent: number): CeilingCheck {
  const peak = simulation.peakBodyFatPercent;
  const line = Math.max(ceiling, startPercent);
  const overshoot = peak === null ? 0 : Math.max(0, round(peak - line, 1));

  return {
    routeId: simulation.route.id,
    name: simulation.route.name,
    weeks: simulation.totalWeeks,
    muscleGainKg: simulation.muscleGainKg,
    peakBodyFatPercent: peak,
    overshoot,
    crosses: overshoot > 0,
  };
}

/**
 * The comparison worth putting in words: the rival that builds the most while
 * breaking the limit.
 *
 * Picking the biggest builder rather than the biggest overshoot is deliberate.
 * The honest objection to a ceiling is "but I would have gained more without
 * it", so the sentence has to answer that route specifically — beating a plan
 * nobody was tempted by proves nothing.
 */
function tradeSentence(ceiling: number, ours: CeilingCheck, others: CeilingCheck[]): string | null {
  const crossers = others.filter((other) => other.crosses);
  if (crossers.length === 0) return null;

  const rival = crossers.reduce((best, other) => (other.muscleGainKg > best.muscleGainKg ? other : best));
  const extraMuscle = round(rival.muscleGainKg - ours.muscleGainKg, 1);
  const extraWeeks = ours.weeks - rival.weeks;

  const cost =
    extraMuscle > 0.1
      ? `${extraMuscle} kg more muscle`
      : extraMuscle < -0.1
        ? `${Math.abs(extraMuscle)} kg less muscle`
        : 'about the same muscle';

  const time =
    extraWeeks > 0
      ? `${extraWeeks} weeks longer`
      : extraWeeks < 0
        ? `${Math.abs(extraWeeks)} weeks quicker`
        : 'the same time';

  return `${rival.name} gets you ${cost}, and peaks at ${rival.peakBodyFatPercent} % — ${rival.overshoot} points over your ${ceiling} % limit. This one takes ${time} and never crosses it.`;
}
