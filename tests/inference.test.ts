import { describe, expect, it } from 'vitest';

import {
  deriveObservations,
  inferAvoidedExercises,
  inferBestWeekday,
  inferDropOffRisk,
  inferMuscleEmphasis,
  inferRestSeconds,
  inferSessionLength,
  inferTrainingTime,
  inferTrainingWeekdays,
  observationCoverage,
} from '@/domain/inference/observations';
import { deriveProposals, deriveReminder } from '@/domain/inference/proposals';
import type { TrainingPreferences, UserPreferences, WorkoutSession } from '@/domain/types';

/** A completed session at a given local date and clock time. */
function session(
  date: string,
  time: string,
  options: {
    exercises?: { id: string; sets: number; completed?: number; substitutedFrom?: string }[];
    durationMinutes?: number;
    restSeconds?: number;
  } = {},
): WorkoutSession {
  const started = new Date(`${date}T${time}:00`);
  const { exercises = [{ id: 'barbell_bench_press', sets: 3 }], durationMinutes = 60, restSeconds = 120 } = options;

  let cursor = started.getTime();
  return {
    id: `s-${date}-${time}`,
    date,
    startedAt: started.toISOString(),
    endedAt: new Date(started.getTime() + durationMinutes * 60_000).toISOString(),
    name: 'Session',
    routineId: 'r1',
    routineDayId: 'd1',
    plannedSessionId: null,
    intent: 'full',
    status: 'completed',
    notes: null,
    pauses: [],
    exercises: exercises.map((entry, index) => ({
      id: `we-${index}`,
      exerciseId: entry.id,
      order: index,
      substitutedFrom: entry.substitutedFrom ?? null,
      note: null,
      skipped: false,
      sets: Array.from({ length: entry.sets }, (_, setIndex) => {
        const completed = setIndex < (entry.completed ?? entry.sets);
        cursor += restSeconds * 1000;
        return {
          id: `set-${index}-${setIndex}`,
          order: setIndex,
          weightKg: 60,
          reps: 8,
          rir: 2,
          warmup: false,
          completed,
          completedAt: completed ? new Date(cursor).toISOString() : null,
        };
      }),
    })),
  };
}

describe('when you train', () => {
  it('says nothing from fewer than three sessions', () => {
    expect(inferTrainingTime([session('2026-03-02', '18:00'), session('2026-03-04', '18:15')])).toBeNull();
    expect(inferTrainingWeekdays([session('2026-03-02', '18:00')])).toBeNull();
  });

  it('finds the hour you usually start', () => {
    const time = inferTrainingTime([
      session('2026-03-02', '18:00'),
      session('2026-03-04', '18:30'),
      session('2026-03-06', '18:15'),
      session('2026-03-09', '17:45'),
    ]);

    expect(time?.hour).toBe(18);
    expect(time?.minute).toBeLessThan(15);
    // A quarter of an hour either side is a real routine.
    expect(time?.spreadMinutes).toBeLessThan(45);
  });

  it('averages around the clock, not along a number line', () => {
    // 23:00 and 01:00 are two hours apart, not twenty-two.
    const time = inferTrainingTime([
      session('2026-03-02', '23:00'),
      session('2026-03-04', '23:30'),
      session('2026-03-06', '00:30'),
      session('2026-03-09', '01:00'),
    ]);

    expect(time?.hour).toBe(0);
    expect(time?.minute).toBeLessThan(10);
  });

  it('reports a wide spread when the time is all over the place', () => {
    const time = inferTrainingTime([
      session('2026-03-02', '07:00'),
      session('2026-03-04', '13:00'),
      session('2026-03-06', '19:00'),
      session('2026-03-09', '22:00'),
    ]);

    expect(time!.spreadMinutes).toBeGreaterThan(120);
  });

  it('finds the days you actually turn up on', () => {
    // Monday, Wednesday, Friday for three weeks, plus one stray Sunday.
    const sessions = [
      ...['2026-03-02', '2026-03-04', '2026-03-06'].map((date) => session(date, '18:00')),
      ...['2026-03-09', '2026-03-11', '2026-03-13'].map((date) => session(date, '18:00')),
      ...['2026-03-16', '2026-03-18', '2026-03-20'].map((date) => session(date, '18:00')),
      session('2026-03-22', '11:00'),
    ];

    const habit = inferTrainingWeekdays(sessions);
    expect(habit?.weekdays).toEqual([1, 3, 5]);
    expect(habit?.concentration).toBeGreaterThan(0.85);
  });

  it('measures the length and rest you actually use', () => {
    const sessions = [
      session('2026-03-02', '18:00', { durationMinutes: 75, restSeconds: 150 }),
      session('2026-03-04', '18:00', { durationMinutes: 80, restSeconds: 150 }),
      session('2026-03-06', '18:00', { durationMinutes: 70, restSeconds: 150 }),
    ];

    expect(inferSessionLength(sessions)).toBe(75);
    expect(inferRestSeconds(sessions)).toBe(150);
  });
});

