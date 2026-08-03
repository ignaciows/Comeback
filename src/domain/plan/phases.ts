import type { ISODate, NutritionStrategy, WorkoutSession } from '@/domain/types';
import { addDays, daysBetween, isWithinDays } from '@/utils/date';
import { clamp, round } from '@/utils/math';
import { calculateMacros, type Macros } from './simulate';
import type { RouteSimulation } from './routes';
import { strategyProfile } from './strategies';

/**
 * The road to the target, cut into phases.
 *
 * Three hundred days drawn as three hundred squares is an ocean nobody can
 * read. The same days grouped into six or eight named stretches is a thing you
 * can be part-way through — you can see which stretch you are in, what it is
 * for, and how many are left in it rather than in the whole year.
 *
 * Each phase says what it does to you, including the parts that are not
 * flattering: a building phase adds some fat, and the honest version of that
 * sentence names the phase that takes it back off. Someone who is told in
 * advance that week nine looks softer does not quit in week nine.
 */

export type PlanPhaseView = {
  index: number;
  /** "Build", "Cut", "Phase 3" — short. */
  label: string;
  strategy: NutritionStrategy;
  startsOn: ISODate;
  endsOn: ISODate;
  days: number;
  /** Days of this phase already behind you. */
  daysDone: number;
  /** Sessions logged inside this phase's dates. */
  sessionsDone: number;
  weightChangeKg: number;
  leanChangeKg: number;
  fatChangeKg: number;
  /** What you are projected to weigh when this phase ends. */
  endWeightKg: number | null;
  /** Projected body fat at the end of it. Null without a starting reading. */
  endBodyFatPercent: number | null;
  kcal: number;
  /**
   * What to eat during this phase, at the weight this phase is planned around.
   *
   * Calories alone do not tell anyone what to buy. And they have to be
   * recomputed per phase rather than once for the plan: protein is a function
   * of body weight, so a phase that ends six kilos heavier asks for more of it
   * than the one before, and a single figure at the top of the plan would be
   * wrong for every phase except the one it was calculated in.
   */
  macros: Macros;
  /** What this phase is for, and what it costs. Two sentences at most. */
  story: string;
  state: 'done' | 'current' | 'ahead';
};

/** Phases shorter than this are merged; longer plans get more of them. */
const MIN_PHASE_DAYS = 14;
const TARGET_PHASES = 8;

function storyFor(
  strategy: NutritionStrategy,
  weightChangeKg: number,
  leanChangeKg: number,
  fatChangeKg: number,
  next: NutritionStrategy | null,
): string {
  const profile = strategyProfile(strategy);
  const gaining = profile.energyBalancePct > 0;
  const losing = profile.energyBalancePct < 0;
  const nextProfile = next ? strategyProfile(next) : null;
  const nextTakesItOff = nextProfile !== null && nextProfile.energyBalancePct < 0;

  if (gaining) {
    const muscle = `about ${Math.abs(leanChangeKg).toFixed(1)} kg of it muscle`;
    const fat =
      fatChangeKg > 0.3
        ? nextTakesItOff
          ? ` Around ${fatChangeKg.toFixed(1)} kg of fat comes with it — the next phase takes that back off.`
          : ` Around ${fatChangeKg.toFixed(1)} kg of fat comes with it, and nothing after this removes it.`
        : '';
    return `You gain about ${Math.abs(weightChangeKg).toFixed(1)} kg, ${muscle}.${fat}`;
  }

  if (losing) {
    const lean =
      leanChangeKg < -0.3
        ? ` Some of it — around ${Math.abs(leanChangeKg).toFixed(1)} kg — is lean tissue, which is why the training does not get easier here.`
        : ' Training holds on to the muscle while the fat comes off.';
    return `You lose about ${Math.abs(weightChangeKg).toFixed(1)} kg.${lean}`;
  }

  return 'Weight stays roughly where it is while training changes what it is made of. The scale is the wrong thing to watch in this phase.';
}

