import type { NutritionStrategy } from '@/domain/types';
import { clamp } from '@/utils/math';
import type { PlanRoute, RouteSimulation } from './routes';
import { strategyProfile } from './strategies';

/**
 * Building a plan by hand, with the parts that are not negotiable held fixed.
 *
 * The user drags block lengths around and everything recalculates. What they
 * cannot do is drag their way to a result the body will not produce — not
 * because the app refuses, but because the simulation underneath already caps
 * muscle gain at what training can build in the time given, so a longer bulk
 * simply adds more fat and says so.
 *
 * The limits here are about whether a block is worth running at all:
 *
 *  · A gaining block under four weeks moves water and glycogen, not tissue.
 *    Measurable muscle needs longer than that to show up over the noise.
 *  · A deficit under three weeks is the same story in reverse.
 *  · Long deficits are where adherence and metabolic adaptation both bite
 *    (Trexler, Smith-Ryan & Norton 2014), so past about sixteen weeks the app
 *    says to break it up rather than pretending week 20 works like week 2.
 *  · Nothing projects past a year. Beyond that the estimate is noise wearing a
 *    date, which is the one thing this app does not do.
 */

export type CustomBlock = {
  id: string;
  strategy: NutritionStrategy;
  weeks: number;
};

type Limit = { min: number; max: number; reason: string };

export const BLOCK_LIMITS: Record<NutritionStrategy, Limit> = {
  bulk: { min: 4, max: 20, reason: 'Under four weeks a surplus moves water, not muscle.' },
  moderate_bulk: { min: 4, max: 22, reason: 'Under four weeks a surplus moves water, not muscle.' },
  lean_bulk: { min: 4, max: 24, reason: 'Under four weeks a surplus moves water, not muscle.' },
  slow_bulk: { min: 6, max: 32, reason: 'Gaining this slowly needs six weeks before the scale says anything at all.' },
  maintain: { min: 2, max: 16, reason: 'Holding steady is only worth planning in blocks of a fortnight.' },
  lean_cut: { min: 3, max: 20, reason: 'A deficit needs three weeks before the change is real rather than water.' },
  moderate_cut: { min: 3, max: 18, reason: 'A deficit needs three weeks before the change is real rather than water.' },
  cut: { min: 3, max: 16, reason: 'A deficit needs three weeks before the change is real rather than water.' },
  aggressive_cut: { min: 3, max: 12, reason: 'A hard deficit past twelve weeks costs muscle and adherence.' },
};

/** Nothing is planned further out than this; past a year it is a guess. */
export const MAX_TOTAL_WEEKS = 52;
export const MAX_BLOCKS = 4;

export function limitsFor(strategy: NutritionStrategy): Limit {
  return BLOCK_LIMITS[strategy] ?? BLOCK_LIMITS.maintain;
}

/** Holds a block inside its own limits and inside what is left of the year. */
export function clampBlockWeeks(
  strategy: NutritionStrategy,
  weeks: number,
  weeksUsedByOtherBlocks = 0,
): number {
  const limit = limitsFor(strategy);
  const roomLeft = Math.max(limit.min, MAX_TOTAL_WEEKS - weeksUsedByOtherBlocks);
  return Math.round(clamp(weeks, limit.min, Math.min(limit.max, roomLeft)));
}

export function totalWeeks(blocks: CustomBlock[]): number {
  return blocks.reduce((total, block) => total + block.weeks, 0);
}

/** Wraps hand-made blocks as a route, so the same simulator runs both. */
export function toRoute(blocks: CustomBlock[], name = 'Your plan'): PlanRoute {
  return {
    id: 'custom',
    name,
    summary: 'Built by you.',
    bestFor: 'Whatever you decided it is for.',
    blocks: blocks.map((block) => ({
      strategy: block.strategy,
      weeks: block.weeks,
      label: strategyProfile(block.strategy).label,
    })),
  };
}

