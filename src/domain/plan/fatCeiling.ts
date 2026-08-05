import type { PlanRoute } from '@/domain/plan/routes';
import { monthlyMuscleGainPotential, strategyProfile } from '@/domain/plan/strategies';
import type { ExperienceLevel, NutritionStrategy } from '@/domain/types';
import { clamp, round } from '@/utils/math';

/**
 * "Build as fast as possible, but never past seventeen percent."
 *
 * This is the constraint people actually hold, and no plan picker asks for it.
 * They pick a goal and a pace, and then quietly abandon the plan when they do
 * not like what they see in the mirror — which is not a motivation problem, it
 * is a plan that was never told about the one limit that mattered.
 *
 * Given a ceiling, the block lengths stop being a template and become a
 * consequence: build until the projection says you would cross it, cut back to
 * a floor, build again. Someone lean gets a long first build; someone starting
 * near their ceiling is told to cut first, which is the honest answer even
 * though it is not the one they wanted.
 *
 * The arithmetic is the same model the rest of the plan uses. `qualityRatio`
 * is the share of gained weight that is lean, and of lost weight that is fat,
 * and lean gain is capped at what training can build in a week, exactly as
 * `simulateRoute` does — so nothing here invents a second view of how bodies
 * change. That agreement is not cosmetic: the ceiling route is drawn on the
 * same comparison screen as every other route, run through that simulator, and
 * a plan that promised never to cross the limit and then visibly crossed it
 * would be worse than no promise at all.
 */

export type CeilingInput = {
  weightKg: number;
  bodyFatPercent: number;
  /** Never go above this. */
  ceilingPercent: number;
  buildStrategy: NutritionStrategy;
  cutStrategy: NutritionStrategy;
  /** Sets the weekly cap on lean gain; surplus beyond it becomes fat. */
  experience: ExperienceLevel;
  horizonWeeks: number;
};

export type CeilingBlock = {
  strategy: NutritionStrategy;
  kind: 'build' | 'cut';
  label: string;
  weeks: number;
  startWeightKg: number;
  endWeightKg: number;
  startFatPercent: number;
  endFatPercent: number;
};

/**
 * Why the plan opens the way it does, in the user's own numbers.
 *
 * The module already decided; what was missing was the sentence. "Cuts first"
 * on its own reads as a refusal, and someone who came in wanting to build
 * hears it as the app disagreeing with them rather than as arithmetic. The
 * detail therefore has to carry the payoff — how long the cut takes and how
 * much building it unlocks — because that is the part that makes an unwelcome
 * first block worth accepting.
 */
export type CeilingRationale = {
  /** What the plan does first. */
  headline: string;
  /** Why it does that, with the numbers that made it the answer. */
  detail: string;
};

export type CeilingPlan = {
  blocks: CeilingBlock[];
  /** Set when the ceiling makes the stated goal impossible as asked. */
  warning: string | null;
  /** Body fat the cuts come back down to before building again. */
  floorPercent: number;
  /** Null only when the ceiling leaves no plan to explain. */
  rationale: CeilingRationale | null;
};

/**
 * How far below the ceiling a cut goes before building again.
 *
 * Cutting to exactly the ceiling would mean building for a week and cutting
 * again — all of the disruption of changing phase, none of the progress. Five
 * points buys a build phase long enough to be worth having.
 */
export const CEILING_SWING = 5;

/** Below this, cutting further costs performance and is not a plan. */
const MIN_SENSIBLE_FLOOR = 8;

/** Anything shorter than this is not a phase, it is a rounding error. */
const MIN_BLOCK_WEEKS = 3;

/** The ceiling actually used, once it is held inside what is sensible. */
export function resolveCeiling(ceilingPercent: number): number {
  return clamp(ceilingPercent, MIN_SENSIBLE_FLOOR + 2, 45);
}

export function planToCeiling(input: CeilingInput): CeilingPlan {
  const walked = walk(input);

  return {
    ...walked,
    rationale: explain(input, walked.blocks, resolveCeiling(input.ceilingPercent), walked.floorPercent),
  };
}

