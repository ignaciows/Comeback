import type { BodyMeasurement, DataSource, ISODate } from '@/domain/types';

/**
 * Health data port.
 *
 * Today the only implementation reads what the user typed in. Apple Health,
 * Apple Watch and Renpho each become another implementation of this interface —
 * features consume the port, never a device SDK, so adding a source does not
 * touch the screens or the models.
 */

export type SleepSample = {
  date: ISODate;
  hours: number;
  /** 1–5 when the source can express it. */
  quality: number | null;
  source: DataSource;
};

export type BodyCompositionSample = {
  date: ISODate;
  weightKg: number;
  bodyFatPercent: number | null;
  source: DataSource;
};

export type CardiovascularSample = {
  date: ISODate;
  restingHeartRate: number | null;
  hrvMs: number | null;
  source: DataSource;
};

export type HealthCapability = 'sleep' | 'bodyComposition' | 'cardiovascular';

export interface HealthDataProvider {
  readonly id: DataSource;
  readonly label: string;
  /** What this provider can actually answer; the UI hides the rest. */
  readonly capabilities: HealthCapability[];
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  getSleep(from: ISODate, to: ISODate): Promise<SleepSample[]>;
  getBodyComposition(from: ISODate, to: ISODate): Promise<BodyCompositionSample[]>;
  getCardiovascular(from: ISODate, to: ISODate): Promise<CardiovascularSample[]>;
}

type ManualSources = {
  sleep: () => SleepSample[];
  bodyComposition: () => BodyMeasurement[];
};

function inRange(date: ISODate, from: ISODate, to: ISODate): boolean {
  return date >= from && date <= to;
}

/**
 * Reads the values the user entered by hand. This keeps the manual path and the
 * future device path behind exactly the same interface.
 */
export function createManualHealthDataProvider(sources: ManualSources): HealthDataProvider {
  return {
    id: 'manual',
    label: 'Manual entry',
    capabilities: ['sleep', 'bodyComposition'],
    async isAvailable() {
      return true;
    },
    async requestPermissions() {
      return true;
    },
    async getSleep(from, to) {
      return sources.sleep().filter((sample) => inRange(sample.date, from, to));
    },
    async getBodyComposition(from, to) {
      return sources
        .bodyComposition()
        .filter((sample) => inRange(sample.date, from, to))
        .map((measurement) => ({
          date: measurement.date,
          weightKg: measurement.weightKg,
          bodyFatPercent: measurement.bodyFatPercent,
          source: measurement.source,
        }));
    },
    async getCardiovascular() {
      // Manual entry has no HRV or resting heart rate — an empty result is the
      // honest answer, not a zero.
      return [];
    },
  };
}

const providers = new Map<DataSource, HealthDataProvider>();

export function registerHealthProvider(provider: HealthDataProvider): void {
  providers.set(provider.id, provider);
}

export function getHealthProvider(id: DataSource): HealthDataProvider | undefined {
  return providers.get(id);
}

export function listHealthProviders(): HealthDataProvider[] {
  return [...providers.values()];
}

/** Sources the product intends to support, shown as pending in Profile. */
export const PLANNED_HEALTH_SOURCES: { id: DataSource; label: string; note: string }[] = [
  { id: 'apple_health', label: 'Apple Health', note: 'Sleep and body weight' },
  { id: 'apple_watch', label: 'Apple Watch', note: 'Sleep, heart rate, HRV' },
  { id: 'renpho', label: 'Renpho', note: 'Body weight and composition' },
];
