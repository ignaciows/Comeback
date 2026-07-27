import type { BodyMeasurement, DailyCheckin, ISODate } from '@/domain/types';
import { addDays, today as todayOf } from '@/utils/date';
import type { HealthDataProvider } from './HealthDataProvider';

/**
 * Pulling health data in.
 *
 * The rules that matter here are about trust, not plumbing:
 *  · A value the user typed is never overwritten by an imported one.
 *  · Every imported value keeps its real source, so it stays correctable.
 *  · Importing twice changes nothing — the same day is matched, not appended.
 *
 * This is written against the port, so it works with whichever provider is
 * registered and needs no change when Apple Health replaces manual entry.
 */

export type SyncResult = {
  weights: BodyMeasurement[];
  /** Only the sleep field is filled; the rest of the check-in stays the user's. */
  sleep: { date: ISODate; hours: number }[];
  imported: number;
  skipped: number;
};

export type SyncInput = {
  provider: HealthDataProvider;
  /** What is already stored, so nothing is duplicated or overwritten. */
  existingWeights: BodyMeasurement[];
  existingCheckins: DailyCheckin[];
  days?: number;
  today?: ISODate;
};

export async function syncHealthData({
  provider,
  existingWeights,
  existingCheckins,
  days = 30,
  today = todayOf(),
}: SyncInput): Promise<SyncResult> {
  const from = addDays(today, -days);

  const [composition, sleep] = await Promise.all([
    provider.getBodyComposition(from, today),
    provider.getSleep(from, today),
  ]);

  // A manual entry for a day wins: the user stood on the scale and typed it.
  const manualDates = new Set(
    existingWeights.filter((entry) => entry.source === 'manual').map((entry) => entry.date),
  );
  const existingByDate = new Map(existingWeights.map((entry) => [entry.date, entry]));

  const weights: BodyMeasurement[] = [];
  let skipped = 0;

  for (const sample of composition) {
    if (manualDates.has(sample.date)) {
      skipped += 1;
      continue;
    }
    const existing = existingByDate.get(sample.date);
    // Nothing changed since the last import: leave it alone.
    if (
      existing &&
      existing.weightKg === sample.weightKg &&
      existing.bodyFatPercent === sample.bodyFatPercent
    ) {
      skipped += 1;
      continue;
    }
    weights.push({
      id: existing?.id ?? `health-${sample.date}`,
      date: sample.date,
      weightKg: sample.weightKg,
      bodyFatPercent: sample.bodyFatPercent,
      source: sample.source,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  }

  // Sleep only fills the hours field, and only when the user left it empty.
  const checkinByDate = new Map(existingCheckins.map((entry) => [entry.date, entry]));
  const sleepUpdates = sleep
    .filter((sample) => {
      const existing = checkinByDate.get(sample.date);
      return !existing || existing.sleepHours === null;
    })
    .map((sample) => ({ date: sample.date, hours: sample.hours }));

  return {
    weights,
    sleep: sleepUpdates,
    imported: weights.length + sleepUpdates.length,
    skipped,
  };
}
