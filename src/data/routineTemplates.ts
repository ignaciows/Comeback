import { trainingConfig } from '@/domain/config';
import type {
  GoalType,
  MuscleGroup,
  Routine,
  RoutineDay,
  RoutineExercise,
  TrainingLocation,
} from '@/domain/types';
import { getExercise } from './exercises';
import { createId } from '@/utils/id';
import { nowISO } from '@/utils/date';

type TemplateExercise = {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds?: number;
  /** Dropped first when the session has to fit in less time. */
  optional?: boolean;
};

type TemplateDay = {
  name: string;
  focus: MuscleGroup[];
  exercises: TemplateExercise[];
};

type Template = {
  id: string;
  name: string;
  daysPerWeek: number;
  days: TemplateDay[];
};

const COMPOUND_REST = 180;
const ACCESSORY_REST = 90;

const FULL_BODY: Template = {
  id: 'full_body_3',
  name: 'Full body',
  daysPerWeek: 3,
  days: [
    {
      name: 'Full body A',
      focus: ['quads', 'chest', 'back'],
      exercises: [
        { exerciseId: 'back_squat', sets: 3, repMin: 5, repMax: 8, restSeconds: COMPOUND_REST },
        { exerciseId: 'barbell_bench_press', sets: 3, repMin: 6, repMax: 8, restSeconds: COMPOUND_REST },
        { exerciseId: 'seated_cable_row', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'lateral_raise', sets: 2, repMin: 12, repMax: 15, optional: true },
        { exerciseId: 'plank', sets: 2, repMin: 1, repMax: 1, optional: true },
      ],
    },
    {
      name: 'Full body B',
      focus: ['hamstrings', 'back', 'shoulders'],
      exercises: [
        { exerciseId: 'romanian_deadlift', sets: 3, repMin: 6, repMax: 10, restSeconds: COMPOUND_REST },
        { exerciseId: 'lat_pulldown', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'dumbbell_shoulder_press', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'dumbbell_curl', sets: 2, repMin: 10, repMax: 15, optional: true },
        { exerciseId: 'standing_calf_raise', sets: 2, repMin: 10, repMax: 15, optional: true },
      ],
    },
    {
      name: 'Full body C',
      focus: ['quads', 'chest', 'core'],
      exercises: [
        { exerciseId: 'leg_press', sets: 3, repMin: 8, repMax: 12, restSeconds: COMPOUND_REST },
        { exerciseId: 'incline_dumbbell_press', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'dumbbell_row', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'triceps_pushdown', sets: 2, repMin: 10, repMax: 15, optional: true },
        { exerciseId: 'cable_crunch', sets: 2, repMin: 12, repMax: 15, optional: true },
      ],
    },
  ],
};

const UPPER_LOWER: Template = {
  id: 'upper_lower_4',
  name: 'Upper / Lower',
  daysPerWeek: 4,
  days: [
    {
      name: 'Upper A',
      focus: ['chest', 'back', 'shoulders'],
      exercises: [
        { exerciseId: 'barbell_bench_press', sets: 4, repMin: 5, repMax: 8, restSeconds: COMPOUND_REST },
        { exerciseId: 'barbell_row', sets: 4, repMin: 6, repMax: 10, restSeconds: COMPOUND_REST },
        { exerciseId: 'dumbbell_shoulder_press', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'lat_pulldown', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'triceps_pushdown', sets: 2, repMin: 10, repMax: 15, optional: true },
        { exerciseId: 'dumbbell_curl', sets: 2, repMin: 10, repMax: 15, optional: true },
      ],
    },
    {
      name: 'Lower A',
      focus: ['quads', 'glutes', 'hamstrings'],
      exercises: [
        { exerciseId: 'back_squat', sets: 4, repMin: 5, repMax: 8, restSeconds: COMPOUND_REST },
        { exerciseId: 'romanian_deadlift', sets: 3, repMin: 6, repMax: 10, restSeconds: COMPOUND_REST },
        { exerciseId: 'leg_press', sets: 3, repMin: 10, repMax: 14 },
        { exerciseId: 'seated_leg_curl', sets: 3, repMin: 10, repMax: 15, optional: true },
        { exerciseId: 'standing_calf_raise', sets: 3, repMin: 10, repMax: 15, optional: true },
      ],
    },
    {
      name: 'Upper B',
      focus: ['chest', 'back', 'shoulders'],
      exercises: [
        { exerciseId: 'incline_dumbbell_press', sets: 4, repMin: 8, repMax: 12 },
        { exerciseId: 'pull_up', sets: 4, repMin: 5, repMax: 10, restSeconds: COMPOUND_REST },
        { exerciseId: 'seated_cable_row', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'lateral_raise', sets: 3, repMin: 12, repMax: 15 },
        { exerciseId: 'overhead_triceps_extension', sets: 2, repMin: 10, repMax: 15, optional: true },
        { exerciseId: 'cable_curl', sets: 2, repMin: 10, repMax: 15, optional: true },
      ],
    },
    {
      name: 'Lower B',
      focus: ['hamstrings', 'glutes', 'quads'],
      exercises: [
        { exerciseId: 'deadlift', sets: 3, repMin: 3, repMax: 6, restSeconds: COMPOUND_REST },
        { exerciseId: 'bulgarian_split_squat', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'leg_extension', sets: 3, repMin: 10, repMax: 15 },
        { exerciseId: 'hip_thrust', sets: 3, repMin: 8, repMax: 12, optional: true },
        { exerciseId: 'seated_calf_raise', sets: 3, repMin: 10, repMax: 15, optional: true },
      ],
    },
  ],
};

