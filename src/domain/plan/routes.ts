import type {
  BiologicalSex,
  ExperienceLevel,
  ISODate,
  NutritionStrategy,
  PlanObjective,
} from '@/domain/types';
import { addDays } from '@/utils/date';
import { clamp, round } from '@/utils/math';
import { calculateMacros } from './simulate';
import { maintenanceCalories, monthlyMuscleGainPotential, strategyProfile } from './strategies';

/**
 * Routes: plans made of blocks.
 *
 * A single strategy answers "what do I do now". A route answers the question
 * people actually ask — *how do I get there* — because getting lean and muscular
 * is usually two phases, not one. Bulk for three months then diet it off is a
 * different journey from gaining slowly for eight, and both end in a similar
 * place. This simulates each one week by week so the difference is visible
 * rather than argued about.
 *
 * The whole thing is deterministic: same inputs, same curve.
 */

export type PlanBlock = {
  strategy: NutritionStrategy;
  weeks: number;
  /** What this block is for, in the user's language. */
  label: string;
};

export type PlanRoute = {
  id: string;
  name: string;
  /** One line: what this route does. */
  summary: string;
  /** Who it suits; shown next to the recommendation. */
  bestFor: string;
  blocks: PlanBlock[];
};

export const ROUTES: PlanRoute[] = [
  {
    id: 'bulk_then_cut',
    name: 'Build first, then cut',
    summary: 'Three months adding size, then two months taking the fat back off.',
    bestFor: 'Already fairly lean and want visible size as fast as it is worth doing.',
    blocks: [
      { strategy: 'bulk', weeks: 12, label: 'Build' },
      { strategy: 'cut', weeks: 8, label: 'Cut' },
    ],
  },
  {
    id: 'lean_bulk_then_short_cut',
    name: 'Lean build, short cut',
    summary: 'Four months gaining slowly, then six weeks to sharpen up.',
    bestFor: 'You want size without ever getting far from lean.',
    blocks: [
      { strategy: 'lean_bulk', weeks: 16, label: 'Lean build' },
      { strategy: 'lean_cut', weeks: 6, label: 'Sharpen' },
    ],
  },
  {
    id: 'lean_bulk_straight',
    name: 'Lean build, no cut',
    summary: 'Gain slowly and stay lean the whole way. Takes the longest.',
    bestFor: 'You never want to look worse than you do today.',
    blocks: [{ strategy: 'lean_bulk', weeks: 32, label: 'Lean build' }],
  },
  {
    id: 'cut_then_build',
    name: 'Cut first, then build',
    summary: 'Take the fat off first, then spend four months building on a lean base.',
    bestFor: 'Carrying enough fat that gaining now would mostly add more.',
    blocks: [
      { strategy: 'cut', weeks: 10, label: 'Cut' },
      { strategy: 'lean_bulk', weeks: 16, label: 'Build' },
    ],
  },
  {
    id: 'recomp',
    name: 'Recomposition',
    summary: 'Hold your weight and let training change what it is made of.',
    bestFor: 'Returning to training, where muscle comes back without a surplus.',
    blocks: [{ strategy: 'maintain', weeks: 20, label: 'Recomp' }],
  },
];

export type RoutePoint = {
  week: number;
  date: ISODate;
  weightKg: number;
  leanKg: number;
  fatKg: number;
  /** Null when the starting body fat is unknown. */
  bodyFatPercent: number | null;
  blockIndex: number;
};

export type BlockSummary = {
  index: number;
  label: string;
  strategy: NutritionStrategy;
  strategyLabel: string;
  weeks: number;
  startWeek: number;
  endWeek: number;
  startDate: ISODate;
  endDate: ISODate;
  kcal: number;
  proteinG: number;
  weightChangeKg: number;
};

