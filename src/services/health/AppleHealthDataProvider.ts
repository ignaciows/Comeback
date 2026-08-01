import type { ISODate } from '@/domain/types';
import { toISODate } from '@/utils/date';
import { round } from '@/utils/math';
import {
  type ActivitySample,
  type BodyCompositionSample,
  type CardiovascularSample,
  type HealthDataProvider,
  type NutritionSample,
  type SleepSample,
  type WorkoutSample,
} from './HealthDataProvider';
import { ASLEEP_VALUES, NO_LIMIT, READ_TYPES, UNITS, isHealthKitLinked, loadHealthKit } from './native/appleHealth';

/**
 * Apple Health, behind the same interface as manual entry.
 *
 * Renpho writes body weight and body fat into Apple Health, the Watch writes
 * sleep, steps, heart rate, HRV and workouts, and MIKUY writes what you ate.
 * Reading from Health is therefore how all three arrive — no separate account
 * to link for any of them.
 *
 * Every value keeps the source it really came from, so imported numbers stay
 * distinguishable from the ones the user typed, and correctable.
 */

function toDate(value: Date): ISODate {
  return toISODate(value);
}

/** Groups samples by calendar day and reduces each day to one number. */
function byDay(
  samples: readonly { startDate: Date; quantity: number }[],
  reduce: (values: number[]) => number,
): { date: ISODate; value: number }[] {
  const buckets = new Map<ISODate, number[]>();
  for (const sample of samples) {
    const date = toDate(sample.startDate);
    buckets.set(date, [...(buckets.get(date) ?? []), sample.quantity]);
  }
  return [...buckets.entries()].map(([date, values]) => ({ date, value: reduce(values) }));
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: number[]) => (values.length === 0 ? 0 : sum(values) / values.length);
const latest = (values: number[]) => values[values.length - 1] ?? 0;

function indexByDay(entries: { date: ISODate; value: number }[]): Map<ISODate, number> {
  return new Map(entries.map((entry) => [entry.date, entry.value]));
}

