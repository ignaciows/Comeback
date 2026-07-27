import type { Exercise, EquipmentId, MovementPattern, MuscleGroup } from '@/domain/types';

/**
 * Canonical exercise library. `id` is the stable, language-independent key —
 * names are display labels and can be localised later without touching data.
 * `alternatives` are ordered best-first and drive the substitution flow.
 */
export const EXERCISES: Exercise[] = [
  // ---------- Horizontal push ----------
  {
    id: 'barbell_bench_press',
    name: 'Barbell bench press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    pattern: 'horizontal_push',
    equipment: ['barbell', 'bench', 'rack'],
    difficulty: 2,
    isCompound: true,
    alternatives: ['dumbbell_bench_press', 'chest_press_machine', 'push_up'],
  },
  {
    id: 'dumbbell_bench_press',
    name: 'Dumbbell bench press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    pattern: 'horizontal_push',
    equipment: ['dumbbell', 'bench'],
    difficulty: 2,
    isCompound: true,
    alternatives: ['barbell_bench_press', 'chest_press_machine', 'push_up'],
  },
  {
    id: 'incline_dumbbell_press',
    name: 'Incline dumbbell press',
    primaryMuscle: 'chest',
    secondaryMuscles: ['shoulders', 'triceps'],
    pattern: 'horizontal_push',
    equipment: ['dumbbell', 'bench'],
    difficulty: 2,
    isCompound: true,
    alternatives: ['barbell_bench_press', 'chest_press_machine'],
  },
  {
    id: 'chest_press_machine',
    name: 'Chest press machine',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps'],
    pattern: 'horizontal_push',
    equipment: ['machine'],
    difficulty: 1,
    isCompound: true,
    alternatives: ['dumbbell_bench_press', 'push_up'],
  },
  {
    id: 'push_up',
    name: 'Push-up',
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'core'],
    pattern: 'horizontal_push',
    equipment: ['bodyweight'],
    difficulty: 1,
    isCompound: true,
    alternatives: ['dumbbell_bench_press', 'chest_press_machine'],
  },
  {
    id: 'cable_fly',
    name: 'Cable fly',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['cable'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['dumbbell_fly', 'pec_deck'],
  },
  {
    id: 'dumbbell_fly',
    name: 'Dumbbell fly',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['dumbbell', 'bench'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['cable_fly', 'pec_deck'],
  },
  {
    id: 'pec_deck',
    name: 'Pec deck',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['machine'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['cable_fly', 'dumbbell_fly'],
  },

  // ---------- Vertical push ----------
  {
    id: 'overhead_press',
    name: 'Overhead press',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['triceps', 'core'],
    pattern: 'vertical_push',
    equipment: ['barbell', 'rack'],
    difficulty: 3,
    isCompound: true,
    alternatives: ['dumbbell_shoulder_press', 'shoulder_press_machine'],
  },
  {
    id: 'dumbbell_shoulder_press',
    name: 'Dumbbell shoulder press',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['triceps'],
    pattern: 'vertical_push',
    equipment: ['dumbbell', 'bench'],
    difficulty: 2,
    isCompound: true,
    alternatives: ['overhead_press', 'shoulder_press_machine'],
  },
  {
    id: 'shoulder_press_machine',
    name: 'Shoulder press machine',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['triceps'],
    pattern: 'vertical_push',
    equipment: ['machine'],
    difficulty: 1,
    isCompound: true,
    alternatives: ['dumbbell_shoulder_press', 'overhead_press'],
  },
  {
    id: 'lateral_raise',
    name: 'Lateral raise',
    primaryMuscle: 'shoulders',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['dumbbell'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['cable_lateral_raise'],
  },
  {
    id: 'cable_lateral_raise',
    name: 'Cable lateral raise',
    primaryMuscle: 'shoulders',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['cable'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['lateral_raise'],
  },
  {
    id: 'rear_delt_fly',
    name: 'Rear delt fly',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['back'],
    pattern: 'isolation',
    equipment: ['dumbbell'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['face_pull'],
  },
  {
    id: 'face_pull',
    name: 'Face pull',
    primaryMuscle: 'shoulders',
    secondaryMuscles: ['back'],
    pattern: 'isolation',
    equipment: ['cable'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['rear_delt_fly'],
  },

  // ---------- Vertical pull ----------
  {
    id: 'pull_up',
    name: 'Pull-up',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    pattern: 'vertical_pull',
    equipment: ['bodyweight'],
    difficulty: 3,
    isCompound: true,
    alternatives: ['lat_pulldown', 'assisted_pull_up'],
  },
  {
    id: 'assisted_pull_up',
    name: 'Assisted pull-up',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    pattern: 'vertical_pull',
    equipment: ['machine'],
    difficulty: 1,
    isCompound: true,
    alternatives: ['lat_pulldown', 'pull_up'],
  },
  {
    id: 'lat_pulldown',
    name: 'Lat pulldown',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    pattern: 'vertical_pull',
    equipment: ['cable', 'machine'],
    difficulty: 1,
    isCompound: true,
    alternatives: ['pull_up', 'assisted_pull_up'],
  },

  // ---------- Horizontal pull ----------
  {
    id: 'barbell_row',
    name: 'Barbell row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    pattern: 'horizontal_pull',
    equipment: ['barbell'],
    difficulty: 3,
    isCompound: true,
    alternatives: ['dumbbell_row', 'seated_cable_row', 'chest_supported_row'],
  },
  {
    id: 'dumbbell_row',
    name: 'Dumbbell row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    pattern: 'horizontal_pull',
    equipment: ['dumbbell', 'bench'],
    difficulty: 1,
    isCompound: true,
    alternatives: ['seated_cable_row', 'chest_supported_row', 'barbell_row'],
  },
  {
    id: 'seated_cable_row',
    name: 'Seated cable row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    pattern: 'horizontal_pull',
    equipment: ['cable'],
    difficulty: 1,
    isCompound: true,
    alternatives: ['chest_supported_row', 'dumbbell_row'],
  },
  {
    id: 'chest_supported_row',
    name: 'Chest-supported row',
    primaryMuscle: 'back',
    secondaryMuscles: ['biceps'],
    pattern: 'horizontal_pull',
    equipment: ['machine'],
    difficulty: 1,
    isCompound: true,
    alternatives: ['seated_cable_row', 'dumbbell_row'],
  },

  // ---------- Squat ----------
  {
    id: 'back_squat',
    name: 'Back squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'core'],
    pattern: 'squat',
    equipment: ['barbell', 'rack'],
    difficulty: 3,
    isCompound: true,
    alternatives: ['front_squat', 'hack_squat', 'leg_press', 'goblet_squat'],
  },
  {
    id: 'front_squat',
    name: 'Front squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['core', 'glutes'],
    pattern: 'squat',
    equipment: ['barbell', 'rack'],
    difficulty: 3,
    isCompound: true,
    alternatives: ['back_squat', 'goblet_squat', 'hack_squat'],
  },
  {
    id: 'goblet_squat',
    name: 'Goblet squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes', 'core'],
    pattern: 'squat',
    equipment: ['dumbbell', 'kettlebell'],
    difficulty: 1,
    isCompound: true,
    alternatives: ['leg_press', 'back_squat'],
  },
  {
    id: 'hack_squat',
    name: 'Hack squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    pattern: 'squat',
    equipment: ['machine'],
    difficulty: 2,
    isCompound: true,
    alternatives: ['leg_press', 'back_squat'],
  },
  {
    id: 'leg_press',
    name: 'Leg press',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    pattern: 'squat',
    equipment: ['machine'],
    difficulty: 1,
    isCompound: true,
    alternatives: ['hack_squat', 'goblet_squat'],
  },
  {
    id: 'leg_extension',
    name: 'Leg extension',
    primaryMuscle: 'quads',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['machine'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['leg_press'],
  },

  // ---------- Hinge ----------
  {
    id: 'deadlift',
    name: 'Deadlift',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['back', 'glutes', 'core'],
    pattern: 'hinge',
    equipment: ['barbell'],
    difficulty: 3,
    isCompound: true,
    alternatives: ['romanian_deadlift', 'trap_bar_deadlift', 'back_extension'],
  },
  {
    id: 'romanian_deadlift',
    name: 'Romanian deadlift',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['glutes', 'back'],
    pattern: 'hinge',
    equipment: ['barbell', 'dumbbell'],
    difficulty: 2,
    isCompound: true,
    alternatives: ['deadlift', 'seated_leg_curl', 'back_extension'],
  },
  {
    id: 'trap_bar_deadlift',
    name: 'Trap bar deadlift',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: ['quads', 'glutes', 'back'],
    pattern: 'hinge',
    equipment: ['barbell'],
    difficulty: 2,
    isCompound: true,
    alternatives: ['deadlift', 'romanian_deadlift'],
  },
  {
    id: 'seated_leg_curl',
    name: 'Seated leg curl',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['machine'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['lying_leg_curl', 'romanian_deadlift'],
  },
  {
    id: 'lying_leg_curl',
    name: 'Lying leg curl',
    primaryMuscle: 'hamstrings',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['machine'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['seated_leg_curl'],
  },
  {
    id: 'back_extension',
    name: 'Back extension',
    primaryMuscle: 'glutes',
    secondaryMuscles: ['hamstrings', 'back'],
    pattern: 'hinge',
    equipment: ['bodyweight', 'bench'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['romanian_deadlift'],
  },
  {
    id: 'hip_thrust',
    name: 'Hip thrust',
    primaryMuscle: 'glutes',
    secondaryMuscles: ['hamstrings'],
    pattern: 'hinge',
    equipment: ['barbell', 'bench'],
    difficulty: 2,
    isCompound: true,
    alternatives: ['back_extension', 'romanian_deadlift'],
  },

  // ---------- Lunge ----------
  {
    id: 'walking_lunge',
    name: 'Walking lunge',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    pattern: 'lunge',
    equipment: ['dumbbell', 'bodyweight'],
    difficulty: 2,
    isCompound: true,
    alternatives: ['bulgarian_split_squat', 'leg_press'],
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian split squat',
    primaryMuscle: 'quads',
    secondaryMuscles: ['glutes'],
    pattern: 'lunge',
    equipment: ['dumbbell', 'bench'],
    difficulty: 2,
    isCompound: true,
    alternatives: ['walking_lunge', 'leg_press'],
  },

  // ---------- Arms ----------
  {
    id: 'barbell_curl',
    name: 'Barbell curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['barbell'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['dumbbell_curl', 'cable_curl'],
  },
  {
    id: 'dumbbell_curl',
    name: 'Dumbbell curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['dumbbell'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['cable_curl', 'barbell_curl'],
  },
  {
    id: 'cable_curl',
    name: 'Cable curl',
    primaryMuscle: 'biceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['cable'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['dumbbell_curl', 'barbell_curl'],
  },
  {
    id: 'triceps_pushdown',
    name: 'Triceps pushdown',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['cable'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['overhead_triceps_extension', 'dip'],
  },
  {
    id: 'overhead_triceps_extension',
    name: 'Overhead triceps extension',
    primaryMuscle: 'triceps',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['dumbbell', 'cable'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['triceps_pushdown', 'dip'],
  },
  {
    id: 'dip',
    name: 'Dip',
    primaryMuscle: 'triceps',
    secondaryMuscles: ['chest', 'shoulders'],
    pattern: 'vertical_push',
    equipment: ['bodyweight'],
    difficulty: 2,
    isCompound: true,
    alternatives: ['triceps_pushdown', 'push_up'],
  },

  // ---------- Calves & core ----------
  {
    id: 'standing_calf_raise',
    name: 'Standing calf raise',
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['machine', 'bodyweight'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['seated_calf_raise'],
  },
  {
    id: 'seated_calf_raise',
    name: 'Seated calf raise',
    primaryMuscle: 'calves',
    secondaryMuscles: [],
    pattern: 'isolation',
    equipment: ['machine'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['standing_calf_raise'],
  },
  {
    id: 'plank',
    name: 'Plank',
    primaryMuscle: 'core',
    secondaryMuscles: [],
    pattern: 'core',
    equipment: ['bodyweight'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['cable_crunch', 'hanging_leg_raise'],
  },
  {
    id: 'cable_crunch',
    name: 'Cable crunch',
    primaryMuscle: 'core',
    secondaryMuscles: [],
    pattern: 'core',
    equipment: ['cable'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['plank', 'hanging_leg_raise'],
  },
  {
    id: 'hanging_leg_raise',
    name: 'Hanging leg raise',
    primaryMuscle: 'core',
    secondaryMuscles: [],
    pattern: 'core',
    equipment: ['bodyweight'],
    difficulty: 2,
    isCompound: false,
    alternatives: ['cable_crunch', 'plank'],
  },

  // ---------- Light / recovery ----------
  {
    id: 'stationary_bike',
    name: 'Stationary bike',
    primaryMuscle: 'quads',
    secondaryMuscles: [],
    pattern: 'carry',
    equipment: ['cardio'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['incline_walk'],
  },
  {
    id: 'incline_walk',
    name: 'Incline walk',
    primaryMuscle: 'calves',
    secondaryMuscles: ['glutes'],
    pattern: 'carry',
    equipment: ['cardio'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['stationary_bike'],
  },
  {
    id: 'mobility_flow',
    name: 'Mobility flow',
    primaryMuscle: 'core',
    secondaryMuscles: [],
    pattern: 'core',
    equipment: ['bodyweight'],
    difficulty: 1,
    isCompound: false,
    alternatives: ['incline_walk'],
  },
];

const BY_ID = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));

export function getExercise(id: string): Exercise | undefined {
  return BY_ID.get(id);
}

export function exerciseName(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  calves: 'Calves',
  core: 'Core',
};

export const EQUIPMENT_LABELS: Record<EquipmentId, string> = {
  barbell: 'Barbells',
  dumbbell: 'Dumbbells',
  machine: 'Machines',
  cable: 'Cables',
  bench: 'Benches',
  rack: 'Racks',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebells',
  band: 'Bands',
  cardio: 'Cardio',
};

export const PATTERN_LABELS: Record<MovementPattern, string> = {
  horizontal_push: 'Horizontal push',
  vertical_push: 'Vertical push',
  horizontal_pull: 'Horizontal pull',
  vertical_pull: 'Vertical pull',
  squat: 'Squat',
  hinge: 'Hinge',
  lunge: 'Lunge',
  isolation: 'Isolation',
  carry: 'Carry',
  core: 'Core',
};

export type SubstitutionOption = {
  exercise: Exercise;
  /** Why this one is being offered. */
  reason: string;
  /** False when the gym is known not to have the equipment. */
  availableHere: boolean;
};

/**
 * Substitution candidates for an exercise: its declared alternatives first,
 * then anything sharing the movement pattern. Equipment marked unavailable at
 * the current gym is pushed to the bottom rather than hidden — the user may
 * still know better than the inventory.
 */
export function findSubstitutions(
  exerciseId: string,
  equipmentAvailability: Record<string, string> = {},
): SubstitutionOption[] {
  const source = getExercise(exerciseId);
  if (!source) return [];

  const isAvailable = (exercise: Exercise) =>
    exercise.equipment.every((item) => equipmentAvailability[item] !== 'unavailable');

  const seen = new Set<string>([exerciseId]);
  const options: SubstitutionOption[] = [];

  for (const id of source.alternatives) {
    const exercise = getExercise(id);
    if (!exercise || seen.has(id)) continue;
    seen.add(id);
    options.push({ exercise, reason: 'Direct alternative', availableHere: isAvailable(exercise) });
  }

  for (const exercise of EXERCISES) {
    if (seen.has(exercise.id)) continue;
    if (exercise.pattern !== source.pattern) continue;
    seen.add(exercise.id);
    options.push({
      exercise,
      reason: `Same pattern (${PATTERN_LABELS[exercise.pattern].toLowerCase()})`,
      availableHere: isAvailable(exercise),
    });
  }

  for (const exercise of EXERCISES) {
    if (seen.has(exercise.id)) continue;
    if (exercise.primaryMuscle !== source.primaryMuscle) continue;
    seen.add(exercise.id);
    options.push({
      exercise,
      reason: `Same muscle (${MUSCLE_GROUP_LABELS[exercise.primaryMuscle].toLowerCase()})`,
      availableHere: isAvailable(exercise),
    });
  }

  return options.sort((a, b) => Number(b.availableHere) - Number(a.availableHere));
}

/** Free-text search across the library, used by the exercise picker. */
export function searchExercises(query: string): Exercise[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return EXERCISES;
  return EXERCISES.filter(
    (exercise) =>
      exercise.name.toLowerCase().includes(needle) ||
      MUSCLE_GROUP_LABELS[exercise.primaryMuscle].toLowerCase().includes(needle),
  );
}
