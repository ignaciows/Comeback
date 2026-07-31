import type { ISODate } from '@/domain/types';
import { addDays, daysBetween, weekdayOf } from '@/utils/date';

/**
 * This week, replanned every time a day goes by.
 *
 * A weekly target is a promise made on Sunday, and by Wednesday it is usually
 * wrong. Most apps handle that by leaving the original number on screen going
 * red — which tells someone they have failed on day three of seven and gives
 * them nothing to do about it.
 *
 * This does the other thing. Every missed day triggers a rearrangement of the
 * days that are left, and the answer is always a concrete plan rather than a
 * verdict: *five is still on, it just means Wednesday, Thursday, Friday and
 * Saturday now*. When five genuinely stops fitting, it says four, and says
 * why. The number moves; the week never becomes unwinnable.
 *
 * The one thing it will not do is pretend. Two sessions cannot happen on the
 * same day, so when the remaining days cannot hold the remaining sessions the
 * target comes down instead of the plan quietly asking for the impossible.
 */

export type DayState = 'done' | 'missed' | 'today' | 'planned' | 'rest';

export type WeekDay = {
  date: ISODate;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  state: DayState;
  /** Set when this day is a training day. */
  routineDayId: string | null;
};

export type WeekPlan = {
  days: WeekDay[];
  /** Sessions the plan originally asked for this week. */
  target: number;
  done: number;
  /** What is still reachable, which may be less than the target. */
  revisedTarget: number;
  /** Sessions left to do under the revised target. */
  remaining: number;
  /** Calendar days left, counting today. */
  daysLeft: number;
  /** False once the original target can no longer fit in the days that remain. */
  onTrack: boolean;
  headline: string;
  detail: string;
};

export type WeekInput = {
  today: ISODate;
  /** Monday of the week being planned. */
  weekStart: ISODate;
  /** Sessions the plan asks for. */
  target: number;
  /** Dates in this week with a completed session. */
  completedDates: ISODate[];
  /** The weekdays the plan would prefer, 0–6. */
  preferredWeekdays: number[];
  /** Routine days to cycle through, in order. */
  routineDayIds: string[];
};

const WEEK = 7;

export function replanWeek(input: WeekInput): WeekPlan {
  const dates = Array.from({ length: WEEK }, (_, offset) => addDays(input.weekStart, offset));
  const completed = new Set(input.completedDates);

  const todayIndex = clampIndex(daysBetween(input.weekStart, input.today));
  const done = dates.filter((date) => completed.has(date)).length;
  const daysLeft = WEEK - todayIndex;

  /**
   * Capacity is the days from here that are still *free*, not the days on the
   * calendar. Training today and then counting today as somewhere a second
   * session could go is how a week ends up asking for two.
   */
  const freeDaysLeft = dates.filter((date, index) => index >= todayIndex && !completed.has(date)).length;

  const stillPossible = Math.min(Math.max(0, input.target - done), freeDaysLeft);
  const revisedTarget = done + stillPossible;
  const onTrack = revisedTarget >= input.target;

  /**
   * Which of the remaining days to train on.
   *
   * Preferred weekdays first — the plan's original shape is worth keeping
   * where it still fits — and then whatever else is needed, taken from the
   * end of the week so the days nearest today stay free for as long as
   * possible. Someone who has already missed Monday should not open the app
   * on Tuesday to find every remaining day booked.
   */
  const remainingIndexes = dates
    .map((_, index) => index)
    .filter((index) => index >= todayIndex && !completed.has(dates[index]));

  const preferred = remainingIndexes.filter((index) => input.preferredWeekdays.includes(weekdayOf(dates[index])));
  const rest = remainingIndexes.filter((index) => !preferred.includes(index));

  const chosen = new Set([...preferred, ...rest.reverse()].slice(0, stillPossible));

  let cycle = done;
  const days: WeekDay[] = dates.map((date, index) => {
    if (completed.has(date)) {
      return { date, weekday: weekdayOf(date), state: 'done', routineDayId: null };
    }

    if (index < todayIndex) {
      // A past day only counts as missed if it was one the plan asked for.
      const wanted = input.preferredWeekdays.includes(weekdayOf(date));
      return { date, weekday: weekdayOf(date), state: wanted ? 'missed' : 'rest', routineDayId: null };
    }

    if (!chosen.has(index)) {
      return { date, weekday: weekdayOf(date), state: 'rest', routineDayId: null };
    }

    const routineDayId = input.routineDayIds.length
      ? input.routineDayIds[cycle % input.routineDayIds.length]
      : null;
    cycle += 1;

    return {
      date,
      weekday: weekdayOf(date),
      state: index === todayIndex ? 'today' : 'planned',
      routineDayId,
    };
  });

  return {
    days,
    target: input.target,
    done,
    revisedTarget,
    remaining: stillPossible,
    daysLeft,
    onTrack,
    ...describe({
      target: input.target,
      done,
      revisedTarget,
      remaining: stillPossible,
      daysLeft: freeDaysLeft,
    }),
  };
}

function describe({
  target,
  done,
  revisedTarget,
  remaining,
  daysLeft,
}: {
  target: number;
  done: number;
  revisedTarget: number;
  remaining: number;
  daysLeft: number;
}): { headline: string; detail: string } {
  if (done >= target) {
    return {
      headline: 'This week is done',
      detail: `${done} of ${target}. Anything else is a bonus, not a debt.`,
    };
  }

  if (remaining === 0) {
    return {
      headline: 'That is the week',
      detail: `${done} of ${target}. Next week starts fresh — nothing carries over.`,
    };
  }

  if (revisedTarget < target) {
    return {
      headline: `${revisedTarget} this week, not ${target}`,
      detail: `${remaining} session${remaining === 1 ? '' : 's'} in the ${daysLeft} day${
        daysLeft === 1 ? '' : 's'
      } left is what fits. The plan adjusts rather than asking for the impossible.`,
    };
  }

  if (remaining === daysLeft) {
    return {
      headline: `Still ${target}, but it is every day now`,
      detail: `${remaining} session${
        remaining === 1 ? '' : 's'
      } and ${daysLeft} day${daysLeft === 1 ? '' : 's'} to fit them in. Doable, and there is no slack left.`,
    };
  }

  return {
    headline: `${remaining} to go this week`,
    detail: `${done} of ${target} done, ${daysLeft} days left. Here is where they land.`,
  };
}

function clampIndex(value: number): number {
  return Math.max(0, Math.min(WEEK - 1, value));
}
