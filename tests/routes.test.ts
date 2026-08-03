import { describe, expect, it } from 'vitest';

import {
  MAX_ROUTE_WEEKS,
  ROUTES,
  currentBlock,
  getRoute,
  recommendRoute,
  simulateAllRoutes,
  simulateRoute,
  type RouteInput,
} from '@/domain/plan/routes';
import { daysBetween } from '@/utils/date';
import { TODAY } from './helpers';

const input: RouteInput = {
  today: TODAY,
  currentWeightKg: 77.25,
  heightCm: 186,
  age: 30,
  sex: 'male',
  experience: 'intermediate',
  bodyFatPercent: 15,
  sessionsPerWeek: 5,
};

describe('plan routes', () => {
  it('walks every route week by week from the same starting point', () => {
    for (const simulation of simulateAllRoutes(input)) {
      expect(simulation.points[0].weightKg).toBe(77.3);
      expect(simulation.points).toHaveLength(simulation.totalWeeks + 1);
      expect(daysBetween(TODAY, simulation.endDate)).toBe(simulation.totalWeeks * 7);
    }
  });

  it('goes up then down on a build-then-cut route', () => {
    const simulation = simulateRoute(input, getRoute('bulk_then_cut')!);
    const peak = Math.max(...simulation.points.map((point) => point.weightKg));

    expect(simulation.blocks).toHaveLength(2);
    expect(simulation.blocks[0].weightChangeKg).toBeGreaterThan(0);
    expect(simulation.blocks[1].weightChangeKg).toBeLessThan(0);
    expect(peak).toBeGreaterThan(simulation.endWeightKg);
  });

  it('caps muscle gain by what training can build, so the surplus spills into fat', () => {
    const aggressive = simulateRoute(input, getRoute('bulk_then_cut')!);
    const slow = simulateRoute(input, getRoute('lean_bulk_straight')!);

    // The fast route gains more weight per week but not proportionally more muscle.
    const aggressiveBuild = aggressive.blocks[0];
    expect(aggressiveBuild.weightChangeKg).toBeGreaterThan(0);
    expect(aggressive.muscleGainKg).toBeGreaterThan(0);
    expect(slow.muscleGainKg).toBeGreaterThan(0);
    // Gaining twice as fast does not build twice the muscle.
    const aggressiveRate = aggressive.muscleGainKg / aggressive.totalWeeks;
    const slowRate = slow.muscleGainKg / slow.totalWeeks;
    expect(aggressiveRate).toBeLessThan(slowRate * 1.6);
  });

  it('ends leaner than it peaks when the route finishes on a cut', () => {
    const simulation = simulateRoute(input, getRoute('bulk_then_cut')!);
    expect(simulation.peakBodyFatPercent).not.toBeNull();
    expect(simulation.endBodyFatPercent as number).toBeLessThan(simulation.peakBodyFatPercent as number);
  });

  it('moves composition without moving the scale on a recomp', () => {
    const simulation = simulateRoute(input, getRoute('recomp')!);
    expect(simulation.endWeightKg).toBeCloseTo(simulation.startWeightKg, 1);
    expect(simulation.muscleGainKg).toBeGreaterThan(0);
    expect(simulation.fatChangeKg).toBeLessThan(0);
  });

  it('reports composition only when the starting body fat is known', () => {
    const blind = simulateRoute({ ...input, bodyFatPercent: null }, getRoute('bulk_then_cut')!);
    expect(blind.endBodyFatPercent).toBeNull();
    expect(blind.points.every((point) => point.bodyFatPercent === null)).toBe(true);
    // The weight curve still works.
    expect(blind.endWeightKg).toBeGreaterThan(0);
  });

  it('takes longer the leaner you insist on staying', () => {
    const fast = simulateRoute(input, getRoute('bulk_then_cut')!);
    const slow = simulateRoute(input, getRoute('lean_bulk_straight')!);
    expect(slow.totalWeeks).toBeGreaterThan(fast.totalWeeks);
  });

  it('gives every block calories and a protein target', () => {
    for (const simulation of simulateAllRoutes(input)) {
      for (const block of simulation.blocks) {
        expect(block.kcal).toBeGreaterThan(1200);
        expect(block.proteinG).toBeGreaterThan(100);
        expect(block.endWeek).toBeGreaterThan(block.startWeek);
      }
    }
  });
});

