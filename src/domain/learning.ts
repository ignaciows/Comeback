import { ALL_LESSONS, TRACKS, type Lesson, type Track } from '@/data/lessons';
import type { ISODate } from '@/domain/types';

/**
 * Where someone is in the learning material.
 *
 * Deliberately not a streak and not a score. The point of this section is that
 * a beginner stops being lost, and turning it into another thing to keep up
 * with would make it a source of guilt like every other app.
 *
 * So: lessons are either read or not, they stay read, and there is always
 * exactly one obvious next one. Nothing expires and nothing punishes you.
 */

export type LessonRecord = {
  lessonId: string;
  completedOn: ISODate;
  /** Whether the check was answered correctly first time. Never shown as a score. */
  gotItFirstTry: boolean;
};

export type TrackProgress = {
  track: Track;
  done: number;
  total: number;
  /** 0–1. */
  ratio: number;
  /** The lesson to open when you tap the track. Null when the track is done. */
  next: Lesson | null;
};

export function trackProgress(records: LessonRecord[]): TrackProgress[] {
  const done = new Set(records.map((entry) => entry.lessonId));

  return TRACKS.map((track) => {
    const completed = track.lessons.filter((lesson) => done.has(lesson.id)).length;
    return {
      track,
      done: completed,
      total: track.lessons.length,
      ratio: track.lessons.length === 0 ? 0 : completed / track.lessons.length,
      next: track.lessons.find((lesson) => !done.has(lesson.id)) ?? null,
    };
  });
}

/**
 * The single lesson to put in front of someone.
 *
 * Reading order, not difficulty order: the first unread lesson, walking the
 * tracks in the order they are written. One choice, never a menu.
 */
export function nextUnread(records: LessonRecord[]): { track: Track; lesson: Lesson } | null {
  const done = new Set(records.map((entry) => entry.lessonId));
  return ALL_LESSONS.find((entry) => !done.has(entry.lesson.id)) ?? null;
}

export type LearningSummary = {
  done: number;
  total: number;
  ratio: number;
  /** True once every lesson has been read. */
  finished: boolean;
  next: { track: Track; lesson: Lesson } | null;
};

export function learningSummary(records: LessonRecord[]): LearningSummary {
  // Records for lessons that no longer exist must not inflate the count, or a
  // renamed lesson would leave someone permanently at "13 of 12".
  const known = new Set(ALL_LESSONS.map((entry) => entry.lesson.id));
  const done = new Set(records.map((entry) => entry.lessonId).filter((id) => known.has(id)));
  const total = ALL_LESSONS.length;

  return {
    done: done.size,
    total,
    ratio: total === 0 ? 0 : done.size / total,
    finished: done.size >= total,
    next: nextUnread(records),
  };
}