/**
 * The plan itself, with no sentence attached.
 *
 * Split out from `planToCeiling` so that the explanation — which needs to run
 * the model a second time from the far side of the cut to find the payoff —
 * cannot recurse into the thing that is calling it.
 */
function walk(input: CeilingInput): Omit<CeilingPlan, 'rationale'> {
  const ceiling = resolveCeiling(input.ceilingPercent);
  const floorPercent = Math.max(MIN_SENSIBLE_FLOOR, ceiling - CEILING_SWING);

  const build = strategyProfile(input.buildStrategy);
  const cut = strategyProfile(input.cutStrategy);

  let weightKg = input.weightKg;
  let fatKg = (input.bodyFatPercent / 100) * weightKg;
  let weeksLeft = input.horizonWeeks;

  const blocks: CeilingBlock[] = [];
  let warning: string | null = null;

  // Starting above the ceiling: the only honest first move is down.
  let phase: 'build' | 'cut' = input.bodyFatPercent >= ceiling ? 'cut' : 'build';
  if (phase === 'cut') {
    warning = `You are already at or above ${round(input.bodyFatPercent, 1)} % body fat, so the plan cuts first.`;
  }

  while (weeksLeft >= MIN_BLOCK_WEEKS) {
    const profile = phase === 'build' ? build : cut;
    const startWeightKg = weightKg;
    const startFat = percent(fatKg, weightKg);

    let weeks = 0;
    while (weeks < weeksLeft) {
      const change = profile.weeklyWeightChangePct * weightKg;
      // `qualityRatio` is the lean share when gaining, the fat share when
      // losing. Gaining is capped a second time by what training can actually
      // build that week: a surplus past that cap does not become more muscle,
      // it becomes fat, which is precisely what eats the headroom.
      let fatChange: number;
      if (change > 0) {
        const weeklyMuscleCeiling =
          ((weightKg * monthlyMuscleGainPotential(input.experience)) / 4.345) * profile.hypertrophyRate;
        const leanChange = Math.min(change * profile.qualityRatio, weeklyMuscleCeiling);
        fatChange = change - leanChange;
      } else {
        fatChange = change * profile.qualityRatio;
      }

      const nextWeight = weightKg + change;
      const nextFat = fatKg + fatChange;
      const nextPercent = percent(nextFat, nextWeight);

      if (phase === 'build' && nextPercent > ceiling) break;
      if (phase === 'cut' && nextPercent <= floorPercent) {
        weightKg = nextWeight;
        fatKg = nextFat;
        weeks += 1;
        break;
      }

      weightKg = nextWeight;
      fatKg = nextFat;
      weeks += 1;
    }

    if (weeks === 0) {
      // A build that cannot run for a single week means the ceiling is right
      // where you are. Say so rather than emitting an empty phase.
      if (phase === 'build' && blocks.length === 0) {
        warning =
          warning ??
          `At ${round(input.bodyFatPercent, 1)} % you are already at your ${ceiling} % limit, so there is no room to build without crossing it.`;
      }
      phase = phase === 'build' ? 'cut' : 'build';
      if (blocks.length === 0 && phase === 'build') break;
      continue;
    }

    blocks.push({
      strategy: phase === 'build' ? input.buildStrategy : input.cutStrategy,
      kind: phase,
      label: phase === 'build' ? 'Build' : 'Cut',
      weeks,
      startWeightKg: round(startWeightKg, 1),
      endWeightKg: round(weightKg, 1),
      startFatPercent: round(startFat, 1),
      endFatPercent: round(percent(fatKg, weightKg), 1),
    });

    weeksLeft -= weeks;
    phase = phase === 'build' ? 'cut' : 'build';
  }

  return { blocks: merge(blocks), warning, floorPercent: round(floorPercent, 1) };
}

/**
 * Turns the shape of the plan into the sentence that justifies it.
 *
 * Everything in here is read back off the blocks the simulation produced
 * rather than asserted, so the explanation cannot drift from the plan it is
 * explaining. The cut-first case re-runs the model from the floor to find the
 * payoff, because "you have to cut" and "cutting buys you thirty weeks of
 * building" are the same fact and only the second one is persuasive.
 */