describe('how the sessions go', () => {
  it('needs a real difference before calling a day your best', () => {
    // Every day identical: there is no best day.
    const sessions = ['2026-03-02', '2026-03-03', '2026-03-09', '2026-03-10', '2026-03-16', '2026-03-17', '2026-03-23', '2026-03-24'].map(
      (date) => session(date, '18:00'),
    );
    expect(inferBestWeekday(sessions)).toBeNull();
  });

  it('picks the day that is genuinely better', () => {
    const big = { exercises: [{ id: 'barbell_bench_press', sets: 8 }] };
    const small = { exercises: [{ id: 'barbell_bench_press', sets: 2 }] };
    const sessions = [
      session('2026-03-02', '18:00', big), // Monday
      session('2026-03-09', '18:00', big),
      session('2026-03-16', '18:00', big),
      session('2026-03-03', '18:00', small), // Tuesday
      session('2026-03-10', '18:00', small),
      session('2026-03-17', '18:00', small),
      session('2026-03-05', '18:00', small),
      session('2026-03-12', '18:00', small),
    ];

    expect(inferBestWeekday(sessions)?.weekday).toBe(1);
  });

  it('notices an exercise you keep swapping out', () => {
    const sessions = [
      session('2026-03-02', '18:00', {
        exercises: [{ id: 'hack_squat', sets: 3, substitutedFrom: 'back_squat' }],
      }),
      session('2026-03-04', '18:00', {
        exercises: [{ id: 'leg_press', sets: 3, substitutedFrom: 'back_squat' }],
      }),
    ];

    expect(inferAvoidedExercises(sessions)).toEqual([{ exerciseId: 'back_squat', times: 2 }]);
  });

  it('does not call a single swap a preference', () => {
    const sessions = [
      session('2026-03-02', '18:00', {
        exercises: [{ id: 'hack_squat', sets: 3, substitutedFrom: 'back_squat' }],
      }),
    ];
    expect(inferAvoidedExercises(sessions)).toEqual([]);
  });

  it('counts sets per muscle, secondaries at half', () => {
    const emphasis = inferMuscleEmphasis(
      [session('2026-03-20', '18:00', { exercises: [{ id: 'barbell_bench_press', sets: 4 }] })],
      '2026-03-22',
    );

    expect(emphasis.chest).toBe(4);
    // Bench is chest work that also loads triceps — but not as chest work does.
    expect(emphasis.triceps).toBe(2);
  });
});

describe('drifting away', () => {
  it('judges the gap against your own rhythm', () => {
    // Trains every two days; four days off is starting to be a gap.
    const frequent = ['2026-03-10', '2026-03-12', '2026-03-14', '2026-03-16'].map((date) =>
      session(date, '18:00'),
    );
    expect(inferDropOffRisk(frequent, '2026-03-20').level).toBe('watch');
    expect(inferDropOffRisk(frequent, '2026-03-17').level).toBe('none');

    // Trains weekly; the same four days is nothing.
    const weekly = ['2026-02-16', '2026-02-23', '2026-03-02', '2026-03-09'].map((date) =>
      session(date, '18:00'),
    );
    expect(inferDropOffRisk(weekly, '2026-03-13').level).toBe('none');
  });

  it('says nothing at all with no history', () => {
    expect(inferDropOffRisk([], '2026-03-20')).toEqual({
      level: 'none',
      daysSinceLast: null,
      usualGapDays: null,
    });
  });
});

