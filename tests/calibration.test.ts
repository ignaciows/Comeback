import { describe, expect, it } from 'vitest';

import {
  CALIBRATION_DAYS,
  CALIBRATION_LIFTS,
  CALIBRATION_ROUTE_ID,
  calibrationReadout,
  calibrationWindow,
  isCalibrationRoute,
  withCalibration,
} from '@/domain/plan/calibration';
import { getRoute } from '@/domain/plan/routes';
import type { WorkoutSession } from '@/domain/types';

const session = (
  date: string,
  exerciseIds: string[],
  options: { minutes?: number; completed?: boolean } = {},
): WorkoutSession => ({
  id: `session-${date}-${exerciseIds[0] ?? 'none'}`,
  date,
  startedAt: `${date}T10:00:00.000Z`,
  endedAt: `${date}T${10 + Math.floor((options.minutes ?? 60) / 60)}:${String((options.minutes ?? 60) % 60).padStart(2, '0')}:00.000Z`,
  name: 'Calibration',
  routineId: null,
  routineDayId: null,
  plannedSessionId: null,
  intent: 'full',
  status: options.completed === false ? 'active' : 'completed',
  notes: null,
  pauses: [],
  exercises: exerciseIds.map((exerciseId, index) => ({
    id: `ex-${date}-${index}`,
    exerciseId,
    order: index,
    substitutedFrom: null,
    note: null,
    skipped: false,
    sets: [
      {
        id: `set-${date}-${index}`,
        order: 0,
        weightKg: 60,
        reps: 8,
        rir: 2,
        warmup: false,
        completed: true,
        completedAt: `${date}T10:20:00.000Z`,
      },
    ],
  })),
});

describe('the two-week calibration window', () => {
  it('counts the fortnight from the day it started', () => {
    const window = calibrationWindow('2026-03-01', '2026-03-01');

    expect(window.dayNumber).toBe(1);
    expect(window.daysLeft).toBe(CALIBRATION_DAYS);
    expect(window.endsOn).toBe('2026-03-15');
    expect(window.complete).toBe(false);
  });

  it('is complete on the fourteenth day, not the fifteenth', () => {
    expect(calibrationWindow('2026-03-01', '2026-03-15').complete).toBe(true);
    expect(calibrationWindow('2026-03-01', '2026-03-14').complete).toBe(false);
  });

  it('does not run past the end when the app is opened a month later', () => {
    const window = calibrationWindow('2026-03-01', '2026-05-01');

    expect(window.progress).toBe(1);
    expect(window.daysLeft).toBe(0);
    expect(window.dayNumber).toBe(CALIBRATION_DAYS);
  });
});

describe('putting calibration in front of a chosen route', () => {
  it('keeps the chosen route intact behind it', () => {
    // What the user picked has to still be what they get — two weeks later
    // and built on measurements, not quietly replaced.
    const chosen = getRoute('lean_bulk_then_short_cut')!;
    const combined = withCalibration(chosen);

    expect(combined.id).toBe(CALIBRATION_ROUTE_ID);
    expect(combined.blocks).toHaveLength(chosen.blocks.length + 1);
    expect(combined.blocks.slice(1)).toEqual(chosen.blocks);
  });

  it('calibrates at maintenance, so the baseline is not moving while it is taken', () => {
    const combined = withCalibration(getRoute('bulk_then_cut')!);

    expect(combined.blocks[0].strategy).toBe('maintain');
    expect(combined.blocks[0].weeks).toBe(2);
    expect(combined.blocks[0].label).toBe('Calibration');
  });

  it('recognises its own route id and nothing else', () => {
    expect(isCalibrationRoute(CALIBRATION_ROUTE_ID)).toBe(true);
    expect(isCalibrationRoute('bulk_then_cut')).toBe(false);
    expect(isCalibrationRoute(null)).toBe(false);
  });
});

describe('what the fortnight established', () => {
  const window = calibrationWindow('2026-03-01', '2026-03-15');

  it('reports which basic lifts now have a real number behind them', () => {
    const readout = calibrationReadout(
      [
        session('2026-03-02', ['back_squat', 'barbell_bench_press']),
        session('2026-03-04', ['deadlift', 'barbell_row']),
      ],
      window,
    );

    expect(readout.liftsMeasured).toEqual([
      'back_squat',
      'barbell_bench_press',
      'barbell_row',
      'deadlift',
    ]);
    expect(readout.liftsRemaining).toEqual(['overhead_press']);
  });

  it('will not rebuild a two-year plan on two sessions', () => {
    // Waiting fourteen days and then guessing anyway is the same confident
    // guessing this whole phase exists to avoid — it would just have taken a
    // fortnight to do it.
    const thin = calibrationReadout(
      [session('2026-03-02', ['back_squat']), session('2026-03-05', ['deadlift'])],
      window,
    );

    expect(thin.enoughToRebuild).toBe(false);
  });

  it('rebuilds once there are enough sessions across enough patterns', () => {
    const readout = calibrationReadout(
      [
        session('2026-03-02', ['back_squat', 'barbell_bench_press']),
        session('2026-03-04', ['deadlift', 'barbell_row']),
        session('2026-03-06', ['overhead_press']),
        session('2026-03-09', ['back_squat']),
      ],
      window,
    );

    expect(readout.sessionsDone).toBe(4);
    expect(readout.enoughToRebuild).toBe(true);
  });

  it('ignores sessions outside the window and ones never finished', () => {
    const readout = calibrationReadout(
      [
        session('2026-02-20', ['back_squat', 'deadlift']),
        session('2026-04-01', ['barbell_row', 'overhead_press']),
        session('2026-03-03', ['barbell_bench_press'], { completed: false }),
      ],
      window,
    );

    expect(readout.sessionsDone).toBe(0);
    expect(readout.liftsMeasured).toEqual([]);
    expect(readout.enoughToRebuild).toBe(false);
  });

  it('measures how long a session really takes, pauses aside', () => {
    const readout = calibrationReadout(
      [
        session('2026-03-02', ['back_squat'], { minutes: 50 }),
        session('2026-03-04', ['deadlift'], { minutes: 70 }),
        session('2026-03-06', ['overhead_press'], { minutes: 60 }),
      ],
      window,
    );

    expect(readout.medianSessionMinutes).toBe(60);
  });

  it('has a median of nothing before anything has been done', () => {
    const readout = calibrationReadout([], window);

    expect(readout.medianSessionMinutes).toBeNull();
    expect(readout.sessionsExpected).toBe(6);
  });

  it('only measures the basic patterns, not whatever else was in the session', () => {
    const readout = calibrationReadout([session('2026-03-02', ['cable_curl', 'lateral_raise'])], window);

    expect(readout.liftsMeasured).toEqual([]);
    expect(readout.liftsRemaining).toEqual([...CALIBRATION_LIFTS]);
  });
});