const UPPER_LOWER_PPL: Template = {
  id: 'upper_lower_ppl_5',
  name: 'Upper / Lower / Push / Pull / Legs',
  daysPerWeek: 5,
  days: [
    UPPER_LOWER.days[0],
    UPPER_LOWER.days[1],
    {
      name: 'Push',
      focus: ['chest', 'shoulders', 'triceps'],
      exercises: [
        { exerciseId: 'overhead_press', sets: 4, repMin: 5, repMax: 8, restSeconds: COMPOUND_REST },
        { exerciseId: 'dumbbell_bench_press', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'cable_fly', sets: 3, repMin: 12, repMax: 15 },
        { exerciseId: 'lateral_raise', sets: 3, repMin: 12, repMax: 15 },
        { exerciseId: 'triceps_pushdown', sets: 3, repMin: 10, repMax: 15, optional: true },
      ],
    },
    {
      name: 'Pull',
      focus: ['back', 'biceps'],
      exercises: [
        { exerciseId: 'pull_up', sets: 4, repMin: 5, repMax: 10, restSeconds: COMPOUND_REST },
        { exerciseId: 'chest_supported_row', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'face_pull', sets: 3, repMin: 12, repMax: 15 },
        { exerciseId: 'barbell_curl', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'hanging_leg_raise', sets: 2, repMin: 8, repMax: 12, optional: true },
      ],
    },
    {
      name: 'Legs',
      focus: ['quads', 'hamstrings', 'glutes'],
      exercises: [
        { exerciseId: 'front_squat', sets: 4, repMin: 5, repMax: 8, restSeconds: COMPOUND_REST },
        { exerciseId: 'romanian_deadlift', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'walking_lunge', sets: 3, repMin: 10, repMax: 12 },
        { exerciseId: 'lying_leg_curl', sets: 3, repMin: 10, repMax: 15 },
        { exerciseId: 'standing_calf_raise', sets: 3, repMin: 10, repMax: 15, optional: true },
      ],
    },
  ],
};