function explain(
  input: CeilingInput,
  blocks: CeilingBlock[],
  ceiling: number,
  floorPercent: number,
): CeilingRationale | null {
  const first = blocks[0];
  if (!first) return null;

  const start = round(input.bodyFatPercent, 1);

  if (first.kind === 'cut') {
    const payoff = weeksOfHeadroom({
      ...input,
      weightKg: first.endWeightKg,
      bodyFatPercent: first.endFatPercent,
    });

    const opening =
      start >= ceiling
        ? `At ${start} % you are already at your ${ceiling} % limit, so a surplus would cross it in the first week — there is no building block to run from here.`
        : `At ${start} % there is not enough room under ${ceiling} % for a building block worth running.`;

    const reward =
      payoff > 0
        ? ` Cutting to ${floorPercent} % takes about ${first.weeks} weeks and opens up a ${payoff}-week run of building before the limit stops you again.`
        : ` The cut to ${floorPercent} % takes about ${first.weeks} weeks, and building starts from there.`;

    return { headline: 'Your plan starts with a cut', detail: opening + reward };
  }

  const next = blocks[1];
  const detail =
    next && next.kind === 'cut'
      ? `At ${start} % you get ${first.weeks} weeks of building before the projection reaches ${ceiling} %. The ${next.weeks}-week cut after it takes you back to ${floorPercent} % so the next build has room to run.`
      : `At ${start} % the projection does not reach ${ceiling} % inside the ${input.horizonWeeks} weeks you are planning, so the whole plan is one building block. The limit costs you nothing here.`;

  return { headline: 'Your plan starts by building', detail };
}

/** The id the ceiling plan is stored and compared under. */
export const CEILING_ROUTE_ID = 'fat_ceiling';

/**
 * The ceiling plan, shaped like every other route.
 *
 * Wrapping it this way is what lets it be simulated, drawn and compared by the
 * machinery the named routes already use, instead of living on its own screen
 * as a thing you have to take on faith next to plans you can see.
 */
export function ceilingRoute(input: CeilingInput): PlanRoute {
  const ceiling = resolveCeiling(input.ceilingPercent);
  const plan = planToCeiling(input);

  return {
    id: CEILING_ROUTE_ID,
    name: `Never past ${round(ceiling, 0)} %`,
    summary: `Builds and cuts in whatever lengths keep you under ${round(ceiling, 0)} % the whole way.`,
    bestFor: 'You have a number you will not go above, and the plan should obey it.',
    blocks: plan.blocks.map((block) => ({
      strategy: block.strategy,
      weeks: block.weeks,
      label: block.label,
    })),
  };
}

/**
 * Blocks too short to be phases get folded into the one before them.
 *
 * A two-week cut at the end of a horizon is not something anyone runs; it is
 * the tail of the arithmetic. Better to let the previous phase own those weeks
 * than to draw a phase nobody will follow.
 */
function merge(blocks: CeilingBlock[]): CeilingBlock[] {
  const out: CeilingBlock[] = [];

  for (const block of blocks) {
    const previous = out[out.length - 1];
    if (block.weeks < MIN_BLOCK_WEEKS && previous) {
      previous.weeks += block.weeks;
      previous.endWeightKg = block.endWeightKg;
      previous.endFatPercent = block.endFatPercent;
      continue;
    }
    out.push({ ...block });
  }

  return out;
}

function percent(fatKg: number, weightKg: number): number {
  return weightKg <= 0 ? 0 : (fatKg / weightKg) * 100;
}

/**
 * How long you can keep building before the ceiling stops you.
 *
 * The single number worth putting on a screen: someone asking "how fast can I
 * build" is really asking "how long do I get before I have to stop".
 */
export function weeksOfHeadroom(input: Omit<CeilingInput, 'horizonWeeks'>): number {
  const first = walk({ ...input, horizonWeeks: 260 }).blocks[0];
  return first && first.kind === 'build' ? first.weeks : 0;
}