describe('what the app does about it', () => {
  const training: TrainingPreferences = {
    minDaysPerWeek: 3,
    preferredDaysPerWeek: 4,
    sessionMinutes: 60,
    preferredWeekdays: [1, 2, 4, 5],
    location: 'gym',
    gymId: null,
    guided: true,
  };
  const preferences: UserPreferences = { units: 'metric', defaultRestSeconds: 90, weekStartsOn: 1 };

  const monWedFri = [
    ...['2026-03-02', '2026-03-04', '2026-03-06'],
    ...['2026-03-09', '2026-03-11', '2026-03-13'],
    ...['2026-03-16', '2026-03-18', '2026-03-20'],
  ].map((date) => session(date, '18:00', { durationMinutes: 85, restSeconds: 150 }));

  const observations = deriveObservations({
    sessions: monWedFri,
    routine: null,
    checkins: [],
    measurements: [],
    today: '2026-03-21',
  });

  it('offers to move the week to the days actually used', () => {
    const proposals = deriveProposals({ observations, training, preferences });
    const weekdays = proposals.find((entry) => entry.id === 'weekdays');

    expect(weekdays?.kind).toBe('ask');
    expect(weekdays?.change).toEqual({ type: 'training_weekdays', weekdays: [1, 3, 5] });
    // It always says what it is based on.
    expect(weekdays?.detail).toMatch(/9 sessions/);
  });

  it('corrects its own guesses without asking', () => {
    const proposals = deriveProposals({ observations, training, preferences });

    const minutes = proposals.find((entry) => entry.id === 'session_minutes');
    expect(minutes?.kind).toBe('auto');
    expect(minutes?.change).toEqual({ type: 'session_minutes', minutes: 85 });

    const rest = proposals.find((entry) => entry.id === 'rest_seconds');
    expect(rest?.kind).toBe('auto');
    expect(rest?.change).toEqual({ type: 'rest_seconds', seconds: 150 });
  });

  it('proposes nothing when its assumptions already match', () => {
    const matching: TrainingPreferences = { ...training, sessionMinutes: 85, preferredWeekdays: [1, 3, 5] };
    const proposals = deriveProposals({
      observations,
      training: matching,
      preferences: { ...preferences, defaultRestSeconds: 150 },
    });

    expect(proposals.filter((entry) => ['weekdays', 'session_minutes', 'rest_seconds'].includes(entry.id))).toEqual([]);
  });

  it('sets the nudge before the session, not during it', () => {
    const reminder = deriveReminder(observations);
    expect(reminder).toEqual({
      hour: 17,
      minute: 30,
      weekdays: [1, 3, 5],
      label: 'You usually train around 18:00',
    });
  });

  it('will not nudge someone with no fixed time', () => {
    const scattered = deriveObservations({
      sessions: [
        session('2026-03-02', '06:30'),
        session('2026-03-04', '12:00'),
        session('2026-03-06', '18:00'),
        session('2026-03-09', '21:30'),
        session('2026-03-11', '08:00'),
      ],
      routine: null,
      checkins: [],
      measurements: [],
      today: '2026-03-12',
    });

    expect(deriveReminder(scattered)).toBeNull();
  });
});

describe('how much the app knows', () => {
  it('starts at nothing and fills in', () => {
    const empty = deriveObservations({
      sessions: [],
      routine: null,
      checkins: [],
      measurements: [],
      today: '2026-03-21',
    });
    expect(observationCoverage(empty)).toBe(0);
    // Unknown items are kept in the list rather than hidden.
    expect(empty.list.length).toBeGreaterThan(5);
    expect(empty.list.every((entry) => entry.display === null)).toBe(true);

    const known = deriveObservations({
      sessions: [
        session('2026-03-02', '18:00'),
        session('2026-03-04', '18:00'),
        session('2026-03-06', '18:00'),
      ],
      routine: null,
      checkins: [],
      measurements: [],
      today: '2026-03-07',
    });
    expect(observationCoverage(known)).toBeGreaterThan(0);
  });
});