export type RouteSimulation = {
  route: PlanRoute;
  points: RoutePoint[];
  blocks: BlockSummary[];
  totalWeeks: number;
  endDate: ISODate;
  startWeightKg: number;
  endWeightKg: number;
  /** Muscle added across the whole route. */
  muscleGainKg: number;
  fatChangeKg: number;
  endBodyFatPercent: number | null;
  /** Highest body fat reached on the way, when it can be computed. */
  peakBodyFatPercent: number | null;
};

export type RouteInput = {
  today: ISODate;
  currentWeightKg: number;
  heightCm: number;
  age: number;
  sex: BiologicalSex;
  experience: ExperienceLevel;
  /** From a body-composition scale, when there is one. */
  bodyFatPercent: number | null;
  sessionsPerWeek: number;
};

/**
 * Walks the route one week at a time.
 *
 * Lean gain is capped by what training can actually build in that week; a
 * surplus beyond it becomes fat rather than more muscle. That cap is the whole
 * reason a faster bulk does not get you there sooner, and simulating weekly is
 * what makes it show up in the curve.
 */
export function simulateRoute(input: RouteInput, route: PlanRoute): RouteSimulation {
  const startWeight = input.currentWeightKg;
  let weight = startWeight;
  let fatMass = input.bodyFatPercent === null ? 0 : (input.bodyFatPercent / 100) * weight;
  let leanMass = input.bodyFatPercent === null ? 0 : weight - fatMass;
  let muscleGain = 0;
  let fatChange = 0;

  const points: RoutePoint[] = [
    {
      week: 0,
      date: input.today,
      weightKg: round(weight, 1),
      leanKg: round(leanMass, 1),
      fatKg: round(fatMass, 1),
      bodyFatPercent: input.bodyFatPercent === null ? null : round(input.bodyFatPercent, 1),
      blockIndex: 0,
    },
  ];

  const blocks: BlockSummary[] = [];
  let week = 0;

  route.blocks.forEach((block, blockIndex) => {
    const profile = strategyProfile(block.strategy);
    const blockStartWeek = week;
    const blockStartWeight = weight;

    for (let index = 0; index < block.weeks; index += 1) {
      week += 1;
      const change = weight * profile.weeklyWeightChangePct;

      let leanChange: number;
      let fatChangeThisWeek: number;

      if (change > 0) {
        const weeklyMuscleCeiling =
          ((weight * monthlyMuscleGainPotential(input.experience)) / 4.345) * profile.hypertrophyRate;
        leanChange = Math.min(change * profile.qualityRatio, weeklyMuscleCeiling);
        fatChangeThisWeek = change - leanChange;
      } else if (change < 0) {
        // On a deficit `qualityRatio` is the share of the loss coming from fat.
        fatChangeThisWeek = change * profile.qualityRatio;
        leanChange = change - fatChangeThisWeek;
      } else {
        // Maintenance: recomposition. Muscle is built and fat is lost from the
        // same scale weight, which is why the curve is flat but the split moves.
        const weeklyMuscleCeiling =
          ((weight * monthlyMuscleGainPotential(input.experience)) / 4.345) *
          profile.hypertrophyRate *
          0.5;
        leanChange = weeklyMuscleCeiling;
        fatChangeThisWeek = -weeklyMuscleCeiling;
      }

      weight += change;
      leanMass += leanChange;
      fatMass += fatChangeThisWeek;
      if (leanChange > 0) muscleGain += leanChange;
      fatChange += fatChangeThisWeek;

      points.push({
        week,
        date: addDays(input.today, week * 7),
        weightKg: round(weight, 1),
        leanKg: round(leanMass, 1),
        fatKg: round(fatMass, 1),
        bodyFatPercent:
          input.bodyFatPercent === null ? null : round(clamp((fatMass / weight) * 100, 2, 60), 1),
        blockIndex,
      });
    }

    const maintenance = maintenanceCalories({
      weightKg: round(weight, 1),
      heightCm: input.heightCm,
      age: input.age,
      sex: input.sex,
      sessionsPerWeek: input.sessionsPerWeek,
    });
    const kcal = Math.round(maintenance * (1 + profile.energyBalancePct));
    const macros = calculateMacros(
      kcal,
      weight,
      (profile.proteinGPerKg[0] + profile.proteinGPerKg[1]) / 2,
    );

    blocks.push({
      index: blockIndex,
      label: block.label,
      strategy: block.strategy,
      strategyLabel: profile.label,
      weeks: block.weeks,
      startWeek: blockStartWeek,
      endWeek: week,
      startDate: addDays(input.today, blockStartWeek * 7),
      endDate: addDays(input.today, week * 7),
      kcal,
      proteinG: macros.proteinG,
      weightChangeKg: round(weight - blockStartWeight, 1),
    });
  });

  const bodyFatSeries = points
    .map((point) => point.bodyFatPercent)
    .filter((value): value is number => value !== null);

  return {
    route,
    points,
    blocks,
    totalWeeks: week,
    endDate: addDays(input.today, week * 7),
    startWeightKg: round(startWeight, 1),
    endWeightKg: round(weight, 1),
    muscleGainKg: round(muscleGain, 1),
    fatChangeKg: round(fatChange, 1),
    endBodyFatPercent: points[points.length - 1]?.bodyFatPercent ?? null,
    peakBodyFatPercent: bodyFatSeries.length > 0 ? round(Math.max(...bodyFatSeries), 1) : null,
  };
}