const PPL_6: Template = {
  id: 'ppl_6',
  name: 'Push / Pull / Legs ×2',
  daysPerWeek: 6,
  days: [
    UPPER_LOWER_PPL.days[2],
    UPPER_LOWER_PPL.days[3],
    UPPER_LOWER_PPL.days[4],
    {
      name: 'Push B',
      focus: ['chest', 'shoulders', 'triceps'],
      exercises: [
        { exerciseId: 'barbell_bench_press', sets: 4, repMin: 5, repMax: 8, restSeconds: COMPOUND_REST },
        { exerciseId: 'shoulder_press_machine', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'pec_deck', sets: 3, repMin: 12, repMax: 15 },
        { exerciseId: 'cable_lateral_raise', sets: 3, repMin: 12, repMax: 15 },
        { exerciseId: 'dip', sets: 3, repMin: 6, repMax: 12, optional: true },
      ],
    },
    {
      name: 'Pull B',
      focus: ['back', 'biceps'],
      exercises: [
        { exerciseId: 'barbell_row', sets: 4, repMin: 6, repMax: 10, restSeconds: COMPOUND_REST },
        { exerciseId: 'lat_pulldown', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'rear_delt_fly', sets: 3, repMin: 12, repMax: 15 },
        { exerciseId: 'dumbbell_curl', sets: 3, repMin: 10, repMax: 15 },
        { exerciseId: 'cable_crunch', sets: 2, repMin: 12, repMax: 15, optional: true },
      ],
    },
    {
      name: 'Legs B',
      focus: ['quads', 'hamstrings', 'glutes'],
      exercises: [
        { exerciseId: 'hack_squat', sets: 4, repMin: 8, repMax: 12, restSeconds: COMPOUND_REST },
        { exerciseId: 'hip_thrust', sets: 3, repMin: 8, repMax: 12 },
        { exerciseId: 'leg_extension', sets: 3, repMin: 12, repMax: 15 },
        { exerciseId: 'seated_leg_curl', sets: 3, repMin: 12, repMax: 15 },
        { exerciseId: 'seated_calf_raise', sets: 3, repMin: 10, repMax: 15, optional: true },
      ],
    },
  ],
};

const TEMPLATES = [FULL_BODY, UPPER_LOWER, UPPER_LOWER_PPL, PPL_6];

/** Equipment a home setup is assumed to have unless the user says otherwise. */
const HOME_EQUIPMENT = new Set(['bodyweight', 'dumbbell', 'kettlebell', 'band', 'bench']);

function fitsLocation(exerciseId: string, location: TrainingLocation): boolean {
  if (location === 'gym') return true;
  const exercise = getExercise(exerciseId);
  if (!exercise) return false;
  return exercise.equipment.every((item) => HOME_EQUIPMENT.has(item));
}

/** Swaps an exercise for the first alternative that fits the location. */
function adaptToLocation(exerciseId: string, location: TrainingLocation): string | null {
  if (fitsLocation(exerciseId, location)) return exerciseId;
  const exercise = getExercise(exerciseId);
  if (!exercise) return null;
  return exercise.alternatives.find((id) => fitsLocation(id, location)) ?? null;
}

function pickTemplate(daysPerWeek: number): Template {
  return (
    TEMPLATES.find((template) => template.daysPerWeek === daysPerWeek) ??
    TEMPLATES.reduce((closest, template) =>
      Math.abs(template.daysPerWeek - daysPerWeek) < Math.abs(closest.daysPerWeek - daysPerWeek)
        ? template
        : closest,
    )
  );
}

/**
 * Rough time cost of a day, used to trim optional work so the session fits the
 * time the user actually has.
 */
function estimateMinutes(exercises: TemplateExercise[]): number {
  return Math.round(
    exercises.reduce((total, exercise) => {
      const rest = exercise.restSeconds ?? ACCESSORY_REST;
      return total + (exercise.sets * (rest + 40)) / 60;
    }, 6),
  );
}

export function estimateRoutineDayMinutes(day: RoutineDay): number {
  return Math.round(
    day.exercises.reduce(
      (total, exercise) => total + (exercise.sets * (exercise.restSeconds + 40)) / 60,
      6,
    ),
  );
}

export type PlanRequest = {
  daysPerWeek: number;
  sessionMinutes: number;
  location: TrainingLocation;
  goalType: GoalType;
  /** Long layoffs start with less volume. */
  layoffWeeks: number;
};

/**
 * Builds the user's starting routine. Deterministic and editable afterwards —
 * this is a starting point, not a prescription the app defends.
 */