describe('route recommendation', () => {
  it('cuts first when there is enough fat that a surplus would mostly add more', () => {
    const result = recommendRoute({ ...input, bodyFatPercent: 24, experience: 'intermediate' }, 'build');
    expect(result.routeId).toBe('cut_then_build');
    expect(result.reason).toMatch(/24 %/);
  });

  it('builds first when already lean', () => {
    const result = recommendRoute({ ...input, bodyFatPercent: 10, experience: 'intermediate' }, 'build');
    expect(result.routeId).toBe('bulk_then_cut');
  });

  it('splits the difference in the middle', () => {
    const result = recommendRoute({ ...input, bodyFatPercent: 16, experience: 'intermediate' }, 'build');
    expect(result.routeId).toBe('lean_bulk_then_short_cut');
  });

  it('recommends recomposition to someone coming back', () => {
    const result = recommendRoute({ ...input, experience: 'returning' }, 'build');
    expect(result.routeId).toBe('recomp');
    expect(result.reason).toMatch(/without a surplus/i);
  });

  it('always names a route that exists', () => {
    for (const bodyFat of [null, 8, 15, 22, 30]) {
      for (const objective of ['build', 'lean', 'recomp'] as const) {
        const result = recommendRoute({ ...input, bodyFatPercent: bodyFat }, objective);
        expect(ROUTES.some((route) => route.id === result.routeId)).toBe(true);
      }
    }
  });
});

describe('block progression', () => {
  it('knows which block you are in', () => {
    // Read off the route rather than hardcoded, so lengthening a block does
    // not turn this into a test of the old numbers.
    const route = getRoute('bulk_then_cut')!;
    const [first, second] = route.blocks;
    const total = first.weeks + second.weeks;

    expect(currentBlock(route, 0)?.index).toBe(0);
    expect(currentBlock(route, first.weeks - 1)?.index).toBe(0);
    expect(currentBlock(route, first.weeks)?.index).toBe(1);
    expect(currentBlock(route, total - 1)?.index).toBe(1);
    // Past the end of the route.
    expect(currentBlock(route, total)).toBeNull();
  });

  it('counts how far into a block you are', () => {
    const route = getRoute('bulk_then_cut')!;
    const position = currentBlock(route, route.blocks[0].weeks + 2);
    expect(position?.weeksIntoBlock).toBe(2);
    expect(position?.block.strategy).toBe('cut');
  });

  it('never offers a plan that ends before it starts working', () => {
    // Visible change takes roughly nine weeks of consistent training. A plan
    // that finishes at twelve is over the moment it begins to work.
    for (const route of ROUTES) {
      const weeks = route.blocks.reduce((total, block) => total + block.weeks, 0);
      expect(weeks, route.id).toBeGreaterThanOrEqual(20);
    }
  });
});

describe('plans that run for years', () => {
  const beginner = {
    today: '2026-01-01' as const,
    currentWeightKg: 77,
    heightCm: 186,
    age: 30,
    sex: 'male' as const,
    experience: 'beginner' as const,
    bodyFatPercent: 18,
    sessionsPerWeek: 4,
  };

  it('offers something longer than half a year', () => {
    const longest = Math.max(
      ...ROUTES.map((route) => route.blocks.reduce((total, block) => total + block.weeks, 0)),
    );
    expect(longest).toBeGreaterThanOrEqual(104);
    expect(longest).toBeLessThanOrEqual(MAX_ROUTE_WEEKS);
  });

  // Simulated at the starting rate the whole way, two years of beginner gains
  // comes out at roughly twice what anyone actually gains in two years. The
  // ceiling has to fall as the plan spends the training age it is built on.
  it('does not pay beginner gains for two years', () => {
    const route = getRoute('two_years')!;
    const sim = simulateRoute(beginner, route);

    expect(sim.totalWeeks).toBe(104);
    expect(sim.muscleGainKg).toBeGreaterThan(4);
    expect(sim.muscleGainKg).toBeLessThan(14);

    // The second year has to build less than the first, or the decay is not
    // doing anything.
    const yearOne = sim.points.find((point) => point.week === 52)!;
    const yearTwo = sim.points[sim.points.length - 1];
    expect(yearTwo.leanKg - yearOne.leanKg).toBeLessThan(yearOne.leanKg - sim.points[0].leanKg);
  });

  it('starts an advanced lifter where a beginner ends up', () => {
    const route = getRoute('two_years')!;
    const green = simulateRoute(beginner, route);
    const seasoned = simulateRoute({ ...beginner, experience: 'advanced' }, route);
    expect(seasoned.muscleGainKg).toBeLessThan(green.muscleGainKg);
  });
});