export function createAppleHealthDataProvider(): HealthDataProvider {
  const module = loadHealthKit();

  /**
   * Every read goes through here: it short-circuits when the native module is
   * absent, narrows the type for the callers, and turns a HealthKit failure
   * into an empty result rather than a crash mid-session.
   */
  const guard = async <T>(
    work: (native: NonNullable<typeof module>) => Promise<T>,
    fallback: T,
  ): Promise<T> => {
    if (!module) return fallback;
    try {
      return await work(module);
    } catch (error) {
      console.warn('[comeback] Apple Health read failed', error);
      return fallback;
    }
  };

  /** A whole-day range: HealthKit filters on instants, not calendar days. */
  const range = (from: ISODate, to: ISODate) => ({
    date: { startDate: new Date(`${from}T00:00:00`), endDate: new Date(`${to}T23:59:59`) },
  });

  return {
    id: 'apple_health',
    label: 'Apple Health',
    capabilities: ['sleep', 'bodyComposition', 'cardiovascular', 'workouts', 'activity', 'nutrition'],

    async isAvailable() {
      return guard(async (native) => native.isHealthDataAvailable(), false);
    },

    async requestPermissions() {
      return guard((native) => native.requestAuthorization({ toRead: READ_TYPES }), false);
    },

    async getSleep(from, to) {
      return guard<SleepSample[]>(async (native) => {
        const samples = await native.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
          filter: range(from, to),
          limit: NO_LIMIT,
        });

        // Only states that mean actually asleep; "in bed" and "awake" both
        // overstate the night.
        const asleep = samples.filter((sample) => ASLEEP_VALUES.has(sample.value));

        const hoursByDay = new Map<ISODate, number>();
        for (const sample of asleep) {
          const hours = (sample.endDate.getTime() - sample.startDate.getTime()) / 3_600_000;
          // Attributed to the day you woke up, so a night that crosses midnight
          // counts once, against the morning it belongs to.
          const date = toDate(sample.endDate);
          hoursByDay.set(date, (hoursByDay.get(date) ?? 0) + hours);
        }

        return [...hoursByDay.entries()].map(([date, hours]) => ({
          date,
          hours: round(hours, 1),
          quality: null,
          source: 'apple_watch' as const,
        }));
      }, []);
    },

    async getBodyComposition(from, to) {
      return guard<BodyCompositionSample[]>(async (native) => {
        const [weights, fats] = await Promise.all([
          native.queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', {
            filter: range(from, to),
            limit: NO_LIMIT,
            unit: UNITS.bodyMass,
          }),
          native.queryQuantitySamples('HKQuantityTypeIdentifierBodyFatPercentage', {
            filter: range(from, to),
            limit: NO_LIMIT,
            unit: UNITS.percent,
          }),
        ]);

        const fatByDay = indexByDay(byDay(fats, latest));

        return byDay(weights, latest).map((entry) => {
          const fat = fatByDay.get(entry.date);
          return {
            date: entry.date,
            weightKg: round(entry.value, 2),
            // Requested as '%', which HealthKit returns as a 0–1 fraction.
            bodyFatPercent: fat === undefined ? null : round(fat * 100, 1),
            // Renpho and other scales write here; Health is only the transport.
            source: 'renpho' as const,
          };
        });
      }, []);
    },

    async getCardiovascular(from, to) {
      return guard<CardiovascularSample[]>(async (native) => {
        const [resting, hrv] = await Promise.all([
          native.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
            filter: range(from, to),
            limit: NO_LIMIT,
            unit: UNITS.countPerMinute,
          }),
          native.queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', {
            filter: range(from, to),
            limit: NO_LIMIT,
            unit: UNITS.ms,
          }),
        ]);

        const hrvByDay = indexByDay(byDay(hrv, mean));

        return byDay(resting, mean).map((entry) => {
          const value = hrvByDay.get(entry.date);
          return {
            date: entry.date,
            restingHeartRate: Math.round(entry.value),
            hrvMs: value === undefined ? null : Math.round(value),
            source: 'apple_watch' as const,
          };
        });
      }, []);
    },

    async getWorkouts(from, to) {
      return guard<WorkoutSample[]>(async (native) => {
        const workouts = await native.queryWorkoutSamples({ filter: range(from, to), limit: NO_LIMIT });
        return workouts.map((workout) => ({
          date: toDate(workout.startDate),
          startedAt: workout.startDate.toISOString(),
          endedAt: workout.endDate.toISOString(),
          activeEnergyKcal: workout.totalEnergyBurned ? Math.round(workout.totalEnergyBurned.quantity) : null,
          averageHeartRate: null,
          maxHeartRate: null,
          source: 'apple_watch' as const,
        }));
      }, []);
    },

    async getActivity(from, to) {
      return guard<ActivitySample[]>(async (native) => {
        const [steps, energy, exercise] = await Promise.all([
          native.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
            filter: range(from, to),
            limit: NO_LIMIT,
            unit: UNITS.count,
          }),
          native.queryQuantitySamples('HKQuantityTypeIdentifierActiveEnergyBurned', {
            filter: range(from, to),
            limit: NO_LIMIT,
            unit: UNITS.kcal,
          }),
          native.queryQuantitySamples('HKQuantityTypeIdentifierAppleExerciseTime', {
            filter: range(from, to),
            limit: NO_LIMIT,
            unit: UNITS.minute,
          }),
        ]);

        const energyByDay = indexByDay(byDay(energy, sum));
        const exerciseByDay = indexByDay(byDay(exercise, sum));

        return byDay(steps, sum).map((entry) => {
          const kcal = energyByDay.get(entry.date);
          const minutes = exerciseByDay.get(entry.date);
          return {
            date: entry.date,
            steps: Math.round(entry.value),
            activeEnergyKcal: kcal === undefined ? null : Math.round(kcal),
            exerciseMinutes: minutes === undefined ? null : Math.round(minutes),
            standHours: null,
            source: 'apple_health' as const,
          };
        });
      }, []);
    },

    async getNutrition(from, to) {
      return guard<NutritionSample[]>(async (native) => {
        const [kcal, protein, carbs, fat] = await Promise.all([
          native.queryQuantitySamples('HKQuantityTypeIdentifierDietaryEnergyConsumed', {
            filter: range(from, to),
            limit: NO_LIMIT,
            unit: UNITS.kcal,
          }),
          native.queryQuantitySamples('HKQuantityTypeIdentifierDietaryProtein', {
            filter: range(from, to),
            limit: NO_LIMIT,
            unit: UNITS.gram,
          }),
          native.queryQuantitySamples('HKQuantityTypeIdentifierDietaryCarbohydrates', {
            filter: range(from, to),
            limit: NO_LIMIT,
            unit: UNITS.gram,
          }),
          native.queryQuantitySamples('HKQuantityTypeIdentifierDietaryFatTotal', {
            filter: range(from, to),
            limit: NO_LIMIT,
            unit: UNITS.gram,
          }),
        ]);

        // Every meal is its own sample, so a day is the sum of them — unlike
        // body weight, which is a point-in-time reading and takes the latest.
        const kcalByDay = indexByDay(byDay(kcal, sum));
        const proteinByDay = indexByDay(byDay(protein, sum));
        const carbsByDay = indexByDay(byDay(carbs, sum));
        const fatByDay = indexByDay(byDay(fat, sum));

        const dates = new Set([
          ...kcalByDay.keys(),
          ...proteinByDay.keys(),
          ...carbsByDay.keys(),
          ...fatByDay.keys(),
        ]);

        return [...dates].map((date) => {
          const energy = kcalByDay.get(date);
          const proteinG = proteinByDay.get(date);
          const carbsG = carbsByDay.get(date);
          const fatG = fatByDay.get(date);
          return {
            date,
            kcal: energy === undefined ? null : Math.round(energy),
            proteinG: proteinG === undefined ? null : round(proteinG, 1),
            carbsG: carbsG === undefined ? null : round(carbsG, 1),
            fatG: fatG === undefined ? null : round(fatG, 1),
            // MIKUY is the only writer of dietary samples today.
            source: 'mikuy' as const,
          };
        });
      }, []);
    },
  };
}

/** Whether this build can talk to Apple Health at all. */
export function appleHealthStatus(): 'ready' | 'needs_build' {
  return isHealthKitLinked() ? 'ready' : 'needs_build';
}