export function buildInitialRoutine(request: PlanRequest): Routine {
  const template = pickTemplate(request.daysPerWeek);
  const timestamp = nowISO();
  // Coming back from a long layoff: start on the low end of the set ranges.
  const detrained = request.layoffWeeks >= 8;
  const strengthBias = request.goalType === 'build_strength';

  const days: RoutineDay[] = template.days.map((day, dayIndex) => {
    let exercises = day.exercises
      .map((exercise) => ({ ...exercise, exerciseId: adaptToLocation(exercise.exerciseId, request.location) }))
      .filter((exercise): exercise is TemplateExercise => exercise.exerciseId !== null);

    // Trim optional work until the day fits the available time.
    while (estimateMinutes(exercises) > request.sessionMinutes && exercises.some((item) => item.optional)) {
      const lastOptional = [...exercises].reverse().find((item) => item.optional);
      exercises = exercises.filter((item) => item !== lastOptional);
    }

    const routineExercises: RoutineExercise[] = exercises.map((exercise, index) => {
      const sets = Math.max(2, detrained ? exercise.sets - 1 : exercise.sets);
      const shift = strengthBias && getExercise(exercise.exerciseId)?.isCompound ? -2 : 0;
      return {
        id: createId(),
        exerciseId: exercise.exerciseId,
        order: index,
        sets,
        repMin: Math.max(3, exercise.repMin + shift),
        repMax: Math.max(5, exercise.repMax + shift),
        restSeconds: exercise.restSeconds ?? trainingConfig.defaultRestSeconds,
      };
    });

    return {
      id: createId(),
      order: dayIndex,
      name: day.name,
      focus: day.focus,
      exercises: routineExercises,
    };
  });

  return {
    id: createId(),
    name: template.name,
    daysPerWeek: template.daysPerWeek,
    days,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

/**
 * The routine for the two calibration weeks.
 *
 * Three full-body days built from the five basic patterns, and nothing else.
 * Everything the plan later derives — starting loads, how long a session takes
 * you, whether you hit the days you said you would — comes out of these lifts,
 * and an accessory nobody has a baseline for teaches the app nothing it can
 * use. Sets are deliberately low: this fortnight is a measurement, and a
 * measurement taken while exhausted measures fatigue.
 *
 * Each pattern lands twice a week across the three days, so by the end there
 * are two data points per lift rather than one to build a two-year plan on.
 */
export function buildCalibrationRoutine(location: TrainingLocation): Routine {
  const timestamp = nowISO();

  const plan: { name: string; focus: MuscleGroup[]; lifts: string[] }[] = [
    { name: 'Calibration A', focus: ['quads', 'chest', 'back'], lifts: ['back_squat', 'barbell_bench_press', 'barbell_row'] },
    { name: 'Calibration B', focus: ['hamstrings', 'shoulders', 'back'], lifts: ['deadlift', 'overhead_press', 'barbell_row'] },
    { name: 'Calibration C', focus: ['quads', 'chest', 'shoulders'], lifts: ['back_squat', 'barbell_bench_press', 'overhead_press'] },
  ];

  const days: RoutineDay[] = plan.map((day, dayIndex) => ({
    id: createId(),
    order: dayIndex,
    name: day.name,
    focus: day.focus,
    exercises: day.lifts
      .map((exerciseId) => adaptToLocation(exerciseId, location))
      .filter((exerciseId): exerciseId is string => exerciseId !== null)
      .map((exerciseId, index): RoutineExercise => ({
        id: createId(),
        exerciseId,
        order: index,
        // Three sets is enough to find a working load and not enough to bury
        // anyone in week one.
        sets: 3,
        repMin: 5,
        repMax: 8,
        restSeconds: trainingConfig.defaultRestSeconds,
      })),
  }));

  return {
    id: createId(),
    name: 'Calibration',
    daysPerWeek: 3,
    days,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  };
}

/** A short, honest description of what the first two weeks should achieve. */
export function firstBlockObjective(request: PlanRequest): string {
  if (request.layoffWeeks >= 8) {
    return 'Rebuild the habit and re-establish loads. Leave 2–3 reps in reserve on every set for the first two weeks.';
  }
  if (request.goalType === 'build_strength') {
    return 'Re-anchor your main lifts. Add load only when every set hits the top of its rep range.';
  }
  if (request.goalType === 'lose_fat') {
    return 'Hold your loads and keep frequency high. The goal for two weeks is attendance, not records.';
  }
  return 'Establish a baseline on every main lift and hit your weekly frequency twice in a row.';
}
