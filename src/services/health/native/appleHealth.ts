/**
 * The one place the app touches a native HealthKit module.
 *
 * The package is loaded through a runtime require rather than a static import,
 * so a bundle built without it still starts and simply reports HealthKit as
 * unavailable. Everything above this file is ordinary TypeScript that needs no
 * native code to compile or run.
 *
 * The types below mirror @kingstinct/react-native-healthkit v14 rather than
 * describing it loosely: dates come back as `Date` objects, queries take a
 * `filter.date` range with an explicit `limit`, and authorization takes an
 * object rather than an array. Getting any of those wrong fails at runtime
 * inside a try/catch and reads as "no data" — which is indistinguishable from
 * a user who has not logged anything, so it is worth being exact.
 */

/** Units are passed explicitly so a reading never depends on device locale. */
export const UNITS = {
  bodyMass: 'kg',
  percent: '%',
  count: 'count',
  kcal: 'kcal',
  minute: 'min',
  countPerMinute: 'count/min',
  ms: 'ms',
  gram: 'g',
} as const;

type DateRange = { startDate: Date; endDate: Date };

type QuantitySample = {
  startDate: Date;
  endDate: Date;
  quantity: number;
  unit: string;
};

type CategorySample = {
  startDate: Date;
  endDate: Date;
  value: number;
};

type WorkoutSampleNative = {
  startDate: Date;
  endDate: Date;
  totalEnergyBurned?: { quantity: number } | null;
};

type NativeHealthKit = {
  /** Synchronous in v14; `isHealthDataAvailableAsync` is the promise form. */
  isHealthDataAvailable: () => boolean;
  isHealthDataAvailableAsync?: () => Promise<boolean>;
  requestAuthorization: (request: { toRead?: readonly string[]; toShare?: readonly string[] }) => Promise<boolean>;
  queryQuantitySamples: (
    identifier: string,
    options: { filter?: { date?: DateRange }; limit: number; unit?: string; ascending?: boolean },
  ) => Promise<readonly QuantitySample[]>;
  queryCategorySamples: (
    identifier: string,
    options: { filter?: { date?: DateRange }; limit: number; ascending?: boolean },
  ) => Promise<readonly CategorySample[]>;
  queryWorkoutSamples: (options: {
    filter?: { date?: DateRange };
    limit: number;
    ascending?: boolean;
  }) => Promise<readonly WorkoutSampleNative[]>;
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
    // The package exports the API both as named exports and as a default
    // object; prefer whichever actually carries the query functions.
    cached = (typeof loaded.queryQuantitySamples === 'function' ? loaded : (loaded.default ?? loaded)) as NativeHealthKit;
  } catch {
    cached = null;
  }
  return cached;
}

export function isHealthKitLinked(): boolean {
  return loadHealthKit() !== null;
}

/**
 * HKCategoryValueSleepAnalysis, by name.
 *
 * `awake` is 2, sitting *between* the asleep values, so a naive `value >= 1`
 * silently counts time awake in bed as sleep and overstates the night.
 */
export const SLEEP_VALUE = {
  inBed: 0,
  asleepUnspecified: 1,
  awake: 2,
  core: 3,
  deep: 4,
  rem: 5,
} as const;

export const ASLEEP_VALUES = new Set<number>([
  SLEEP_VALUE.asleepUnspecified,
  SLEEP_VALUE.core,
  SLEEP_VALUE.deep,
  SLEEP_VALUE.rem,
]);

/** Fetch every matching sample: HealthKit treats a non-positive limit as "all". */
export const NO_LIMIT = 0;

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
  // Written by MIKUY when a meal is logged; read here as the Fuel score's
  // nutrition signal.
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFatTotal',
];
