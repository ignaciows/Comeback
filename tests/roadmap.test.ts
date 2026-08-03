import { describe, expect, it } from 'vitest';

import {
  MAX_SNAPSHOTS,
  differencesFrom,
  previousPlan,
  pushSnapshot,
  revertSuggestion,
  type PlanSnapshot,
} from '@/domain/plan/history';
import type { PlanPhaseView } from '@/domain/plan/phases';
import { buildRoadmap, trainingFor } from '@/domain/plan/roadmap';
import type { WorkoutSession } from '@/domain/types';

const phase = (patch: Partial<PlanPhaseView> = {}): PlanPhaseView => ({
  index: 0,
  label: 'Build',
  strategy: 'lean_bulk',
  endWeightKg: null,
  endBodyFatPercent: null,
  macros: { kcal: 2600, proteinG: 150, fatG: 72, carbsG: 325 },
  startsOn: '2026-08-01',
  endsOn: '2026-09-12',
  days: 42,
  daysDone: 0,
  sessionsDone: 0,
  weightChangeKg: 2,
  leanChangeKg: 1.4,
  fatChangeKg: 0.6,
  kcal: 2900,
  story: '',
  state: 'ahead',
  ...patch,
});

describe('the road, stop by stop', () => {
  it('gives every phase its own macros', () => {
    const road = buildRoadmap({ phases: [phase()], currentWeightKg: 80, proteinGPerKg: 1.8 });

    expect(road[0].macros.kcal).toBe(2900);
    expect(road[0].macros.proteinG).toBe(Math.round(80 * 1.8));
    // The four numbers have to add back up to the calories they came from.
    const { proteinG, fatG, carbsG, kcal } = road[0].macros;
    expect(proteinG * 4 + fatG * 9 + carbsG * 4).toBeCloseTo(kcal, -2);
  });

  it('plans each phase around the weight you will be at, not the weight you are', () => {
    // Protein scales with body weight. Quoting today's number for month five
    // is quoting the wrong body.
    const road = buildRoadmap({
      phases: [phase({ weightChangeKg: 4 }), phase({ index: 1, strategy: 'cut', kcal: 2200 })],
      currentWeightKg: 80,
      proteinGPerKg: 2,
    });

    expect(road[0].macros.proteinG).toBe(160);
    // Second phase is planned around 84 kg, not 80.
    expect(road[1].macros.proteinG).toBe(168);
  });

  it('numbers the weeks continuously across phases', () => {
    const road = buildRoadmap({
      phases: [phase({ days: 42 }), phase({ index: 1, days: 28 })],
      currentWeightKg: 80,
      proteinGPerKg: 1.8,
    });

    expect(road[0].span).toBe('Weeks 1–6');
    expect(road[1].fromWeek).toBe(7);
    expect(road[1].span).toBe('Weeks 7–10');
  });

  it('says how the eating changes, but only when it really changes', () => {
    const big = buildRoadmap({
      phases: [phase({ kcal: 2900 }), phase({ index: 1, strategy: 'cut', kcal: 2200 })],
      currentWeightKg: 80,
      proteinGPerKg: 1.8,
    });
    expect(big[0].changeFromPrevious).toBeNull();
    expect(big[1].changeFromPrevious).toMatch(/-700 kcal/);

    const drift = buildRoadmap({
      phases: [phase({ kcal: 2900 }), phase({ index: 1, kcal: 2940 })],
      currentWeightKg: 80,
      proteinGPerKg: 1.8,
    });
    // Forty calories is arithmetic, not an instruction.
    expect(drift[1].changeFromPrevious).toBeNull();
  });

  it('trains differently depending on what the phase is for', () => {
    // Chasing volume in a deficit is the classic way to lose muscle dieting.
    expect(trainingFor('lean_bulk').emphasis).toBe('build');
    expect(trainingFor('cut').emphasis).toBe('preserve');
    expect(trainingFor('maintain').emphasis).toBe('maintain');
    expect(trainingFor('cut').detail).toMatch(/fewer sets/i);
  });
});

// ---------------------------------------------------------------------------