export function simulateAllRoutes(input: RouteInput): RouteSimulation[] {
  return ROUTES.map((route) => simulateRoute(input, route));
}

export type RouteRecommendation = {
  routeId: string;
  reason: string;
};

/**
 * Which route to take.
 *
 * The deciding factor is how much fat you are carrying now: above roughly 20 %
 * a surplus mostly adds more fat and partitioning is worse, so cutting first
 * wins; below about 12 % there is room to build before it starts to show. In
 * between, it comes down to whether you mind looking softer for a few months.
 */
export function recommendRoute(input: RouteInput, objective: PlanObjective): RouteRecommendation {
  const bodyFat = input.bodyFatPercent;

  if (objective === 'lean') {
    return {
      routeId: 'cut_then_build',
      reason: 'You want to lean out, so the fat comes off first. Building afterwards on a lean base is where the surplus works best.',
    };
  }

  if (objective === 'recomp' || input.experience === 'returning' || input.experience === 'beginner') {
    return {
      routeId: 'recomp',
      reason:
        'Coming back to training, muscle returns without a surplus. Holding your weight lets the composition change on its own before you commit to a direction.',
    };
  }

  if (bodyFat !== null && bodyFat >= 20) {
    return {
      routeId: 'cut_then_build',
      reason: `At about ${Math.round(bodyFat)} % body fat, a surplus mostly adds more fat. Taking it down first makes the building phase far more productive.`,
    };
  }

  if (bodyFat !== null && bodyFat <= 12) {
    return {
      routeId: 'bulk_then_cut',
      reason: `At about ${Math.round(bodyFat)} % body fat you have room to build before it shows. Three months of real gaining then a short diet is the quickest way to look noticeably bigger.`,
    };
  }

  return {
    routeId: 'lean_bulk_then_short_cut',
    reason:
      'Gaining slowly and finishing with a short cut gets you most of the size without ever being far from lean. It is the safest choice when you are somewhere in the middle.',
  };
}

/** Which block of a route you are in, given when it started. */
export function currentBlock(route: PlanRoute, weeksElapsed: number): { index: number; block: PlanBlock; weeksIntoBlock: number } | null {
  let cursor = 0;
  for (let index = 0; index < route.blocks.length; index += 1) {
    const block = route.blocks[index];
    if (weeksElapsed < cursor + block.weeks) {
      return { index, block, weeksIntoBlock: weeksElapsed - cursor };
    }
    cursor += block.weeks;
  }
  return null;
}

export function getRoute(id: string): PlanRoute | undefined {
  return ROUTES.find((route) => route.id === id);
}
