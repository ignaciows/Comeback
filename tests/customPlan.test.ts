import { describe, expect, it } from 'vitest';

import {
  BLOCK_LIMITS,
  MAX_TOTAL_WEEKS,
  clampBlockWeeks,
  defaultCustomBlocks,
  limitsFor,
  planIsSavable,
  reviewPlan,
  toRoute,
  totalWeeks,
} from '@/domain/plan/customPlan';
import { simulateRoute, type RouteInput } from '@/domain/plan/routes';
import { buildJournal, summariseJournal } from '@/domain/journal';
import type { PlannedSession, WorkoutSession } from '@/domain/types';

const input: RouteInput = {
  today: '2026-04-01',
  currentWeightKg: 77.25,
  heightCm: 186,
  age: 30,
  sex: 'male',
  experience: 'returning',
  bodyFatPercent: 16,
  sessionsPerWeek: 4,
};

describe('dragging a block around', () => {
  it('will not let a gaining block be shorter than it takes to gain anything', () => {
    const limit = limitsFor('bulk');
    expect(clampBlockWeeks('bulk', 1)).toBe(limit.min);
    expect(clampBlockWeeks('bulk', 0)).toBe(limit.min);
    expect(limit.min).toBeGreaterThanOrEqual(4);
  });

  it('holds a block inside its own ceiling', () => {
    expect(clampBlockWeeks('aggressive_cut', 40)).toBe(BLOCK_LIMITS.aggressive_cut.max);
    expect(clampBlockWeeks('lean_bulk', 100)).toBe(BLOCK_LIMITS.lean_bulk.max);
  });

  it('leaves room for the blocks already there', () => {
    // 46 weeks used elsewhere leaves 6 of the year.
    expect(clampBlockWeeks('cut', 20, 46)).toBe(6);
    // But never below what makes the block worth running.
    expect(clampBlockWeeks('cut', 20, 51)).toBe(BLOCK_LIMITS.cut.min);
  });

  it('rounds to whole weeks, since half a week is not a training block', () => {
    expect(clampBlockWeeks('cut', 8.4)).toBe(8);
    expect(clampBlockWeeks('cut', 8.6)).toBe(9);
  });
});

describe('reviewing a hand-built plan', () => {
  const simulate = (blocks = defaultCustomBlocks()) => simulateRoute(input, toRoute(blocks));

  it('accepts a sensible plan', () => {
    const blocks = defaultCustomBlocks();
    const notes = reviewPlan(blocks, simulate(blocks));
    expect(planIsSavable(notes)).toBe(true);
  });

  it('blocks an empty plan', () => {
    const notes = reviewPlan([], null);
    expect(planIsSavable(notes)).toBe(false);
  });

  it('blocks a plan longer than it can honestly project', () => {
    const blocks = [
      { id: 'a', strategy: 'lean_bulk' as const, weeks: 24 },
      { id: 'b', strategy: 'lean_cut' as const, weeks: 20 },
      { id: 'c', strategy: 'maintain' as const, weeks: 16 },
    ];
    expect(totalWeeks(blocks)).toBeGreaterThan(MAX_TOTAL_WEEKS);

    const notes = reviewPlan(blocks, null);
    expect(planIsSavable(notes)).toBe(false);
    expect(notes.some((note) => note.id === 'too_long')).toBe(true);
  });

  it('blocks a block too short to do anything', () => {
    const blocks = [{ id: 'a', strategy: 'bulk' as const, weeks: 1 }];
    const notes = reviewPlan(blocks, null);

    expect(planIsSavable(notes)).toBe(false);
    expect(notes.some((note) => note.id === 'short_a')).toBe(true);
  });

  it('points out that two gaining blocks in a row are one gaining block', () => {
    const blocks = [
      { id: 'a', strategy: 'bulk' as const, weeks: 8 },
      { id: 'b', strategy: 'lean_bulk' as const, weeks: 8 },
    ];
    const notes = reviewPlan(blocks, null);

    expect(notes.some((note) => note.id === 'same_b')).toBe(true);
    // Worth saying, not worth refusing.
    expect(planIsSavable(notes)).toBe(true);
  });

  it('answers "can I gain 15 kg of muscle" with what the simulation actually gives', () => {
    // The longest, hardest bulk the builder allows.
    const blocks = [{ id: 'a', strategy: 'bulk' as const, weeks: 20 }];
    const simulation = simulate(blocks);
    const gained = simulation.endWeightKg - simulation.startWeightKg;

    // The plan is allowed — it is simply honest about what it produces.
    expect(planIsSavable(reviewPlan(blocks, simulation))).toBe(true);
    // Training caps what can be muscle, so the rest arrives as fat.
    expect(simulation.muscleGainKg).toBeLessThan(gained);
    expect(reviewPlan(blocks, simulation).some((note) => note.id === 'mostly_fat')).toBe(true);
  });

  it('warns before letting you bulk into the fat you will have to cut off', () => {
    const blocks = [{ id: 'a', strategy: 'bulk' as const, weeks: 20 }];
    const simulation = simulate(blocks);

    if ((simulation.peakBodyFatPercent ?? 0) >= 22) {
      expect(reviewPlan(blocks, simulation).some((note) => note.id === 'peak_bf')).toBe(true);
    }
  });

  it('runs a hand-built plan through the same simulator as the named ones', () => {
    const blocks = defaultCustomBlocks();
    const simulation = simulate(blocks);

    expect(simulation.blocks).toHaveLength(2);
    expect(simulation.totalWeeks).toBe(totalWeeks(blocks));
    expect(simulation.points.length).toBeGreaterThan(0);
  });
});

