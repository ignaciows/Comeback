import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { buildInitialRoutine, type PlanRequest } from '@/data/routineTemplates';
import { getExercise } from '@/data/exercises';
import { trainingConfig } from '@/domain/config';
import { runEngine } from '@/domain/engine';
import { defaultStrategyFor, strategyProfile } from '@/domain/plan/strategies';
import { SPEEDS, simulatePlan } from '@/domain/plan/simulate';
import { asObjective, asSpeed, requiredSessionsPerWeek } from '@/domain/plan/commitments';
import type { CustomBlock } from '@/domain/plan/customPlan';
import type { VerdictAction } from '@/domain/plan/verdict';
import { getRoute, type FollowedRoute, type PlanRoute } from '@/domain/plan/routes';
import { observedWeeklyRate } from '@/domain/plan/observedRate';
import type { Proposal } from '@/domain/inference/proposals';
import { adaptSetCount } from '@/domain/training/adaptation';
import { applyEmphasis } from '@/domain/training/volume';
import type {
  BodyMeasurement,
  ComebackBaseline,
  DailyCheckin,
  DataSource,
  EquipmentAvailability,
  Goal,
  FatTolerance,
  Gym,
  ISODate,
  MuscleGroup,
  NutritionStrategy,
  PlanObjective,
  PlanSpeed,
  PlanPhase,
  PlannedSession,
  Profile,
  Routine,
  RoutineExercise,
  SessionIntent,
  TrainingPreferences,
  UserPreferences,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '@/domain/types';
import { track } from '@/services/analytics/analytics';
import { asyncStorageAdapter, STORAGE_KEY } from '@/services/storage/adapter';
import { addDays, daysBetween, nowISO, startOfWeek, today as todayOf, weekdayOf } from '@/utils/date';
import { createId } from '@/utils/id';

const DEFAULT_TRAINING: TrainingPreferences = {
  minDaysPerWeek: 3,
  preferredDaysPerWeek: 4,
  sessionMinutes: 60,
  preferredWeekdays: [1, 2, 4, 5],
  location: 'gym',
  gymId: null,
};

const DEFAULT_PREFERENCES: UserPreferences = {
  units: 'metric',
  defaultRestSeconds: trainingConfig.defaultRestSeconds,
  weekStartsOn: 1,
};

/** How far ahead planned sessions are materialised. */
const PLAN_HORIZON_DAYS = 21;

/** Sessions a week each strategy is built around. */
const DAYS_FOR_STRATEGY: Record<NutritionStrategy, number> = {
  aggressive_cut: 4,
  cut: 4,
  lean_cut: 4,
  maintain: 4,
  lean_bulk: 5,
  bulk: 5,
};

/** A sensible spread of training days for each weekly frequency. */
export const WEEKDAYS_FOR: Record<number, number[]> = {
  2: [2, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

export type OnboardingPayload = {
  name: string;
  heightCm: number;
  weightKg: number;
  experience: Profile['experience'];
  layoffWeeks: number;
  goalType: Goal['type'];
  objective: PlanObjective;
  speed: PlanSpeed;
  fatTolerance: FatTolerance;
  strategy?: NutritionStrategy;
  muscleFocus?: MuscleGroup[];
  targetWeightKg: number | null;
  horizonWeeks: number;
  daysPerWeek: number;
  sessionMinutes: number;
  preferredWeekdays: number[];
  location: TrainingPreferences['location'];
  checkin: Pick<DailyCheckin, 'sleepHours' | 'sleepQuality' | 'energy' | 'soreness' | 'stress' | 'motivation'>;
  lastWorkoutDate: ISODate | null;
  limitations: string | null;
};

export type AppState = {
  schemaVersion: number;
  hydrated: boolean;
  onboardingCompleted: boolean;

  profile: Profile | null;
  goal: Goal | null;
  training: TrainingPreferences;
  preferences: UserPreferences;
  limitations: string | null;

  gyms: Gym[];
  routines: Routine[];
  activeRoutineId: string | null;

  plannedSessions: PlannedSession[];
  sessions: WorkoutSession[];
  activeSessionId: string | null;

  checkins: DailyCheckin[];
  bodyMeasurements: BodyMeasurement[];
  comebackBaseline: ComebackBaseline | null;
  /** Strategy history; never rewritten, only appended to. */
  phases: PlanPhase[];
  /** The multi-block route being followed — named, or built by the user. */
  planRoute: (FollowedRoute & { startedAt: ISODate }) | null;
  /** Suggestion ids already applied or dismissed, so they stop coming back. */
  appliedProposals: string[];
};

type Actions = {
  setHydrated: () => void;
  completeOnboarding: (payload: OnboardingPayload) => void;

  updateProfile: (patch: Partial<Profile>) => void;
  updateGoal: (patch: Partial<Goal>) => void;
  updateTraining: (patch: Partial<TrainingPreferences>) => void;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  setLimitations: (value: string | null) => void;

  saveCheckin: (date: ISODate, values: Partial<Omit<DailyCheckin, 'id' | 'date' | 'createdAt' | 'updatedAt'>>) => void;
  logBodyWeight: (
    weightKg: number,
    date?: ISODate,
    source?: DataSource,
    bodyFatPercent?: number | null,
  ) => void;
  deleteBodyMeasurement: (id: string) => void;

  ensurePlan: (from?: ISODate) => void;
  regenerateRoutine: () => void;
  updateRoutineExercise: (
    routineDayId: string,
    routineExerciseId: string,
    patch: Partial<Pick<RoutineExercise, 'sets' | 'repMin' | 'repMax' | 'restSeconds' | 'exerciseId'>>,
  ) => void;
  addRoutineExercise: (routineDayId: string, exerciseId: string) => void;
  removeRoutineExercise: (routineDayId: string, routineExerciseId: string) => void;
  moveRoutineExercise: (routineDayId: string, routineExerciseId: string, direction: -1 | 1) => void;
  setGymEquipment: (gymId: string, equipmentId: string, availability: EquipmentAvailability) => void;
  createGym: (name: string) => string;
  /** Adopts a gym found in the search as the user's own. */
  adoptGym: (gym: {
    name: string;
    equipment: Partial<Record<string, EquipmentAvailability>>;
    address?: string | null;
    source?: 'chain' | 'unknown';
  }) => void;

  startSession: (options: {
    routineId?: string | null;
    routineDayId?: string | null;
    intent?: SessionIntent;
    name?: string;
    plannedSessionId?: string | null;
  }) => string;
  addExerciseToSession: (sessionId: string, exerciseId: string) => void;
  removeExerciseFromSession: (sessionId: string, workoutExerciseId: string) => void;
  moveExercise: (sessionId: string, workoutExerciseId: string, direction: -1 | 1) => void;
  substituteExercise: (sessionId: string, workoutExerciseId: string, exerciseId: string) => void;
  addSet: (sessionId: string, workoutExerciseId: string, options?: { duplicateLast?: boolean; warmup?: boolean }) => void;
  updateSet: (sessionId: string, workoutExerciseId: string, setId: string, patch: Partial<WorkoutSet>) => void;
  removeSet: (sessionId: string, workoutExerciseId: string, setId: string) => void;
  setSessionNotes: (sessionId: string, notes: string) => void;
  /** Stops the clock. Paused time is excluded from the session's length. */
  pauseSession: (sessionId: string) => void;
  resumeSession: (sessionId: string) => void;
  /** Clears every logged set but keeps the session and its exercises. */
  restartSession: (sessionId: string) => void;
  /** Leaves an exercise out of today without deleting it. */
  toggleExerciseSkipped: (sessionId: string, workoutExerciseId: string) => void;
  finishSession: (sessionId: string) => void;
  discardSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;

  skipPlannedSession: (plannedSessionId: string) => void;
  reschedulePlannedSession: (plannedSessionId: string, toDate: ISODate) => void;

  changeStrategy: (strategy: NutritionStrategy, options?: { targetWeightKg?: number | null; note?: string | null }) => void;
  /** Starts a multi-block route, or advances it to its next block. */
  applyRoute: (routeId: string) => void;
  /** Commits to a plan the user built themselves. */
  applyCustomPlan: (blocks: CustomBlock[]) => void;
  advanceRouteBlock: (strategy: NutritionStrategy) => void;
  applyPlanIntent: (intent: {
    objective: PlanObjective;
    speed: PlanSpeed;
    fatTolerance: FatTolerance;
    targetWeightKg?: number | null;
    horizonWeeks?: number;
  }) => void;
  /** Writes an import from a health source into the store. */
  applyHealthSync: (result: {
    weights: BodyMeasurement[];
    sleep: { date: ISODate; hours: number }[];
  }) => void;
  /** Biases the routine towards the muscles the user picked. */
  setMuscleFocus: (muscles: MuscleGroup[]) => void;
  /** Reconfigures the plan to match what the user is actually doing. */
  applyVerdictAction: (action: VerdictAction) => void;
  /** Applies a change the app worked out on its own. */
  applyProposal: (proposal: Proposal) => void;
  dismissProposal: (id: string) => void;
  persistBaseline: (baseline: ComebackBaseline) => void;
  seedDeveloperProfile: () => void;
  resetAll: () => void;
};

export type Store = AppState & Actions;

const initialState: AppState = {
  schemaVersion: 5,
  hydrated: false,
  onboardingCompleted: false,
  profile: null,
  goal: null,
  training: DEFAULT_TRAINING,
  preferences: DEFAULT_PREFERENCES,
  limitations: null,
  gyms: [],
  routines: [],
  activeRoutineId: null,
  plannedSessions: [],
  sessions: [],
  activeSessionId: null,
  checkins: [],
  bodyMeasurements: [],
  comebackBaseline: null,
  phases: [],
  planRoute: null,
  appliedProposals: [],
};

/** Last completed working set for an exercise — drives the suggested values. */
function lastPerformance(sessions: WorkoutSession[], exerciseId: string): WorkoutSet | null {
  const ordered = sessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const session of ordered) {
    const exercise = session.exercises.find((entry) => entry.exerciseId === exerciseId);
    if (!exercise) continue;
    const sets = exercise.sets.filter((set) => set.completed && !set.warmup);
    if (sets.length > 0) return sets[sets.length - 1];
  }
  return null;
}

function makeSet(order: number, template: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: createId(),
    order,
    weightKg: template.weightKg ?? null,
    reps: template.reps ?? null,
    rir: template.rir ?? null,
    warmup: template.warmup ?? false,
    completed: false,
    completedAt: null,
  };
}

/**
 * Keeps history and anything the user already acted on, and drops the untouched
 * future so the plan can be rebuilt from the current schedule. Rest days have to
 * go too, otherwise a day that was rest yesterday can never become a training
 * day today.
 */
function keepPastAndResolved(entries: PlannedSession[], from: ISODate): PlannedSession[] {
  // A session the user deliberately moved forward is kept where they put it.
  const rescheduleTargets = new Set(
    entries.map((entry) => entry.rescheduledToDate).filter((date): date is ISODate => date !== null),
  );
  return entries.filter(
    (entry) =>
      entry.date < from ||
      entry.status === 'completed' ||
      entry.status === 'skipped' ||
      entry.status === 'rescheduled' ||
      rescheduleTargets.has(entry.date),
  );
}

function reindex<T extends { order: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

/** Equipment at the gym the user trains in, empty when none is set. */
function equipmentOf(state: AppState): Record<string, EquipmentAvailability> {
  const gym = state.gyms.find((entry) => entry.id === state.training.gymId) ?? state.gyms[0] ?? null;
  return gym?.equipment ?? {};
}

export const useAppStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialState,

      setHydrated: () => set({ hydrated: true }),

      completeOnboarding: (payload) => {
        const timestamp = nowISO();
        const date = todayOf();

        const profile: Profile = {
          id: createId(),
          name: payload.name.trim(),
          heightCm: payload.heightCm,
          experience: payload.experience,
          layoffWeeks: payload.layoffWeeks,
          age: null,
          sex: 'unspecified',
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const strategy = payload.strategy ?? defaultStrategyFor(payload.goalType);

        const goal: Goal = {
          id: createId(),
          type: payload.goalType,
          objective: payload.objective,
          speed: payload.speed,
          fatTolerance: payload.fatTolerance,
          strategy,
          muscleFocus: payload.muscleFocus ?? [],
          targetWeightKg: payload.targetWeightKg,
          proteinTargetG: null,
          horizonWeeks: payload.horizonWeeks,
          startedAt: date,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const training: TrainingPreferences = {
          minDaysPerWeek: Math.max(2, payload.daysPerWeek - 1),
          preferredDaysPerWeek: payload.daysPerWeek,
          sessionMinutes: payload.sessionMinutes,
          preferredWeekdays: payload.preferredWeekdays,
          location: payload.location,
          gymId: null,
        };

        const planRequest: PlanRequest = {
          daysPerWeek: payload.daysPerWeek,
          sessionMinutes: payload.sessionMinutes,
          location: payload.location,
          goalType: payload.goalType,
          layoffWeeks: payload.layoffWeeks,
        };
        const routine = buildInitialRoutine(planRequest);

        const gym: Gym | null =
          payload.location === 'gym'
            ? {
                id: createId(),
                name: 'My gym',
                equipment: {},
                createdAt: timestamp,
                updatedAt: timestamp,
              }
            : null;

        const firstPhase: PlanPhase = {
          id: createId(),
          strategy,
          startedAt: date,
          endedAt: null,
          startWeightKg: payload.weightKg,
          endWeightKg: null,
          targetWeightKg: payload.targetWeightKg,
          note: null,
          createdAt: timestamp,
        };

        set({
          profile,
          goal,
          phases: [firstPhase],
          training: { ...training, gymId: gym?.id ?? null },
          limitations: payload.limitations,
          routines: [routine],
          activeRoutineId: routine.id,
          gyms: gym ? [gym] : [],
          onboardingCompleted: true,
          bodyMeasurements: [
            {
              id: createId(),
              date,
              weightKg: payload.weightKg,
              bodyFatPercent: null,
              source: 'manual',
              createdAt: timestamp,
            },
          ],
          // Onboarding only writes a check-in if it actually collected one.
          checkins: Object.values(payload.checkin).some((value) => value !== null)
            ? [
                {
                  id: createId(),
                  date,
                  sleepHours: payload.checkin.sleepHours,
                  sleepQuality: payload.checkin.sleepQuality,
                  energy: payload.checkin.energy,
                  soreness: payload.checkin.soreness,
                  stress: payload.checkin.stress,
                  motivation: payload.checkin.motivation,
                  source: 'manual',
                  createdAt: timestamp,
                  updatedAt: timestamp,
                },
              ]
            : [],
        });

        get().ensurePlan(date);
        track({ name: 'onboarding_completed', daysPerWeek: payload.daysPerWeek, goalType: payload.goalType });
      },

      updateProfile: (patch) =>
        set((state) =>
          state.profile ? { profile: { ...state.profile, ...patch, updatedAt: nowISO() } } : state,
        ),

      updateGoal: (patch) =>
        set((state) => (state.goal ? { goal: { ...state.goal, ...patch, updatedAt: nowISO() } } : state)),

      updateTraining: (patch) => {
        set((state) => ({ training: { ...state.training, ...patch } }));
        // The plan follows the schedule: drop the untouched future and rebuild it.
        set((state) => ({
          plannedSessions: keepPastAndResolved(state.plannedSessions, todayOf()),
        }));
        get().ensurePlan();
      },

      updatePreferences: (patch) => set((state) => ({ preferences: { ...state.preferences, ...patch } })),

      setLimitations: (value) => set({ limitations: value }),

      saveCheckin: (date, values) => {
        const timestamp = nowISO();
        set((state) => {
          const existing = state.checkins.find((checkin) => checkin.date === date);
          if (existing) {
            return {
              checkins: state.checkins.map((checkin) =>
                checkin.date === date ? { ...checkin, ...values, updatedAt: timestamp } : checkin,
              ),
            };
          }
          const created: DailyCheckin = {
            id: createId(),
            date,
            sleepHours: null,
            sleepQuality: null,
            energy: null,
            soreness: null,
            stress: null,
            motivation: null,
            source: 'manual',
            createdAt: timestamp,
            updatedAt: timestamp,
            ...values,
          };
          return { checkins: [...state.checkins, created] };
        });
        const fieldsLogged = Object.values(values).filter((value) => value !== null && value !== undefined).length;
        track({ name: 'daily_checkin_completed', fieldsLogged });
      },

      logBodyWeight: (weightKg, date = todayOf(), source = 'manual', bodyFatPercent = null) => {
        set((state) => {
          const existing = state.bodyMeasurements.find((entry) => entry.date === date);
          if (existing) {
            return {
              bodyMeasurements: state.bodyMeasurements.map((entry) =>
                entry.date === date
                  ? // A later entry without a body-fat reading keeps the old one.
                    { ...entry, weightKg, source, bodyFatPercent: bodyFatPercent ?? entry.bodyFatPercent }
                  : entry,
              ),
            };
          }
          return {
            bodyMeasurements: [
              ...state.bodyMeasurements,
              {
                id: createId(),
                date,
                weightKg,
                bodyFatPercent,
                source,
                createdAt: nowISO(),
              },
            ],
          };
        });
        track({ name: 'body_weight_logged' });
      },

      deleteBodyMeasurement: (id) =>
        set((state) => ({
          bodyMeasurements: state.bodyMeasurements.filter((entry) => entry.id !== id),
        })),

      /**
       * Materialises planned sessions from today forward. Past days are never
       * backfilled — the app does not invent misses that the user never had.
       */
      ensurePlan: (from = todayOf()) => {
        const state = get();
        const routine = state.routines.find((entry) => entry.id === state.activeRoutineId) ?? state.routines[0];
        if (!routine || routine.days.length === 0) return;

        const existingDates = new Set(state.plannedSessions.map((entry) => entry.date));
        const created: PlannedSession[] = [];

        // Continue the rotation from whatever was scheduled last.
        const lastPlanned = [...state.plannedSessions]
          .filter((entry) => entry.routineDayId)
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .pop();
        let rotation = lastPlanned
          ? (routine.days.findIndex((day) => day.id === lastPlanned.routineDayId) + 1) % routine.days.length
          : 0;

        for (let offset = 0; offset < PLAN_HORIZON_DAYS; offset += 1) {
          const date = addDays(from, offset);
          if (existingDates.has(date)) continue;
          const isTrainingDay = state.training.preferredWeekdays.includes(weekdayOf(date));
          const timestamp = nowISO();
          if (isTrainingDay) {
            const day = routine.days[rotation % routine.days.length];
            rotation += 1;
            created.push({
              id: createId(),
              date,
              routineId: routine.id,
              routineDayId: day.id,
              status: 'planned',
              sessionId: null,
              rescheduledToDate: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          } else {
            created.push({
              id: createId(),
              date,
              routineId: null,
              routineDayId: null,
              status: 'rest',
              sessionId: null,
              rescheduledToDate: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          }
        }

        if (created.length > 0) {
          set((current) => ({ plannedSessions: [...current.plannedSessions, ...created] }));
        }
      },

      regenerateRoutine: () => {
        const state = get();
        if (!state.goal || !state.profile) return;
        const base = buildInitialRoutine({
          daysPerWeek: state.training.preferredDaysPerWeek,
          sessionMinutes: state.training.sessionMinutes,
          location: state.training.location,
          goalType: state.goal.type,
          layoffWeeks: state.profile.layoffWeeks,
        });
        // The template is balanced; the user's chosen muscles tilt it.
        const routine = applyEmphasis(base, state.goal.muscleFocus ?? [], equipmentOf(state)).routine;
        set((current) => ({
          routines: [...current.routines.map((entry) => ({ ...entry, deletedAt: nowISO() })), routine],
          activeRoutineId: routine.id,
          plannedSessions: keepPastAndResolved(current.plannedSessions, todayOf()),
        }));
        get().ensurePlan();
      },

      updateRoutineExercise: (routineDayId, routineExerciseId, patch) =>
        set((state) => ({
          routines: state.routines.map((routine) => ({
            ...routine,
            updatedAt: nowISO(),
            days: routine.days.map((day) =>
              day.id === routineDayId
                ? {
                    ...day,
                    exercises: day.exercises.map((exercise) =>
                      exercise.id === routineExerciseId ? { ...exercise, ...patch } : exercise,
                    ),
                  }
                : day,
            ),
          })),
        })),

      addRoutineExercise: (routineDayId, exerciseId) =>
        set((state) => ({
          routines: state.routines.map((routine) => ({
            ...routine,
            updatedAt: nowISO(),
            days: routine.days.map((day) =>
              day.id === routineDayId
                ? {
                    ...day,
                    exercises: [
                      ...day.exercises,
                      {
                        id: createId(),
                        exerciseId,
                        order: day.exercises.length,
                        sets: 3,
                        repMin: 8,
                        repMax: 12,
                        restSeconds: state.preferences.defaultRestSeconds,
                      },
                    ],
                  }
                : day,
            ),
          })),
        })),

      removeRoutineExercise: (routineDayId, routineExerciseId) =>
        set((state) => ({
          routines: state.routines.map((routine) => ({
            ...routine,
            updatedAt: nowISO(),
            days: routine.days.map((day) =>
              day.id === routineDayId
                ? { ...day, exercises: reindex(day.exercises.filter((entry) => entry.id !== routineExerciseId)) }
                : day,
            ),
          })),
        })),

      moveRoutineExercise: (routineDayId, routineExerciseId, direction) =>
        set((state) => ({
          routines: state.routines.map((routine) => ({
            ...routine,
            updatedAt: nowISO(),
            days: routine.days.map((day) => {
              if (day.id !== routineDayId) return day;
              const index = day.exercises.findIndex((entry) => entry.id === routineExerciseId);
              const target = index + direction;
              if (index === -1 || target < 0 || target >= day.exercises.length) return day;
              const next = [...day.exercises];
              [next[index], next[target]] = [next[target], next[index]];
              return { ...day, exercises: reindex(next) };
            }),
          })),
        })),

      createGym: (name) => {
        const gym: Gym = {
          id: createId(),
          name,
          equipment: {},
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        set((state) => ({ gyms: [...state.gyms, gym], training: { ...state.training, gymId: gym.id } }));
        return gym.id;
      },

      adoptGym: ({ name, equipment, address, source }) => {
        const timestamp = nowISO();
        const gym: Gym = {
          id: createId(),
          // The address is part of the name so the user can tell two branches
          // of the same chain apart.
          name: address ? `${name} · ${address}` : name,
          equipment: Object.fromEntries(
            Object.entries(equipment).filter(([, value]) => value !== undefined),
          ) as Gym['equipment'],
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((state) => ({
          gyms: [...state.gyms, gym],
          training: { ...state.training, gymId: gym.id },
        }));
        if (source === 'chain') {
          console.log('[comeback] equipment pre-filled from chain profile; confirm on site');
        }
      },

      setGymEquipment: (gymId, equipmentId, availability) =>
        set((state) => ({
          gyms: state.gyms.map((gym) =>
            gym.id === gymId
              ? {
                  ...gym,
                  equipment: { ...gym.equipment, [equipmentId]: availability },
                  updatedAt: nowISO(),
                }
              : gym,
          ),
        })),

      startSession: ({ routineId = null, routineDayId = null, intent = 'full', name, plannedSessionId = null }) => {
        const state = get();
        // Today's adaptation shapes the session before it starts: a good day
        // gets an extra set on the main lifts, a bad one gets fewer.
        const adaptation = runEngine({
          today: todayOf(),
          sessions: state.sessions,
          plannedSessions: state.plannedSessions,
          checkins: state.checkins,
          training: state.training,
          routines: state.routines,
          activeRoutineId: state.activeRoutineId,
          goal: state.goal,
          profile: state.profile,
          planRoute: state.planRoute,
          bodyMeasurements: state.bodyMeasurements,
          baseline: state.comebackBaseline,
          weekStartsOn: state.preferences.weekStartsOn,
          defaultRestSeconds: state.preferences.defaultRestSeconds,
        }).adaptation;
        const routine =
          state.routines.find((entry) => entry.id === routineId) ??
          state.routines.find((entry) => entry.days.some((day) => day.id === routineDayId)) ??
          null;
        const day = routine?.days.find((entry) => entry.id === routineDayId) ?? null;

        // A reduced session keeps the compound work and drops the tail.
        const planned = day
          ? intent === 'reduced'
            ? day.exercises.filter((exercise) => getExercise(exercise.exerciseId)?.isCompound).slice(0, 3)
            : day.exercises
          : [];

        const exercises: WorkoutExercise[] = planned.map((exercise, index) => {
          const previous = lastPerformance(state.sessions, exercise.exerciseId);
          const isMainLift = index < 2 && Boolean(getExercise(exercise.exerciseId)?.isCompound);
          const setCount =
            intent === 'full' ? adaptSetCount(exercise.sets, adaptation, isMainLift) : exercise.sets;
          return {
            id: createId(),
            exerciseId: exercise.exerciseId,
            order: index,
            substitutedFrom: null,
            note: null,
            skipped: false,
            sets: Array.from({ length: setCount }, (_, setIndex) =>
              makeSet(setIndex, {
                weightKg: previous?.weightKg ?? null,
                reps: previous?.reps ?? exercise.repMin,
              }),
            ),
          };
        });

        const session: WorkoutSession = {
          id: createId(),
          date: todayOf(),
          startedAt: nowISO(),
          endedAt: null,
          name: name ?? day?.name ?? 'Free session',
          routineId: routine?.id ?? null,
          routineDayId: day?.id ?? null,
          plannedSessionId:
            plannedSessionId ??
            state.plannedSessions.find((entry) => entry.date === todayOf() && entry.status === 'planned')?.id ??
            null,
          intent,
          status: 'active',
          notes: null,
          pauses: [],
          exercises,
        };

        set((current) => ({ sessions: [...current.sessions, session], activeSessionId: session.id }));
        track({ name: 'workout_started', intent, planned: Boolean(day) });
        return session.id;
      },

      addExerciseToSession: (sessionId, exerciseId) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            const previous = lastPerformance(state.sessions, exerciseId);
            const exercise: WorkoutExercise = {
              id: createId(),
              exerciseId,
              order: session.exercises.length,
              skipped: false,
              substitutedFrom: null,
              note: null,
              sets: Array.from({ length: 3 }, (_, index) =>
                makeSet(index, { weightKg: previous?.weightKg ?? null, reps: previous?.reps ?? 8 }),
              ),
            };
            return { ...session, exercises: [...session.exercises, exercise] };
          }),
        })),

      removeExerciseFromSession: (sessionId, workoutExerciseId) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  exercises: reindex(session.exercises.filter((entry) => entry.id !== workoutExerciseId)),
                }
              : session,
          ),
        })),

      moveExercise: (sessionId, workoutExerciseId, direction) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            const index = session.exercises.findIndex((entry) => entry.id === workoutExerciseId);
            const target = index + direction;
            if (index === -1 || target < 0 || target >= session.exercises.length) return session;
            const next = [...session.exercises];
            [next[index], next[target]] = [next[target], next[index]];
            return { ...session, exercises: reindex(next) };
          }),
        })),

      substituteExercise: (sessionId, workoutExerciseId, exerciseId) => {
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            return {
              ...session,
              exercises: session.exercises.map((entry) => {
                if (entry.id !== workoutExerciseId) return entry;
                const previous = lastPerformance(state.sessions, exerciseId);
                return {
                  ...entry,
                  substitutedFrom: entry.substitutedFrom ?? entry.exerciseId,
                  exerciseId,
                  // Loads do not carry across exercises; suggest that exercise's own history.
                  sets: entry.sets.map((item) =>
                    item.completed
                      ? item
                      : { ...item, weightKg: previous?.weightKg ?? null, reps: previous?.reps ?? item.reps },
                  ),
                };
              }),
            };
          }),
        }));
        track({ name: 'exercise_substituted' });
      },

      addSet: (sessionId, workoutExerciseId, options = {}) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            return {
              ...session,
              exercises: session.exercises.map((entry) => {
                if (entry.id !== workoutExerciseId) return entry;
                const last = [...entry.sets].reverse().find((item) => !item.warmup) ?? entry.sets[entry.sets.length - 1];
                const template = options.duplicateLast && last ? { weightKg: last.weightKg, reps: last.reps, rir: last.rir } : {};
                return {
                  ...entry,
                  sets: [...entry.sets, makeSet(entry.sets.length, { ...template, warmup: options.warmup })],
                };
              }),
            };
          }),
        })),

      updateSet: (sessionId, workoutExerciseId, setId, patch) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            return {
              ...session,
              exercises: session.exercises.map((entry) => {
                if (entry.id !== workoutExerciseId) return entry;
                return {
                  ...entry,
                  sets: entry.sets.map((item) => {
                    if (item.id !== setId) return item;
                    const next = { ...item, ...patch };
                    if (patch.completed === true && !item.completed) next.completedAt = nowISO();
                    if (patch.completed === false) next.completedAt = null;
                    return next;
                  }),
                };
              }),
            };
          }),
        })),

      removeSet: (sessionId, workoutExerciseId, setId) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            return {
              ...session,
              exercises: session.exercises.map((entry) =>
                entry.id === workoutExerciseId
                  ? { ...entry, sets: reindex(entry.sets.filter((item) => item.id !== setId)) }
                  : entry,
              ),
            };
          }),
        })),

      setSessionNotes: (sessionId, notes) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId ? { ...session, notes } : session,
          ),
        })),

      pauseSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== sessionId) return session;
            // Pausing twice is the same as pausing once.
            if (session.pauses.some((pause) => pause.endedAt === null)) return session;
            return {
              ...session,
              pauses: [...session.pauses, { id: createId(), startedAt: nowISO(), endedAt: null }],
            };
          }),
        })),

      resumeSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  pauses: session.pauses.map((pause) =>
                    pause.endedAt === null ? { ...pause, endedAt: nowISO() } : pause,
                  ),
                }
              : session,
          ),
        })),

      /**
       * Start the session again from zero without losing what was laid out.
       * The clock restarts too — otherwise the first attempt's false start
       * would be counted as training time.
       */
      restartSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  startedAt: nowISO(),
                  pauses: [],
                  exercises: session.exercises.map((exercise) => ({
                    ...exercise,
                    skipped: false,
                    sets: exercise.sets.map((set) => ({ ...set, completed: false, completedAt: null })),
                  })),
                }
              : session,
          ),
        })),

      toggleExerciseSkipped: (sessionId, workoutExerciseId) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  exercises: session.exercises.map((exercise) =>
                    exercise.id === workoutExerciseId
                      ? { ...exercise, skipped: !exercise.skipped }
                      : exercise,
                  ),
                }
              : session,
          ),
        })),

      finishSession: (sessionId) => {
        const state = get();
        const session = state.sessions.find((entry) => entry.id === sessionId);
        if (!session) return;

        const endedAt = nowISO();
        // Sets left untouched are dropped rather than recorded as zeroes.
        const exercises = session.exercises
          .map((exercise) => ({ ...exercise, sets: exercise.sets.filter((item) => item.completed) }))
          .filter((exercise) => exercise.sets.length > 0);

        set((current) => ({
          sessions: current.sessions.map((entry) =>
            entry.id === sessionId
              ? {
                  ...entry,
                  endedAt,
                  status: 'completed' as const,
                  // A session finished while paused closes the pause at the
                  // same moment, so paused time never runs past the session.
                  pauses: entry.pauses.map((pause) =>
                    pause.endedAt === null ? { ...pause, endedAt } : pause,
                  ),
                  exercises: reindex(exercises),
                }
              : entry,
          ),
          activeSessionId: null,
          plannedSessions: current.plannedSessions.map((entry) =>
            entry.id === session.plannedSessionId
              ? { ...entry, status: 'completed' as const, sessionId, updatedAt: endedAt }
              : entry,
          ),
        }));

        const durationMs = new Date(endedAt).getTime() - new Date(session.startedAt).getTime();
        track({
          name: 'workout_completed',
          exercises: exercises.length,
          sets: exercises.reduce((total, exercise) => total + exercise.sets.length, 0),
          durationMinutes: Math.round(durationMs / 60_000),
        });
      },

      discardSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== sessionId),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        })),

      deleteSession: (sessionId) =>
        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== sessionId),
          plannedSessions: state.plannedSessions.map((entry) =>
            entry.sessionId === sessionId
              ? { ...entry, status: 'planned' as const, sessionId: null, updatedAt: nowISO() }
              : entry,
          ),
        })),

      skipPlannedSession: (plannedSessionId) => {
        set((state) => ({
          plannedSessions: state.plannedSessions.map((entry) =>
            entry.id === plannedSessionId
              ? { ...entry, status: 'skipped' as const, updatedAt: nowISO() }
              : entry,
          ),
        }));
        track({ name: 'workout_skipped' });
      },

      reschedulePlannedSession: (plannedSessionId, toDate) => {
        const state = get();
        const source = state.plannedSessions.find((entry) => entry.id === plannedSessionId);
        if (!source) return;
        const timestamp = nowISO();

        set((current) => ({
          plannedSessions: [
            ...current.plannedSessions.map((entry) =>
              entry.id === plannedSessionId
                ? { ...entry, status: 'rescheduled' as const, rescheduledToDate: toDate, updatedAt: timestamp }
                : entry.date === toDate && entry.status === 'rest'
                  ? { ...entry, status: 'rescheduled' as const, updatedAt: timestamp }
                  : entry,
            ),
            {
              id: createId(),
              date: toDate,
              routineId: source.routineId,
              routineDayId: source.routineDayId,
              status: 'planned' as const,
              sessionId: null,
              rescheduledToDate: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        }));
        track({ name: 'workout_rescheduled', days: daysBetween(source.date, toDate) });
      },

      /**
       * Switches eating strategy at any point. The running phase is closed at
       * today's weight and a new one opens — nothing already logged is touched,
       * so every projection continues from the progress already made rather
       * than restarting.
       */
      changeStrategy: (strategy, options = {}) => {
        const state = get();
        const date = todayOf();
        const timestamp = nowISO();
        const latestWeight =
          [...state.bodyMeasurements].sort((a, b) => (a.date < b.date ? -1 : 1)).pop()?.weightKg ?? null;

        const targetWeightKg =
          options.targetWeightKg === undefined ? state.goal?.targetWeightKg ?? null : options.targetWeightKg;

        const phases: PlanPhase[] = state.phases.map((phase) =>
          phase.endedAt === null
            ? { ...phase, endedAt: date, endWeightKg: latestWeight }
            : phase,
        );

        phases.push({
          id: createId(),
          strategy,
          startedAt: date,
          endedAt: null,
          startWeightKg: latestWeight ?? 0,
          endWeightKg: null,
          targetWeightKg,
          note: options.note ?? null,
          createdAt: timestamp,
        });

        set({
          phases,
          goal: state.goal
            ? { ...state.goal, strategy, targetWeightKg, updatedAt: timestamp }
            : state.goal,
        });
      },

      /**
       * Applies a plan chosen in the simulator. The user picks what they want
       * and how fast; frequency, strategy and schedule are derived here and
       * written in one go, with the previous phase closed rather than deleted.
       */
      applyPlanIntent: ({ objective, speed, fatTolerance, targetWeightKg, horizonWeeks }) => {
        const state = get();
        if (!state.profile) return;

        const date = todayOf();
        const latestWeight =
          [...state.bodyMeasurements].sort((a, b) => (a.date < b.date ? -1 : 1)).pop()?.weightKg ?? null;
        if (latestWeight === null) return;

        const rate = observedWeeklyRate(state.bodyMeasurements, date);
        const simulation = simulatePlan({
          today: date,
          objective,
          speed,
          fatTolerance,
          currentWeightKg: latestWeight,
          heightCm: state.profile.heightCm,
          age: state.profile.age ?? 30,
          sex: state.profile.sex,
          experience: state.profile.experience,
          targetWeightKg: targetWeightKg ?? state.goal?.targetWeightKg ?? null,
          horizonWeeks: horizonWeeks ?? state.goal?.horizonWeeks ?? 12,
          sessionsCompleted: state.sessions.filter((session) => session.status === 'completed').length,
          goalStartedAt: state.goal?.startedAt ?? date,
          observedWeeklyRateKg: rate.weeklyKg,
          weeksOfWeightData: rate.weeks,
          adherence: 1,
        });

        const strategyChanged = state.goal?.strategy !== simulation.strategy;
        const timestamp = nowISO();

        const phases: PlanPhase[] = strategyChanged
          ? [
              ...state.phases.map((phase) =>
                phase.endedAt === null ? { ...phase, endedAt: date, endWeightKg: latestWeight } : phase,
              ),
              {
                id: createId(),
                strategy: simulation.strategy,
                startedAt: date,
                endedAt: null,
                startWeightKg: latestWeight,
                endWeightKg: null,
                targetWeightKg: targetWeightKg ?? state.goal?.targetWeightKg ?? null,
                note: null,
                createdAt: timestamp,
              },
            ]
          : state.phases;

        set({
          phases,
          goal: state.goal
            ? {
                ...state.goal,
                objective,
                speed,
                fatTolerance,
                strategy: simulation.strategy,
                targetWeightKg: targetWeightKg ?? state.goal.targetWeightKg,
                horizonWeeks: horizonWeeks ?? state.goal.horizonWeeks,
                updatedAt: timestamp,
              }
            : state.goal,
        });

        // Frequency is an output of the pace, so the schedule follows it.
        if (simulation.daysPerWeek !== state.training.preferredDaysPerWeek) {
          get().updateTraining({
            preferredDaysPerWeek: simulation.daysPerWeek,
            minDaysPerWeek: Math.max(2, simulation.daysPerWeek - 1),
            preferredWeekdays: WEEKDAYS_FOR[simulation.daysPerWeek] ?? state.training.preferredWeekdays,
          });
        }
      },

      /**
       * Commits to a route: the first block becomes the running strategy, the
       * route is remembered so later blocks can take over when their time
       * comes, and the schedule follows what that block needs.
       */
      applyRoute: (routeId) => {
        const route: PlanRoute | undefined = getRoute(routeId);
        const state = get();
        if (!route || !state.goal) return;

        const date = todayOf();
        const first = route.blocks[0];
        set({ planRoute: { routeId, startedAt: date } });
        get().changeStrategy(first.strategy, { note: `${route.name} · ${first.label}` });
        get().updateTraining({
          preferredDaysPerWeek: DAYS_FOR_STRATEGY[first.strategy],
          preferredWeekdays:
            WEEKDAYS_FOR[DAYS_FOR_STRATEGY[first.strategy]] ?? state.training.preferredWeekdays,
        });
      },

      /**
       * Same as adopting a named route, except the blocks travel with the
       * plan instead of pointing at a catalogue entry — so editing the
       * built-in routes later cannot silently rewrite what someone built.
       */
      applyCustomPlan: (blocks) => {
        const state = get();
        if (blocks.length === 0 || !state.goal) return;

        const date = todayOf();
        const first = blocks[0];

        set({
          planRoute: {
            routeId: 'custom',
            startedAt: date,
            name: 'Your plan',
            blocks: blocks.map((block) => ({
              strategy: block.strategy,
              weeks: block.weeks,
              label: strategyProfile(block.strategy).label,
            })),
          },
        });

        get().changeStrategy(first.strategy, { note: 'Your plan' });
        get().updateTraining({
          preferredDaysPerWeek: DAYS_FOR_STRATEGY[first.strategy],
          preferredWeekdays:
            WEEKDAYS_FOR[DAYS_FOR_STRATEGY[first.strategy]] ?? state.training.preferredWeekdays,
        });
        track({ name: 'plan_reconfigured', reason: 'custom' });
      },

      /** Moves to the next block of the running route, once its time is up. */
      advanceRouteBlock: (strategy) => {
        const state = get();
        get().changeStrategy(strategy, { note: 'Next block of your plan' });
        get().updateTraining({
          preferredDaysPerWeek: DAYS_FOR_STRATEGY[strategy],
          preferredWeekdays: WEEKDAYS_FOR[DAYS_FOR_STRATEGY[strategy]] ?? state.training.preferredWeekdays,
        });
      },

      applyHealthSync: ({ weights, sleep }) => {
        const timestamp = nowISO();
        set((state) => {
          const byDate = new Map(state.bodyMeasurements.map((entry) => [entry.date, entry]));
          for (const entry of weights) byDate.set(entry.date, entry);

          const checkinByDate = new Map(state.checkins.map((entry) => [entry.date, entry]));
          for (const entry of sleep) {
            const existing = checkinByDate.get(entry.date);
            if (existing) {
              // Only fills a gap; a value the user typed is never replaced.
              if (existing.sleepHours === null) {
                checkinByDate.set(entry.date, {
                  ...existing,
                  sleepHours: entry.hours,
                  updatedAt: timestamp,
                });
              }
            } else {
              checkinByDate.set(entry.date, {
                id: createId(),
                date: entry.date,
                sleepHours: entry.hours,
                sleepQuality: null,
                energy: null,
                soreness: null,
                stress: null,
                motivation: null,
                source: 'apple_watch',
                createdAt: timestamp,
                updatedAt: timestamp,
              });
            }
          }

          return {
            bodyMeasurements: [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
            checkins: [...checkinByDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
          };
        });
      },

      /**
       * Picking muscles rewrites the live routine rather than waiting for the
       * next regeneration — the user changed something and expects the app to
       * be different when they look at it.
       */
      setMuscleFocus: (muscles) => {
        const state = get();
        if (!state.goal) return;

        set({ goal: { ...state.goal, muscleFocus: muscles, updatedAt: nowISO() } });

        const routine = state.routines.find((entry) => entry.id === state.activeRoutineId) ?? null;
        if (!routine || !state.profile) return;

        // Rebuild from the balanced template so switching focus does not
        // accumulate sets from every previous choice.
        const base = buildInitialRoutine({
          daysPerWeek: state.training.preferredDaysPerWeek,
          sessionMinutes: state.training.sessionMinutes,
          location: state.training.location,
          goalType: state.goal.type,
          layoffWeeks: state.profile.layoffWeeks,
        });
        const emphasised = applyEmphasis(base, muscles, equipmentOf(state)).routine;
        const next: Routine = { ...emphasised, id: routine.id, createdAt: routine.createdAt, updatedAt: nowISO() };

        set((current) => ({
          routines: current.routines.map((entry) => (entry.id === routine.id ? next : entry)),
        }));
        track({ name: 'muscle_focus_set', count: muscles.length });
      },

      /**
       * The plan changes to fit the person, not the other way round.
       *
       * A frequency the user is not hitting is not lowered on its own — the
       * pace that requires it is. Otherwise the app would show a five-day
       * plan's dates next to a three-day schedule, which is the exact lie
       * this is meant to stop.
       */
      applyVerdictAction: (action) => {
        const state = get();
        if (!state.goal) return;

        const objective = state.goal.objective;

        if (action.kind === 'lower_frequency' || action.kind === 'raise_frequency') {
          const target = action.kind === 'lower_frequency' ? action.toSessions : action.toSessions;
          // The fastest pace whose demand this frequency actually covers.
          const affordable = [...SPEEDS]
            .reverse()
            .find((speed) => requiredSessionsPerWeek(objective, speed) <= target);
          const speed = affordable ?? SPEEDS[0];

          get().applyPlanIntent({
            objective,
            speed,
            fatTolerance: state.goal.fatTolerance,
            targetWeightKg: state.goal.targetWeightKg,
            horizonWeeks: state.goal.horizonWeeks,
          });
          track({ name: 'plan_reconfigured', reason: action.kind });
          return;
        }

        if (action.kind === 'accelerate') {
          get().applyPlanIntent({
            objective,
            speed: action.toSpeed,
            fatTolerance: state.goal.fatTolerance,
            targetWeightKg: state.goal.targetWeightKg,
            horizonWeeks: state.goal.horizonWeeks,
          });
          track({ name: 'plan_reconfigured', reason: 'accelerate' });
        }
        // `log_more` asks the user for something; there is no state to change.
      },

      applyProposal: (proposal) => {
        const change = proposal.change;

        switch (change.type) {
          case 'training_weekdays':
            set((state) => ({
              training: { ...state.training, preferredWeekdays: change.weekdays },
              plannedSessions: keepPastAndResolved(state.plannedSessions, todayOf()),
            }));
            get().ensurePlan();
            break;

          case 'days_per_week':
            set((state) => ({
              training: {
                ...state.training,
                preferredDaysPerWeek: change.days,
                preferredWeekdays: WEEKDAYS_FOR[change.days] ?? state.training.preferredWeekdays,
              },
              plannedSessions: keepPastAndResolved(state.plannedSessions, todayOf()),
            }));
            get().regenerateRoutine();
            break;

          case 'session_minutes':
            set((state) => ({ training: { ...state.training, sessionMinutes: change.minutes } }));
            break;

          case 'rest_seconds':
            set((state) => ({
              preferences: { ...state.preferences, defaultRestSeconds: change.seconds },
            }));
            break;

          case 'drop_exercise':
            set((state) => ({
              routines: state.routines.map((routine) => ({
                ...routine,
                updatedAt: nowISO(),
                days: routine.days.map((day) => ({
                  ...day,
                  exercises: reindex(
                    day.exercises.filter((entry) => entry.exerciseId !== change.exerciseId),
                  ),
                })),
              })),
            }));
            break;
        }

        set((state) => ({ appliedProposals: [...state.appliedProposals, proposal.id] }));
        track({ name: 'proposal_applied', proposal: proposal.id });
      },

      dismissProposal: (id) =>
        set((state) => ({ appliedProposals: [...state.appliedProposals, id] })),

      persistBaseline: (baseline) => set({ comebackBaseline: baseline }),

      /**
       * Development seed: the initial profile with editable values, plus four
       * weeks of plausible history so the models have something to chew on.
       * Everything it writes behaves exactly like user-entered data.
       */
      seedDeveloperProfile: () => {
        const timestamp = nowISO();
        const date = todayOf();

        const payload: OnboardingPayload = {
          name: 'Ignacio',
          heightCm: 186,
          weightKg: 77.25,
          experience: 'returning',
          layoffWeeks: 6,
          goalType: 'recomposition',
          objective: 'recomp',
          speed: 'steady',
          fatTolerance: 'some',
          targetWeightKg: 80,
          horizonWeeks: 16,
          daysPerWeek: 5,
          sessionMinutes: 60,
          preferredWeekdays: [1, 2, 3, 5, 6],
          location: 'gym',
          checkin: { sleepHours: 7.5, sleepQuality: 4, energy: 4, soreness: 2, stress: 2, motivation: 4 },
          lastWorkoutDate: null,
          limitations: null,
        };

        get().completeOnboarding(payload);
        get().updateGoal({ proteinTargetG: 165 });

        // Four weeks of history, three sessions a week, slowly progressing.
        const routine = get().routines[0];
        const seededSessions: WorkoutSession[] = [];
        const seededCheckins: DailyCheckin[] = [];
        const seededWeights: BodyMeasurement[] = [];

        for (let dayOffset = 28; dayOffset >= 1; dayOffset -= 1) {
          const day = addDays(date, -dayOffset);
          const weekday = weekdayOf(day);
          seededCheckins.push({
            id: createId(),
            date: day,
            sleepHours: 6.5 + ((dayOffset % 4) * 0.4),
            sleepQuality: 3 + (dayOffset % 2),
            energy: 3 + (dayOffset % 3 === 0 ? 1 : 0),
            soreness: 2 + (dayOffset % 3 === 0 ? 1 : 0),
            stress: 2,
            motivation: 4,
            source: 'manual',
            createdAt: timestamp,
            updatedAt: timestamp,
          });

          if (dayOffset % 7 === 0) {
            seededWeights.push({
              id: createId(),
              date: day,
              weightKg: 76.4 + (28 - dayOffset) * 0.02,
              bodyFatPercent: null,
              source: 'manual',
              createdAt: timestamp,
            });
          }

          if (![1, 3, 5].includes(weekday)) continue;

          const routineDay = routine.days[seededSessions.length % routine.days.length];
          const progression = 1 + (28 - dayOffset) * 0.004;
          seededSessions.push({
            id: createId(),
            date: day,
            startedAt: `${day}T18:00:00.000Z`,
            endedAt: `${day}T19:05:00.000Z`,
            name: routineDay.name,
            routineId: routine.id,
            routineDayId: routineDay.id,
            plannedSessionId: null,
            intent: 'full',
            status: 'completed',
            notes: null,
            pauses: [],
            exercises: routineDay.exercises.slice(0, 4).map((exercise, index) => ({
              id: createId(),
              exerciseId: exercise.exerciseId,
              order: index,
              substitutedFrom: null,
              note: null,
              skipped: false,
              sets: Array.from({ length: exercise.sets }, (_, setIndex) => ({
                id: createId(),
                order: setIndex,
                weightKg: Math.round(((index === 0 ? 70 : 30) * progression) / 2.5) * 2.5,
                reps: exercise.repMin + 1,
                rir: 2,
                warmup: false,
                completed: true,
                completedAt: `${day}T18:${20 + setIndex}:00.000Z`,
              })),
            })),
          });
        }

        set((state) => ({
          sessions: seededSessions,
          checkins: [...seededCheckins, ...state.checkins],
          bodyMeasurements: [...seededWeights, ...state.bodyMeasurements],
        }));
      },

      resetAll: () => set({ ...initialState, hydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => asyncStorageAdapter),
      version: 5,
      /**
       * State written by an older build is missing the fields added since, and
       * a screen reading `STRATEGIES[goal.strategy]` on an undefined strategy
       * crashes the whole app. Every new field is backfilled here.
       */
      migrate: (persisted, fromVersion) => {
        const state = persisted as Partial<AppState> | undefined;
        if (!state) return initialState;

        /**
         * v4 repairs the goal rather than adding to it.
         *
         * A goal that reached a device without `objective` or `speed` took the
         * app down on launch, and no earlier migration will run again to fix
         * it — so this one runs over every stored goal whatever version wrote
         * it, and normalises the fields the engine indexes tables with.
         */
        const repair = (value: Partial<AppState>): AppState =>
          ({
            ...value,
            schemaVersion: 5,
            appliedProposals: value.appliedProposals ?? [],
            goal: value.goal
              ? {
                  ...value.goal,
                  muscleFocus: value.goal.muscleFocus ?? [],
                  objective: asObjective(value.goal.objective),
                  speed: asSpeed(value.goal.speed),
                  fatTolerance: value.goal.fatTolerance ?? 'some',
                  strategy: value.goal.strategy ?? defaultStrategyFor(value.goal.type),
                }
              : value.goal,
            sessions: (value.sessions ?? []).map((session) => ({
              ...session,
              // v5 added deliberate pauses and per-exercise skipping.
              pauses: session.pauses ?? [],
              exercises: (session.exercises ?? []).map((exercise) => ({
                ...exercise,
                skipped: exercise.skipped ?? false,
              })),
            })),
          }) as AppState;

        if (fromVersion >= 2) return repair(state);

        const strategy =
          state.goal?.strategy ?? (state.goal ? defaultStrategyFor(state.goal.type) : 'maintain');

        const startWeightKg =
          [...(state.bodyMeasurements ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1))[0]?.weightKg ?? 0;

        return repair({
          ...state,
          profile: state.profile
            ? { ...state.profile, age: state.profile.age ?? null, sex: state.profile.sex ?? 'unspecified' }
            : state.profile,
          goal: state.goal
            ? {
                ...state.goal,
                strategy,
                objective:
                  state.goal.objective ??
                  (state.goal.type === 'lose_fat'
                    ? 'lean'
                    : state.goal.type === 'recomposition'
                      ? 'recomp'
                      : 'build'),
                speed: state.goal.speed ?? 'steady',
                fatTolerance: state.goal.fatTolerance ?? 'some',
              }
            : state.goal,
          phases:
            state.phases && state.phases.length > 0
              ? state.phases
              : state.goal
                ? [
                    {
                      id: createId(),
                      strategy,
                      startedAt: state.goal.startedAt,
                      endedAt: null,
                      startWeightKg,
                      endWeightKg: null,
                      targetWeightKg: state.goal.targetWeightKg ?? null,
                      note: null,
                      createdAt: nowISO(),
                    },
                  ]
                : [],
        } as AppState);
      },
      // `hydrated` is runtime-only; everything else is persisted.
      partialize: ({ hydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state, error) => {
        // Flip the gate through the store rather than the callback argument:
        // on a read error `state` is undefined, and the app would otherwise
        // wait forever on a screen that never changes.
        useAppStore.setState({ hydrated: true });
        if (error) {
          console.warn('[comeback] could not read stored data', error);
          return;
        }
        // Keep the plan rolling forward every time the app opens.
        state?.ensurePlan();
      },
    },
  ),
);

/** Runs the models over the current state. Pure with respect to the store. */
export function selectEngine(state: AppState) {
  return runEngine({
    today: todayOf(),
    sessions: state.sessions,
    plannedSessions: state.plannedSessions,
    checkins: state.checkins,
    training: state.training,
    routines: state.routines,
    activeRoutineId: state.activeRoutineId,
    goal: state.goal,
    profile: state.profile,
    planRoute: state.planRoute,
    bodyMeasurements: state.bodyMeasurements,
    baseline: state.comebackBaseline,
    weekStartsOn: state.preferences.weekStartsOn,
    defaultRestSeconds: state.preferences.defaultRestSeconds,
  });
}

export { startOfWeek };
