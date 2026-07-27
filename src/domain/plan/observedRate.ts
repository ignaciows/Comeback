import type { BodyMeasurement, ISODate } from '@/domain/types';
import { daysBetween } from '@/utils/date';
import { round } from '@/utils/math';

export type ObservedRate = {
  /** kg per week; null when there is not enough data to say. */
  weeklyKg: number | null;
  /** Weeks spanned by the data used. */
  weeks: number;
  points: number;
};

/**
 * The rate the user is actually moving at, from their own weight log.
 *
 * Least-squares slope rather than first-versus-last, so a single heavy morning
 * does not define the trend. Needs at least three entries spread over a week.
 */
export function observedWeeklyRate(
  measurements: BodyMeasurement[],
  today: ISODate,
  windowDays = 42,
): ObservedRate {
  const points = measurements
    .filter((entry) => {
      const age = daysBetween(entry.date, today);
      return age >= 0 && age <= windowDays;
    })
    .map((entry) => ({ x: -daysBetween(entry.date, today), y: entry.weightKg }))
    .sort((a, b) => a.x - b.x);

  if (points.length < 3) return { weeklyKg: null, weeks: 0, points: points.length };

  const span = points[points.length - 1].x - points[0].x;
  if (span < 7) return { weeklyKg: null, weeks: round(span / 7, 1), points: points.length };

  const n = points.length;
  const sumX = points.reduce((total, point) => total + point.x, 0);
  const sumY = points.reduce((total, point) => total + point.y, 0);
  const sumXY = points.reduce((total, point) => total + point.x * point.y, 0);
  const sumXX = points.reduce((total, point) => total + point.x * point.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { weeklyKg: null, weeks: round(span / 7, 1), points: n };

  const slopePerDay = (n * sumXY - sumX * sumY) / denominator;
  return {
    weeklyKg: round(slopePerDay * 7, 3),
    weeks: round(span / 7, 1),
    points: n,
  };
}
