/**
 * Domain entities. These shapes map 1:1 onto the Supabase schema in
 * `src/services/supabase/schema.sql`, so moving persistence to the server is an
 * adapter change rather than a remodel.
 */

export type UUID = string;
/** Calendar day, `YYYY-MM-DD`, always in the user's local timezone. */
export type ISODate = string;
export type ISODateTime = string;

/** Where a value came from. Recorded on every health-related value. */
export type DataSource = 'manual' | 'apple_health' | 'apple_watch' | 'renpho' | 'mikuy' | 'calculated';

export type Confidence = 'low' | 'medium' | 'high';

export type GoalType =
  | 'regain_condition'
  | 'build_muscle'
  | 'lose_fat'
  | 'recomposition'
  | 'build_strength'
  | 'maintain';

export type ExperienceLevel = 'beginner' | 'returning' | 'intermediate' | 'advanced';

/**
 * Limb proportions, which are geometry rather than physiology.
 *
 * Long femurs make an upright squat mechanically hard; long arms lengthen a
 * bench press and shorten a deadlift. This is the part of "body type" that
 * actually changes a plan — see `docs/body-model.md`.
 */
export type LimbLength = 'short' | 'average' | 'long';
export type BiologicalSex = 'male' | 'female' | 'unspecified';

/**
 * How the user is eating relative to maintenance. Defined here rather than in
 * the plan module so entities can reference it without a circular import.
 */
export type NutritionStrategy =
  | 'aggressive_cut'
  | 'cut'
  | 'moderate_cut'
  | 'lean_cut'
  | 'maintain'
  | 'slow_bulk'
  | 'lean_bulk'
  | 'moderate_bulk'
  | 'bulk';

/** What the user wants. The strategy above is derived from these three. */
export type PlanObjective = 'build' | 'lean' | 'recomp';
export type PlanSpeed = 'cautious' | 'steady' | 'fast' | 'max';
export type FatTolerance = 'minimal' | 'some' | 'whatever';
export type TrainingLocation = 'gym' | 'home';
export type UnitSystem = 'metric' | 'imperial';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'calves'
  | 'core';

export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'isolation'
  | 'carry'
  | 'core';

export type EquipmentId =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bench'
  | 'rack'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'cardio';

export type EquipmentAvailability = 'available' | 'unavailable' | 'unsure';

