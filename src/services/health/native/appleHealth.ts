/**
 * The one place the app touches a native HealthKit module.
 *
 * The package is loaded through a runtime require rather than a static import,
 * so a bundle built without it — Expo Go, for instance — still starts and
 * simply reports HealthKit as unavailable. Everything above this file is
 * ordinary TypeScript that needs no native code to compile or run.
 *
 * To turn it on:
 *   1. npx expo install @kingstinct/react-native-healthkit
 *   2. add its config plugin to app.json with the usage descriptions
 *   3. eas build --profile development --platform ios
 *
 * See docs/health-integration.md for the full walk-through.
 */

type NativeHealthKit = {
  isHealthDataAvailable: () => Promise<boolean>;
  requestAuthorization: (read: string[], write?: string[]) => Promise<boolean>;
  queryQuantitySamples: (
    identifier: string,
    options: { from: Date; to: Date },
  ) => Promise<{ startDate: string; endDate: string; quantity: number; sourceRevision?: { source?: { name?: string } } }[]>;
  queryWorkoutSamples: (options: {
    from: Date;
    to: Date;
  }) => Promise<
    {
      startDate: string;
      endDate: string;
      totalEnergyBurned?: { quantity: number };
      workoutActivityType?: number;
    }[]
  >;
  queryCategorySamples?: (
    identifier: string,
    options: { from: Date; to: Date },
  ) => Promise<{ startDate: string; endDate: string; value: number }[]>;
};

let cached: NativeHealthKit | null | undefined;

/** Returns the native module, or null when this build does not include it. */
export function loadHealthKit(): NativeHealthKit | null {
  if (cached !== undefined) return cached;
  try {
    // Indirect on purpose: a static import would make the bundle fail to
    // resolve when the package is not installed.
    const moduleName = '@kingstinct/react-native-healthkit';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loaded = (require as unknown as (name: string) => { default?: NativeHealthKit } & NativeHealthKit)(
      moduleName,
    );
    cached = (loaded.default ?? loaded) as NativeHealthKit;
  } catch {
    cached = null;
  }
  return cached;
}

export function isHealthKitLinked(): boolean {
  return loadHealthKit() !== null;
}

/** HealthKit identifiers the app reads. Nothing is ever written back. */
export const READ_TYPES = [
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
];
