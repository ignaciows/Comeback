import { strategyProfile } from '@/domain/plan/strategies';
import type { NutritionStrategy } from '@/domain/types';
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
 * so nothing here invents a second view of how bodies change.
 */

export type CeilingInput = {
  weightKg: number;
  bodyFatPercent: number;
  /** Never go above this. */
  ceilingPercent: number;
  buildStrategy: NutritionStrategy;
  cutStrategy: NutritionStrategy;
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

export type CeilingPlan = {
  blocks: CeilingBlock[];
  /** Set when the ceiling makes the stated goal impossible as asked. */
  warning: string | null;
  /** Body fat the cuts come back down to before building again. */
  floorPercent: number;
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

export function planToCeiling(input: CeilingInput): CeilingPlan {
  const ceiling = clamp(input.ceilingPercent, MIN_SENSIBLE_FLOOR + 2, 45);
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
      // `qualityRatio` is the lean share when gaining, the fat share when losing.
      const fatChange = change > 0 ? change * (1 - profile.qualityRatio) : change * profile.qualityRatio;

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
  const plan = planToCeiling({ ...input, horizonWeeks: 260 });
  const first = plan.blocks[0];
  return first && first.kind === 'build' ? first.weeks : 0;
}