export type PlanNote = {
  id: string;
  /** `blocked` means the plan cannot be saved as it stands. */
  severity: 'blocked' | 'warning' | 'info';
  message: string;
};

/**
 * What is wrong, or worth knowing, about the plan as currently dragged.
 *
 * Read from the simulation rather than from the user's intent — the honest
 * answer to "can I gain ten kilos of muscle in eight weeks" is not a refusal,
 * it is the simulation showing that eight of those kilos would be fat.
 */
export function reviewPlan(blocks: CustomBlock[], simulation: RouteSimulation | null): PlanNote[] {
  const notes: PlanNote[] = [];

  if (blocks.length === 0) {
    return [{ id: 'empty', severity: 'blocked', message: 'Add at least one block.' }];
  }

  const total = totalWeeks(blocks);
  if (total > MAX_TOTAL_WEEKS) {
    notes.push({
      id: 'too_long',
      severity: 'blocked',
      message: `${total} weeks is past the year this can honestly project. Trim it to ${MAX_TOTAL_WEEKS}.`,
    });
  }

  for (const block of blocks) {
    const limit = limitsFor(block.strategy);
    if (block.weeks < limit.min) {
      notes.push({
        id: `short_${block.id}`,
        severity: 'blocked',
        message: `${strategyProfile(block.strategy).label}: ${limit.reason}`,
      });
    }
    if (block.weeks > limit.max) {
      notes.push({
        id: `long_${block.id}`,
        severity: 'warning',
        message: `${strategyProfile(block.strategy).label} past ${limit.max} weeks — split it with a break instead.`,
      });
    }
  }

  // Two gaining blocks back to back is one longer gaining block with a line
  // drawn through it.
  for (let index = 1; index < blocks.length; index += 1) {
    const previous = strategyProfile(blocks[index - 1].strategy);
    const current = strategyProfile(blocks[index].strategy);
    if (Math.sign(previous.energyBalancePct) === Math.sign(current.energyBalancePct)) {
      notes.push({
        id: `same_${blocks[index].id}`,
        severity: 'info',
        message: `Two ${previous.energyBalancePct >= 0 ? 'gaining' : 'losing'} blocks in a row behave as one long one.`,
      });
    }
  }

  if (simulation) {
    // The part the user cannot drag their way around.
    const gained = simulation.endWeightKg - simulation.startWeightKg;
    if (gained > 0 && simulation.muscleGainKg >= 0) {
      const fat = simulation.fatChangeKg;
      if (fat > simulation.muscleGainKg) {
        notes.push({
          id: 'mostly_fat',
          severity: 'warning',
          message: `Most of the ${gained.toFixed(1)} kg gained here is fat — your training can build about ${simulation.muscleGainKg.toFixed(1)} kg in this time.`,
        });
      }
    }

    if (simulation.peakBodyFatPercent !== null && simulation.peakBodyFatPercent >= 22) {
      notes.push({
        id: 'peak_bf',
        severity: 'warning',
        message: `You would pass ${Math.round(simulation.peakBodyFatPercent)}% body fat on the way. Cutting back from there takes longer than the build saved.`,
      });
    }
  }

  return notes;
}

export function planIsSavable(notes: PlanNote[]): boolean {
  return !notes.some((note) => note.severity === 'blocked');
}

/** A sensible starting point: three months building, two taking it off. */
export function defaultCustomBlocks(): CustomBlock[] {
  return [
    { id: 'b1', strategy: 'lean_bulk', weeks: 12 },
    { id: 'b2', strategy: 'cut', weeks: 8 },
  ];
}

/** The strategies offered in the builder, gaining first. */
export const BUILDER_STRATEGIES: NutritionStrategy[] = [
  'bulk',
  'moderate_bulk',
  'lean_bulk',
  'slow_bulk',
  'maintain',
  'lean_cut',
  'moderate_cut',
  'cut',
  'aggressive_cut',
];
