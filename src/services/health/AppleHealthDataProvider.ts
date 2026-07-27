import type { ISODate } from '@/domain/types';
import { toISODate } from '@/utils/date';
import { round } from '@/utils/math';
import {
  type ActivitySample,
  type BodyCompositionSample,
  type CardiovascularSample,
  type HealthDataProvider,
  type SleepSample,
  type WorkoutSample,
} from './HealthDataProvider';
import { READ_TYPES, isHealthKitLinked, loadHealthKit } from './native/appleHealth';

/**
 * Apple Health, behind the same interface as manual entry.
 *
 * Renpho writes body weight and body fat into Apple Health, and the Watch
 * writes sleep, steps, heart rate, HRV and workouts. Reading from Health is
 * therefore how both arrive — no Renpho account, no separate integration.
 *
 * Every value keeps `apple_health` or `apple_watch` as its source, so imported
 * numbers stay distinguishable from the ones the user typed, and correctable.
 */

function toDate(value: string): ISODate {
  return toISODate(new Date(value));
}

/** Groups samples by calendar day and reduces each day to one number. */
function byDay<T>(
  samples: { startDate: string; value: number }[],
  reduce: (values: number[]) => number,
): { date: ISODate; value: T extends never ? number : number }[] {
  const buckets = new Map<ISODate, number[]>();
  for (const sample of samples) {
    const date = toDate(sample.startDate);
    buckets.set(date, [...(buckets.get(date) ?? []), sample.value]);
  }
  return [...buckets.entries()].map(([date, values]) => ({ date, value: reduce(values) as never }));
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: number[]) => (values.length === 0 ? 0 : sum(values) / values.length);
const latest = (values: number[]) => values[values.length - 1] ?? 0;

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

  const range = (from: ISODate, to: ISODate) => ({
    from: new Date(`${from}T00:00:00`),
    to: new Date(`${to}T23:59:59`),
  });

  return {
    id: 'apple_health',
    label: 'Apple Health',
    capabilities: ['sleep', 'bodyComposition', 'cardiovascular', 'workouts', 'activity'],

    async isAvailable() {
      return guard((native) => native.isHealthDataAvailable(), false);
    },

    async requestPermissions() {
      return guard((native) => native.requestAuthorization(READ_TYPES), false);
    },

    async getSleep(from, to) {
      return guard<SleepSample[]>(async (native) => {
        if (!native.queryCategorySamples) return [];
        const samples = await native.queryCategorySamples(
          'HKCategoryTypeIdentifierSleepAnalysis',
          range(from, to),
        );
        // Asleep states only; "in bed" overstates how much you actually slept.
        const asleep = samples.filter((sample) => sample.value >= 1);
        const hoursByDay = new Map<ISODate, number>();
        for (const sample of asleep) {
          const hours =
            (new Date(sample.endDate).getTime() - new Date(sample.startDate).getTime()) / 3_600_000;
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
          native.queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', range(from, to)),
          native.queryQuantitySamples('HKQuantityTypeIdentifierBodyFatPercentage', range(from, to)),
        ]);

        const fatByDay = new Map(
          byDay(
            fats.map((sample) => ({ startDate: sample.startDate, value: sample.quantity })),
            latest,
          ).map((entry) => [entry.date, entry.value]),
        );

        return byDay(
          weights.map((sample) => ({ startDate: sample.startDate, value: sample.quantity })),
          latest,
        ).map((entry) => ({
          date: entry.date,
          weightKg: round(entry.value, 2),
          bodyFatPercent:
            fatByDay.get(entry.date) === undefined
              ? null
              : // HealthKit stores the percentage as a fraction.
                round((fatByDay.get(entry.date) as number) * 100, 1),
          // Renpho and other scales write here; Health is the transport.
          source: 'renpho' as const,
        }));
      }, []);
    },

    async getCardiovascular(from, to) {
      return guard<CardiovascularSample[]>(async (native) => {
        const [resting, hrv] = await Promise.all([
          native.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', range(from, to)),
          native.queryQuantitySamples(
            'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
            range(from, to),
          ),
        ]);

        const hrvByDay = new Map(
          byDay(
            hrv.map((sample) => ({ startDate: sample.startDate, value: sample.quantity })),
            mean,
          ).map((entry) => [entry.date, entry.value]),
        );

        return byDay(
          resting.map((sample) => ({ startDate: sample.startDate, value: sample.quantity })),
          mean,
        ).map((entry) => ({
          date: entry.date,
          restingHeartRate: Math.round(entry.value),
          hrvMs: hrvByDay.get(entry.date) === undefined ? null : Math.round(hrvByDay.get(entry.date) as number),
          source: 'apple_watch' as const,
        }));
      }, []);
    },

    async getWorkouts(from, to) {
      return guard<WorkoutSample[]>(async (native) => {
        const workouts = await native.queryWorkoutSamples(range(from, to));
        return workouts.map((workout) => ({
          date: toDate(workout.startDate),
          startedAt: workout.startDate,
          endedAt: workout.endDate,
          activeEnergyKcal: workout.totalEnergyBurned
            ? Math.round(workout.totalEnergyBurned.quantity)
            : null,
          averageHeartRate: null,
          maxHeartRate: null,
          source: 'apple_watch' as const,
        }));
      }, []);
    },

    async getActivity(from, to) {
      return guard<ActivitySample[]>(async (native) => {
        const [steps, energy, exercise] = await Promise.all([
          native.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', range(from, to)),
          native.queryQuantitySamples('HKQuantityTypeIdentifierActiveEnergyBurned', range(from, to)),
          native.queryQuantitySamples('HKQuantityTypeIdentifierAppleExerciseTime', range(from, to)),
        ]);

        const energyByDay = new Map(
          byDay(
            energy.map((sample) => ({ startDate: sample.startDate, value: sample.quantity })),
            sum,
          ).map((entry) => [entry.date, entry.value]),
        );
        const exerciseByDay = new Map(
          byDay(
            exercise.map((sample) => ({ startDate: sample.startDate, value: sample.quantity })),
            sum,
          ).map((entry) => [entry.date, entry.value]),
        );

        return byDay(
          steps.map((sample) => ({ startDate: sample.startDate, value: sample.quantity })),
          sum,
        ).map((entry) => ({
          date: entry.date,
          steps: Math.round(entry.value),
          activeEnergyKcal: energyByDay.has(entry.date)
            ? Math.round(energyByDay.get(entry.date) as number)
            : null,
          exerciseMinutes: exerciseByDay.has(entry.date)
            ? Math.round(exerciseByDay.get(entry.date) as number)
            : null,
          standHours: null,
          source: 'apple_health' as const,
        }));
      }, []);
    },
  };
}

/** Whether this build can talk to Apple Health at all. */
export function appleHealthStatus(): 'ready' | 'needs_build' {
  return isHealthKitLinked() ? 'ready' : 'needs_build';
}