describe('the journal', () => {
  const session = (date: string): WorkoutSession => ({
    id: date,
    date,
    startedAt: `${date}T18:00:00.000Z`,
    endedAt: `${date}T19:00:00.000Z`,
    name: 'Session',
    routineId: null,
    routineDayId: null,
    plannedSessionId: null,
    intent: 'full',
    status: 'completed',
    notes: null,
    exercises: [],
  });

  const planned = (date: string, status: PlannedSession['status'] = 'planned'): PlannedSession => ({
    id: date,
    date,
    routineId: null,
    routineDayId: null,
    status,
    sessionId: null,
    rescheduledToDate: null,
    createdAt: '',
    updatedAt: '',
  });

  it('marks a day you trained', () => {
    const days = buildJournal({
      today: '2026-04-05',
      days: 7,
      sessions: [session('2026-04-03')],
      plannedSessions: [],
      checkins: [],
      measurements: [],
    });

    expect(days.find((day) => day.date === '2026-04-03')?.state).toBe('trained');
    expect(days.find((day) => day.date === '2026-04-05')?.state).toBe('today');
  });

  it('does not call an unplanned quiet day a failure', () => {
    const days = buildJournal({
      today: '2026-04-05',
      days: 7,
      sessions: [],
      plannedSessions: [],
      checkins: [],
      measurements: [],
    });

    expect(days.filter((day) => day.state === 'missed')).toHaveLength(0);
    expect(days.filter((day) => day.state === 'rest').length).toBeGreaterThan(0);
  });

  it('calls a planned day that did not happen missed', () => {
    const days = buildJournal({
      today: '2026-04-05',
      days: 7,
      sessions: [],
      plannedSessions: [planned('2026-04-02')],
      checkins: [],
      measurements: [],
    });

    expect(days.find((day) => day.date === '2026-04-02')?.state).toBe('missed');
  });

  it('does not punish a session that was moved rather than dropped', () => {
    const days = buildJournal({
      today: '2026-04-05',
      days: 7,
      sessions: [],
      plannedSessions: [planned('2026-04-02', 'rescheduled')],
      checkins: [],
      measurements: [],
    });

    expect(days.find((day) => day.date === '2026-04-02')?.state).not.toBe('missed');
  });

  it('counts a day where you logged something without training', () => {
    const days = buildJournal({
      today: '2026-04-05',
      days: 7,
      sessions: [],
      plannedSessions: [],
      checkins: [],
      measurements: [
        { id: 'w', date: '2026-04-04', weightKg: 77, bodyFatPercent: null, source: 'manual', createdAt: '' },
      ],
    });

    expect(days.find((day) => day.date === '2026-04-04')?.state).toBe('logged');
  });

  it('measures the longest run, not the current one', () => {
    const summary = summariseJournal(
      buildJournal({
        today: '2026-04-10',
        days: 10,
        sessions: ['2026-04-02', '2026-04-03', '2026-04-04', '2026-04-07'].map(session),
        plannedSessions: [planned('2026-04-05')],
        checkins: [],
        measurements: [],
      }),
    );

    expect(summary.trained).toBe(4);
    expect(summary.streak).toBe(3);
    expect(summary.missed).toBe(1);
  });
});
