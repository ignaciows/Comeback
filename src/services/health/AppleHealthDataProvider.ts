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
import { NO_LIMIT, READ_TYPES, SLEEP_VALUE, UNITS, isHealthKitLinked, loadHealthKit } from './native/appleHealth';

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

  /**
   * The same range, opened backwards for sleep.
   *
   * A night belongs to the morning you woke up, but it *starts* the evening
   * before — around 23:00, which is before midnight of the first day in the
   * window. HealthKit filters on instants, so with a plain range the earliest
   * night in every query came back clipped to whatever fell after midnight,
   * or missing entirely. On a chart that shows as a short first bar or a
   * hole, and it moved every time the window moved, which is what made it
   * look broken rather than wrong.
   *
   * Sixteen hours covers any plausible bedtime. Nights that turn out to
   * belong to a day before `from` are dropped after grouping.
   */
  const SLEEP_LOOKBACK_HOURS = 16;

  const sleepRange = (from: ISODate, to: ISODate) => {
    const startDate = new Date(`${from}T00:00:00`);
    startDate.setHours(startDate.getHours() - SLEEP_LOOKBACK_HOURS);
    return { date: { startDate, endDate: new Date(`${to}T23:59:59`) } };
  };

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
          filter: sleepRange(from, to),
          limit: NO_LIMIT,
        });

        type Night = { asleepMin: number; deepMin: number; remMin: number; coreMin: number; awakeMin: number };
        const nights = new Map<ISODate, Night>();
        const blank = (): Night => ({ asleepMin: 0, deepMin: 0, remMin: 0, coreMin: 0, awakeMin: 0 });

        for (const sample of samples) {
          // "In bed" overlaps the asleep samples, so counting it would double
          // the night. It is dropped rather than added anywhere.
          if (sample.value === SLEEP_VALUE.inBed) continue;

          const minutes = (sample.endDate.getTime() - sample.startDate.getTime()) / 60_000;
          if (!Number.isFinite(minutes) || minutes <= 0) continue;

          // Attributed to the day you woke up, so a night crossing midnight
          // counts once, against the morning it belongs to.
          const date = toDate(sample.endDate);
          const night = nights.get(date) ?? blank();

          if (sample.value === SLEEP_VALUE.awake) {
            night.awakeMin += minutes;
          } else {
            night.asleepMin += minutes;
            if (sample.value === SLEEP_VALUE.deep) night.deepMin += minutes;
            else if (sample.value === SLEEP_VALUE.rem) night.remMin += minutes;
            else if (sample.value === SLEEP_VALUE.core) night.coreMin += minutes;
          }
          nights.set(date, night);
        }

        return [...nights.entries()]
          // The widened query reaches into the evening before `from`; a night
          // that finished then belongs to a day outside the window.
          .filter(([date, night]) => night.asleepMin > 0 && date >= from)
          .map(([date, night]) => {
            // Only claim stages when the source actually broke them down; an
            // older watch reports `asleepUnspecified` for the whole night.
            const staged = night.deepMin + night.remMin + night.coreMin > 0;
            return {
              date,
              hours: round(night.asleepMin / 60, 1),
              // Quality is derived downstream, where the stage model lives.
              quality: null,
              stages: staged
                ? {
                    deepMin: Math.round(night.deepMin),
                    remMin: Math.round(night.remMin),
                    coreMin: Math.round(night.coreMin),
                  }
                : null,
              awakeMin: Math.round(night.awakeMin),
              source: 'apple_watch' as const,
            };
          });
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