export type PhaseInput = {
  today: ISODate;
  sessions: WorkoutSession[];
  /** Weight now. Without it the per-phase projections stay null. */
  startWeightKg?: number | null;
  /** Body fat now, from a composition scale. Null is normal. */
  startBodyFatPercent?: number | null;
  /** The simulated route, when one is being followed. */
  simulation: RouteSimulation | null;
  /** Fallbacks when there is no route: the projection's own horizon. */
  fallback: {
    startsOn: ISODate;
    endsOn: ISODate | null;
    strategy: NutritionStrategy;
    totalWeightChangeKg: number;
    leanChangeKg: number;
    fatChangeKg: number;
    kcal: number;
  } | null;
};

/**
 * Phases from the route's own blocks where there is one, otherwise by cutting
 * the horizon into even stretches.
 *
 * A route already has meaningful divisions — build, then cut — and inventing
 * different ones on top would be worse than useless. It is only the single
 * long stretch that needs breaking up.
 */
export function buildPhases({
  today,
  sessions,
  simulation,
  fallback,
  startWeightKg = null,
  startBodyFatPercent = null,
}: PhaseInput): PlanPhaseView[] {
  const completed = sessions.filter((session) => session.status === 'completed');

  const countSessions = (from: ISODate, to: ISODate) =>
    completed.filter((session) => session.date >= from && session.date <= to).length;

  // Where the body is now. The simulation knows it when there is a route;
  // otherwise it has to be handed in, and without it the projections stay
  // null rather than counting up from an assumed weight.
  const originWeight = startWeightKg ?? simulation?.startWeightKg ?? null;
  let runningWeight = originWeight;
  let runningFatKg =
    originWeight !== null && startBodyFatPercent !== null
      ? (startBodyFatPercent / 100) * originWeight
      : null;

  const finish = (
    parts: Omit<
      PlanPhaseView,
      'state' | 'daysDone' | 'sessionsDone' | 'story' | 'endWeightKg' | 'endBodyFatPercent' | 'macros'
    >[],
  ): PlanPhaseView[] =>
    parts.map((part, index) => {
      const next = parts[index + 1]?.strategy ?? null;
      const elapsed = daysBetween(part.startsOn, today);

      // Carried forward phase by phase, so each one ends where the next
      // begins and the numbers down the column tell one continuous story.
      if (runningWeight !== null) runningWeight = round(runningWeight + part.weightChangeKg, 1);
      if (runningFatKg !== null) runningFatKg = Math.max(0, runningFatKg + part.fatChangeKg);

      // Planned around the weight you are at during the phase, not the weight
      // you finish it at: you eat this for the whole stretch, not on the last
      // day of it.
      const duringWeight = (runningWeight ?? 0) - part.weightChangeKg / 2;
      const protein = (strategyProfile(part.strategy).proteinGPerKg[0] + strategyProfile(part.strategy).proteinGPerKg[1]) / 2;

      return {
        ...part,
        endWeightKg: runningWeight,
        macros: calculateMacros(part.kcal, Math.max(1, duringWeight), protein),
        endBodyFatPercent:
          runningWeight !== null && runningFatKg !== null && runningWeight > 0
            ? round(clamp((runningFatKg / runningWeight) * 100, 2, 60), 1)
            : null,
        daysDone: Math.max(0, Math.min(part.days, elapsed)),
        sessionsDone: countSessions(part.startsOn, part.endsOn),
        story: storyFor(part.strategy, part.weightChangeKg, part.leanChangeKg, part.fatChangeKg, next),
        state: today > part.endsOn ? 'done' : today >= part.startsOn ? 'current' : 'ahead',
      };
    });

  if (simulation && simulation.blocks.length > 0) {
    const parts = simulation.blocks.flatMap((block, index) => {
      const days = daysBetween(block.startDate, block.endDate);
      const leanShare = splitChange(block.weightChangeKg, simulation, index);

      const base = {
        strategy: block.strategy,
        kcal: block.kcal,
      };

      // A very long single block still needs cutting up.
      const pieces = days > MIN_PHASE_DAYS * 6 ? Math.min(4, Math.round(days / 42)) : 1;
      if (pieces <= 1) {
        return [
          {
            ...base,
            index: 0,
            label: block.label,
            startsOn: block.startDate,
            endsOn: block.endDate,
            days,
            weightChangeKg: block.weightChangeKg,
            leanChangeKg: leanShare.lean,
            fatChangeKg: leanShare.fat,
          },
        ];
      }

      const pieceDays = Math.round(days / pieces);
      return Array.from({ length: pieces }, (_, piece) => {
        const startsOn = addDays(block.startDate, piece * pieceDays);
        const endsOn = piece === pieces - 1 ? block.endDate : addDays(startsOn, pieceDays - 1);
        return {
          ...base,
          index: 0,
          label: `${block.label} ${piece + 1}`,
          startsOn,
          endsOn,
          days: daysBetween(startsOn, endsOn),
          weightChangeKg: round(block.weightChangeKg / pieces, 2),
          leanChangeKg: round(leanShare.lean / pieces, 2),
          fatChangeKg: round(leanShare.fat / pieces, 2),
        };
      });
    });

    return finish(parts.map((part, index) => ({ ...part, index })));
  }

  if (!fallback || !fallback.endsOn) return [];

  const totalDays = daysBetween(fallback.startsOn, fallback.endsOn);
  if (totalDays < MIN_PHASE_DAYS) return [];

  const count = Math.max(2, Math.min(TARGET_PHASES, Math.floor(totalDays / MIN_PHASE_DAYS)));
  const phaseDays = Math.round(totalDays / count);

  const parts = Array.from({ length: count }, (_, index) => {
    const startsOn = addDays(fallback.startsOn, index * phaseDays);
    const endsOn = index === count - 1 ? (fallback.endsOn as ISODate) : addDays(startsOn, phaseDays - 1);

    return {
      index,
      label: `Phase ${index + 1}`,
      strategy: fallback.strategy,
      startsOn,
      endsOn,
      days: daysBetween(startsOn, endsOn),
      weightChangeKg: round(fallback.totalWeightChangeKg / count, 2),
      leanChangeKg: round(fallback.leanChangeKg / count, 2),
      fatChangeKg: round(fallback.fatChangeKg / count, 2),
      kcal: fallback.kcal,
    };
  });

  return finish(parts);
}

