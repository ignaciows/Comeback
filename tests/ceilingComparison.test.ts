import { describe, expect, it } from 'vitest';

import { compareAgainstCeiling } from '@/domain/plan/ceilingComparison';
import { CEILING_ROUTE_ID, ceilingRoute, planToCeiling } from '@/domain/plan/fatCeiling';
import { simulateRoute, type RouteInput } from '@/domain/plan/routes';
import type { ExperienceLevel } from '@/domain/types';

const input = (patch: Partial<RouteInput> = {}): RouteInput => ({
  today: '2026-01-05',
  currentWeightKg: 82,
  heightCm: 185,
  age: 30,
  sex: 'male',
  experience: 'intermediate',
  bodyFatPercent: 18.7,
  sessionsPerWeek: 4,
  ...patch,
});

describe('the ceiling plan measured by the route simulator', () => {
  /**
   * The one that matters. The ceiling plan is drawn next to the named routes
   * and run through the same simulator they are; if that simulator says it
   * crosses the line, the whole promise is a lie told in a nicer font.
   */
  it('never crosses its own ceiling under the simulator that draws it', () => {
    for (const experience of ['beginner', 'returning', 'intermediate', 'advanced'] as ExperienceLevel[]) {
      for (const bodyFat of [10, 14, 18.7, 24]) {
        for (const ceiling of [12, 15, 17, 20, 25]) {
          const routeInput = input({ experience, bodyFatPercent: bodyFat });
          const route = ceilingRoute({
            weightKg: routeInput.currentWeightKg,
            bodyFatPercent: bodyFat,
            ceilingPercent: ceiling,
            buildStrategy: 'lean_bulk',
            cutStrategy: 'cut',
            experience,
            horizonWeeks: 32,
          });
          if (route.blocks.length === 0) continue;

          const simulation = simulateRoute(routeInput, route);
          const peak = simulation.peakBodyFatPercent ?? 0;
          // Starting above the ceiling, week zero is over the line by
          // definition; what must never happen is going *up* from there.
          const allowed = Math.max(ceiling, bodyFat);

          expect(
            peak,
            `${experience} at ${bodyFat} % with a ${ceiling} % ceiling peaked at ${peak} %`,
          ).toBeLessThanOrEqual(allowed + 0.15);
        }
      }
    }
  });

  it('agrees with the plan it came from about where the blocks end', () => {
    // Two models of the same body would let the preview and the comparison
    // disagree on screen. They are the same arithmetic, so they must not.
    const routeInput = input({ experience: 'advanced', bodyFatPercent: 12 });
    const args = {
      weightKg: routeInput.currentWeightKg,
      bodyFatPercent: 12,
      ceilingPercent: 17,
      buildStrategy: 'lean_bulk' as const,
      cutStrategy: 'cut' as const,
      experience: 'advanced' as const,
      horizonWeeks: 32,
    };

    const plan = planToCeiling(args);
    const simulation = simulateRoute(routeInput, ceilingRoute(args));
    const planEnd = plan.blocks[plan.blocks.length - 1];

    expect(simulation.endWeightKg).toBeCloseTo(planEnd.endWeightKg, 0);
    expect(simulation.endBodyFatPercent).toBeCloseTo(planEnd.endFatPercent, 0);
  });
});

describe('comparing the ceiling plan with the alternatives', () => {
  it('names the trade against the rival that builds the most while crossing', () => {
    const comparison = compareAgainstCeiling(input(), 17);

    expect(comparison).not.toBeNull();
    expect(comparison!.ours.crosses).toBe(false);
    expect(comparison!.others.some((other) => other.crosses)).toBe(true);
    expect(comparison!.trade).toMatch(/17 % limit/);
    expect(comparison!.trade).toMatch(/never crosses it/);
  });

  it('says nothing about a trade when the limit costs nothing', () => {
    // Very lean, with a ceiling nothing on the menu reaches. Inventing a
    // sacrifice here would be selling the feature rather than explaining it.
    const comparison = compareAgainstCeiling(input({ bodyFatPercent: 8 }), 30);

    expect(comparison).not.toBeNull();
    expect(comparison!.others.every((other) => !other.crosses)).toBe(true);
    expect(comparison!.trade).toBeNull();
  });

  it('ranks the alternatives by how far past the line they go', () => {
    const comparison = compareAgainstCeiling(input(), 15);
    const overshoots = comparison!.others.map((other) => other.overshoot);

    expect(overshoots).toEqual([...overshoots].sort((a, b) => b - a));
    expect(comparison!.others).toHaveLength(5);
  });

  it('declines to compare when body fat is unknown', () => {
    // Every number here is a body-fat number. Without a starting point the
    // comparison would be confidently wrong, which is worse than absent.
    expect(compareAgainstCeiling(input({ bodyFatPercent: null }), 17)).toBeNull();
  });

  it('carries the ceiling route under its own id, not as a custom plan', () => {
    const comparison = compareAgainstCeiling(input(), 17);

    expect(comparison!.simulation.route.id).toBe(CEILING_ROUTE_ID);
    expect(comparison!.ours.routeId).toBe(CEILING_ROUTE_ID);
  });
});