const snapshot = (patch: Partial<PlanSnapshot> = {}): PlanSnapshot => ({
  id: 's1',
  takenOn: '2026-07-01',
  at: '2026-07-01T10:00:00.000Z',
  reason: 'Went from steady to fast',
  goal: {
    objective: 'recomp',
    speed: 'steady',
    strategy: 'lean_bulk',
    fatTolerance: 'some',
    targetWeightKg: 80,
    horizonWeeks: 16,
    muscleFocus: [],
  },
  training: { preferredDaysPerWeek: 4, preferredWeekdays: [1, 2, 4, 5], sessionMinutes: 60 },
  planRoute: null,
  ...patch,
});

const session = (date: string): WorkoutSession =>
  ({ id: date, date, status: 'completed' }) as WorkoutSession;

describe('going back to the plan you were on', () => {
  it('keeps the most recent plan as the one to return to', () => {
    const history = pushSnapshot(pushSnapshot([], snapshot({ id: 'a' })), snapshot({ id: 'b' }));

    expect(previousPlan(history)?.id).toBe('b');
    expect(previousPlan([])).toBeNull();
  });

  it('drops the oldest rather than growing forever', () => {
    let history: PlanSnapshot[] = [];
    for (let index = 0; index < MAX_SNAPSHOTS + 4; index += 1) {
      history = pushSnapshot(history, snapshot({ id: `s${index}` }));
    }

    expect(history).toHaveLength(MAX_SNAPSHOTS);
    expect(history[0].id).toBe('s4');
  });

  it('spells out what would actually change, field by field', () => {
    const differences = differencesFrom(snapshot(), {
      goal: { ...snapshot().goal, speed: 'fast', targetWeightKg: 84 },
      training: { ...snapshot().training, preferredDaysPerWeek: 5 },
    });

    const labels = differences.map((entry) => entry.label);
    expect(labels).toContain('Pace');
    expect(labels).toContain('Target weight');
    expect(labels).toContain('Days a week');
    // Untouched fields are not listed as changes.
    expect(labels).not.toContain('Objective');
    expect(labels).not.toContain('Horizon');

    const pace = differences.find((entry) => entry.label === 'Pace');
    expect(pace).toEqual({ label: 'Pace', from: 'Fast', to: 'Steady' });
  });

  it('lists nothing when the plans are the same', () => {
    expect(differencesFrom(snapshot(), { goal: snapshot().goal, training: snapshot().training })).toEqual([]);
  });
});

describe('noticing that a new plan is not sticking', () => {
  const trainedTwiceAWeekBefore = [
    '2026-06-08', '2026-06-11', '2026-06-15', '2026-06-18',
    '2026-06-22', '2026-06-25', '2026-06-29',
  ].map(session);

  it('offers the old plan when training fell off after the change', () => {
    const suggestion = revertSuggestion(
      [snapshot({ takenOn: '2026-07-01' })],
      [...trainedTwiceAWeekBefore, session('2026-07-05')],
      '2026-07-25',
    );

    expect(suggestion).not.toBeNull();
    expect(suggestion!.afterRate).toBeLessThan(suggestion!.beforeRate);
    expect(suggestion!.detail).toMatch(/still here/i);
  });

  it('stays quiet while the change is too new to judge', () => {
    expect(
      revertSuggestion([snapshot({ takenOn: '2026-07-01' })], trainedTwiceAWeekBefore, '2026-07-05'),
    ).toBeNull();
  });

  it('stays quiet when the new plan is being followed', () => {
    const kept = ['2026-07-02', '2026-07-05', '2026-07-09', '2026-07-12', '2026-07-16', '2026-07-19', '2026-07-23'];

    expect(
      revertSuggestion(
        [snapshot({ takenOn: '2026-07-01' })],
        [...trainedTwiceAWeekBefore, ...kept.map(session)],
        '2026-07-25',
      ),
    ).toBeNull();
  });

  it('does not blame the change when there was nothing before it', () => {
    // Someone who never trained before the change is not told the change is why.
    expect(revertSuggestion([snapshot({ takenOn: '2026-07-01' })], [], '2026-07-25')).toBeNull();
  });

  it('has nothing to suggest with no history', () => {
    expect(revertSuggestion([], trainedTwiceAWeekBefore, '2026-07-25')).toBeNull();
  });
});