export interface Profile {
  id: UUID;
  name: string;
  heightCm: number;
  experience: ExperienceLevel;
  /** Weeks away from training before starting Comeback. */
  layoffWeeks: number;
  /** Only used for the calorie estimate; assumed when not set. */
  age: number | null;
  sex: BiologicalSex;
  /**
   * Wrist circumference, cm. The one cheap proxy for skeletal frame — it is
   * almost all bone, so it barely moves with training or with fat.
   */
  wristCm: number | null;
  /** Arms and legs relative to torso. Changes which lifts suit the person. */
  armLength: LimbLength;
  legLength: LimbLength;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Goal {
  id: UUID;
  type: GoalType;
  /** What you want, how fast, and how much fat you will accept getting there. */
  objective: PlanObjective;
  speed: PlanSpeed;
  fatTolerance: FatTolerance;
  /**
   * A hard limit on body fat, in percent, or null for none.
   *
   * Different from `fatTolerance`, which is a preference about the pace. This
   * is a line the plan may not cross: it decides where a building phase ends,
   * rather than how fast it runs.
   */
  maxBodyFatPercent: number | null;
  /** Derived from the three above. Drives every projection. */
  strategy: NutritionStrategy;
  /** Muscles to bias volume towards. Empty means a balanced routine. */
  muscleFocus: MuscleGroup[];
  targetWeightKg: number | null;
  proteinTargetG: number | null;
  /** Horizon the user is working towards, in weeks. Drives the target date. */
  horizonWeeks: number;
  startedAt: ISODate;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface TrainingPreferences {
  minDaysPerWeek: number;
  preferredDaysPerWeek: number;
  sessionMinutes: number;
  /** 0 = Sunday … 6 = Saturday. */
  preferredWeekdays: number[];
  location: TrainingLocation;
  gymId: UUID | null;
  /**
   * Run sessions one set at a time, with the movement animating and a cue,
   * rather than as a list. On by default: someone coming back is relearning
   * technique, and the list view assumes you already know it.
   */
  guided: boolean;
}

export interface UserPreferences {
  units: UnitSystem;
  defaultRestSeconds: number;
  /** 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1;
}

export interface Gym {
  id: UUID;
  name: string;
  /** Equipment the user has confirmed, one way or the other. */
  equipment: Record<string, EquipmentAvailability>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Exercise {
  /** Canonical, stable, language-independent identifier. */
  id: string;
  /** English label; localised catalogues key off `id`. */
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  pattern: MovementPattern;
  equipment: EquipmentId[];
  difficulty: 1 | 2 | 3;
  isCompound: boolean;
  /** Canonical ids of acceptable substitutes, best first. */
  alternatives: string[];
}

export interface RoutineExercise {
  id: UUID;
  exerciseId: string;
  order: number;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number;
}

export interface RoutineDay {
  id: UUID;
  order: number;
  name: string;
  focus: MuscleGroup[];
  exercises: RoutineExercise[];
}

export interface Routine {
  id: UUID;
  name: string;
  daysPerWeek: number;
  days: RoutineDay[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  deletedAt: ISODateTime | null;
}

/**
 * A stretch of the plan under one strategy. Switching strategy closes the
 * current phase and opens a new one — nothing is deleted, so the history of
 * "what I was doing when" survives every change of mind.
 */
export interface PlanPhase {
  id: UUID;
  strategy: NutritionStrategy;
  startedAt: ISODate;
  endedAt: ISODate | null;
  startWeightKg: number;
  endWeightKg: number | null;
  targetWeightKg: number | null;
  /** Why the user switched, in their words. */
  note: string | null;
  createdAt: ISODateTime;
}

export type PlannedSessionStatus =
  | 'planned'
  | 'completed'
  | 'skipped'
  | 'rescheduled'
  | 'rest';

export interface PlannedSession {
  id: UUID;
  date: ISODate;
  routineId: UUID | null;
  routineDayId: UUID | null;
  status: PlannedSessionStatus;
  /** Set when the session was actually trained. */
  sessionId: UUID | null;
  /** Set when the user moved it rather than dropping it. */
  rescheduledToDate: ISODate | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface WorkoutSet {
  id: UUID;
  order: number;
  weightKg: number | null;
  reps: number | null;
  /** Reps in reserve, 0–5. Null when the user did not record it. */
  rir: number | null;
  warmup: boolean;
  completed: boolean;
  completedAt: ISODateTime | null;
}

export interface WorkoutExercise {
  id: UUID;
  exerciseId: string;
  order: number;
  /** Canonical id of the exercise this replaced, if any. */
  substitutedFrom: string | null;
  note: string | null;
  /** Set when the user chose to leave this one out today. */
  skipped: boolean;
  sets: WorkoutSet[];
}

export type SessionIntent = 'full' | 'reduced' | 'recovery' | 'free';
export type SessionStatus = 'active' | 'completed' | 'discarded';

/**
 * A stretch where the session was deliberately stopped.
 *
 * Distinct from the gap between two sets: this is the user saying "I am not
 * training right now". Recording it separately is what lets the app report how
 * long a session really took without counting the queue for the squat rack as
 * training time.
 */
export interface SessionPause {
  id: UUID;
  startedAt: ISODateTime;
  /** Null while the pause is still running. */
  endedAt: ISODateTime | null;
}

export interface WorkoutSession {
  id: UUID;
  date: ISODate;
  startedAt: ISODateTime;
  endedAt: ISODateTime | null;
  name: string;
  routineId: UUID | null;
  routineDayId: UUID | null;
  plannedSessionId: UUID | null;
  intent: SessionIntent;
  status: SessionStatus;
  notes: string | null;
  /** Deliberate stops, so paused time is not counted as training time. */
  pauses: SessionPause[];
  exercises: WorkoutExercise[];
}

export interface DailyCheckin {
  id: UUID;
  date: ISODate;
  sleepHours: number | null;
  /** All 1–5 scales; 5 is always the favourable end except soreness/stress. */
  sleepQuality: number | null;
  energy: number | null;
  soreness: number | null;
  stress: number | null;
  motivation: number | null;
  source: DataSource;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface BodyMeasurement {
  id: UUID;
  date: ISODate;
  weightKg: number;
  bodyFatPercent: number | null;
  source: DataSource;
  createdAt: ISODateTime;
}

export type MomentumStateId =
  | 'declining'
  | 'at_risk'
  | 'stable'
  | 'building'
  | 'strong'
  | 'recovering';

export interface MomentumComponents {
  adherence: number | null;
  consistency: number | null;
  progression: number | null;
  recovery: number | null;
  logging: number | null;
}

export interface MomentumFactor {
  key: string;
  label: string;
  direction: 'positive' | 'negative' | 'neutral';
  detail: string;
}

export interface MomentumSnapshot {
  id: UUID;
  date: ISODate;
  score: number;
  previousScore: number | null;
  delta: number;
  state: MomentumStateId;
  components: MomentumComponents;
  confidence: Confidence;
  factors: MomentumFactor[];
  explanation: string;
  createdAt: ISODateTime;
}

export interface BaselineExercise {
  exerciseId: string;
  /** Estimated one-rep max at the reference level, kg. */
  e1rmKg: number;
}

export interface ComebackBaseline {
  id: UUID;
  /** `observed` = measured from logged sessions, `declared` = entered by user. */
  source: 'observed' | 'declared';
  establishedAt: ISODate;
  exercises: BaselineExercise[];
  weeklySessions: number;
  weeklyVolumeKg: number;
  /** Sessions observed while building it — drives confidence. */
  sampleSessions: number;
}

export interface ComebackProgressSnapshot {
  id: UUID;
  date: ISODate;
  value: number;
  confidence: Confidence;
  components: {
    strength: number | null;
    volume: number | null;
    frequency: number | null;
  };
  matchedExercises: number;
  createdAt: ISODateTime;
}

export type RecommendationType =
  | 'full'
  | 'reduced'
  | 'recovery'
  | 'rest'
  | 'rescheduled'
  | 'free';

export interface RecommendationFactor {
  key: string;
  label: string;
  direction: 'positive' | 'negative' | 'neutral';
}

export interface DailyRecommendation {
  id: UUID;
  date: ISODate;
  type: RecommendationType;
  title: string;
  routineId: UUID | null;
  routineDayId: UUID | null;
  estimatedMinutes: number;
  reason: string;
  factors: RecommendationFactor[];
  confidence: Confidence;
  createdAt: ISODateTime;
  followedAt: ISODateTime | null;
}