/**
 * Splits a block's weight change into lean and fat.
 *
 * The simulation already tracks both across the whole route; this apportions
 * them to a block by its share of the total movement, which is close enough
 * for a sentence and avoids re-running the week-by-week walk per block.
 */
function splitChange(
  blockChangeKg: number,
  simulation: RouteSimulation,
  index: number,
): { lean: number; fat: number } {
  const totalMovement = simulation.blocks.reduce((total, block) => total + Math.abs(block.weightChangeKg), 0);
  if (totalMovement === 0) return { lean: 0, fat: 0 };

  const share = Math.abs(blockChangeKg) / totalMovement;
  void index;

  return {
    lean: round(simulation.muscleGainKg * share * Math.sign(blockChangeKg || 1), 2),
    fat: round(simulation.fatChangeKg * share * Math.sign(blockChangeKg || 1), 2),
  };
}

/** Days between now and the target, and whether that is knowable. */
export function daysToTarget(today: ISODate, targetDate: ISODate | null): number | null {
  if (!targetDate) return null;
  return Math.max(0, daysBetween(today, targetDate));
}

/** Sessions logged in the last week, used for the "still moving" line. */
export function sessionsThisWeek(sessions: WorkoutSession[], today: ISODate): number {
  return sessions.filter(
    (session) => session.status === 'completed' && isWithinDays(session.date, today, 7),
  ).length;
}
