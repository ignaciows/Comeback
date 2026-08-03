import { describe, expect, it } from 'vitest';

import { ceilingProgress, compareRoutes, routeOutlook } from '@/domain/plan/outlook';
import { ROUTES, simulateAllRoutes, simulateRoute, type RouteInput } from '@/domain/plan/routes';

const me: RouteInput = {
  today: '2026-01-01',
  currentWeightKg: 77,
  heightCm: 186,
  age: 30,
  sex: 'male',
  experience: 'beginner',
  bodyFatPercent: 18,
  sessionsPerWeek: 4,
};

describe('what each plan actually gets you', () => {
  it('tells the story in dates a person already thinks in', () => {
    const twoYears = routeOutlook(simulateRoute(me, ROUTES.find((r) => r.id === 'two_years')!), 'build');

    // Three months, six months, a year, and the end — a summer and a winter.
    expect(twoYears.milestones.map((stop) => stop.away)).toEqual(['3 meses', '6 meses', '1 año', '2 años']);
    expect(twoYears.milestones[0].date).toBe('2026-04-02');
  });

  it('counts muscle from today, not lean mass you already had', () => {
    const outlook = routeOutlook(simulateRoute(me, ROUTES.find((r) => r.id === 'year_of_building')!), 'build');
    expect(outlook.milestones[0].muscleKg).toBeGreaterThan(0);
    // It only ever goes up across the stops.
    const muscle = outlook.milestones.map((stop) => stop.muscleKg);
    for (let i = 1; i < muscle.length; i += 1) expect(muscle[i]).toBeGreaterThanOrEqual(muscle[i - 1]);
  });

  it('states the price in gym sessions, not only the prize', () => {
    const outlook = routeOutlook(simulateRoute(me, ROUTES.find((r) => r.id === 'two_years')!), 'build');
    expect(outlook.sessionsPerWeek).toBeGreaterThan(0);
    expect(outlook.totalSessions).toBeGreaterThan(200);
    expect(outlook.musclePerHundredSessions).toBeGreaterThan(0);
  });

  it('names a different winner per category rather than one overall', () => {
    const comparison = compareRoutes(simulateAllRoutes(me).map((sim) => routeOutlook(sim, 'build')));

    expect(comparison.mostMuscle).not.toBeNull();
    expect(comparison.leanest).not.toBeNull();
    expect(comparison.quickest).not.toBeNull();

    // The one that builds most is not the one that stays leanest — that
    // disagreement is the information, and collapsing it into a single
    // "best plan" would hide the trade rather than show it.
    expect(comparison.mostMuscle!.routeId).not.toBe(comparison.quickest!.routeId);
  });

  it('does not call the plan that builds nothing the quickest', () => {
    const comparison = compareRoutes(simulateAllRoutes(me).map((sim) => routeOutlook(sim, 'build')));
    const top = comparison.mostMuscle!.muscleKg;
    expect(comparison.quickest!.muscleKg).toBeGreaterThanOrEqual(top * 0.5);
  });

  it('shows the ceiling filling up rather than a rate that never changes', () => {
    const early = ceilingProgress({ builtKg: 2, planKg: 8, lifetimeKg: 20 });
    expect(early.builtShare).toBe(0.1);
    expect(early.planShare).toBe(0.4);
    expect(early.remainingKg).toBe(10);

    // A plan promising more than is left gets clamped, not believed.
    const greedy = ceilingProgress({ builtKg: 18, planKg: 9, lifetimeKg: 20 });
    expect(greedy.planShare).toBe(0.1);
    expect(greedy.remainingKg).toBe(0);
  });
});
