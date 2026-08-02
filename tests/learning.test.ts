import { describe, expect, it } from 'vitest';

import { ALL_LESSONS, TRACKS, findLesson, nextLesson } from '@/data/lessons';
import { TRAINING_PRINCIPLES } from '@/data/trainingPrinciples';
import { learningSummary, nextUnread, trackProgress, type LessonRecord } from '@/domain/learning';
import { SHAPE_IDS, hasDiagram, shapeFor } from '@/features/learn/diagramGeometry';

const read = (...ids: string[]): LessonRecord[] =>
  ids.map((lessonId) => ({ lessonId, completedOn: '2026-07-30', gotItFirstTry: true }));

describe('what to read next', () => {
  it('starts at the very first lesson when nothing has been read', () => {
    const next = nextUnread([]);

    expect(next?.lesson.id).toBe(ALL_LESSONS[0].lesson.id);
  });

  it('moves on once a lesson is read, and crosses into the next track', () => {
    const firstTrack = TRACKS[0];
    const allOfFirstTrack = read(...firstTrack.lessons.map((lesson) => lesson.id));

    expect(nextUnread(allOfFirstTrack)?.track.id).toBe(TRACKS[1].id);
  });

  it('returns nothing once everything is read, rather than looping', () => {
    const everything = read(...ALL_LESSONS.map((entry) => entry.lesson.id));

    expect(nextUnread(everything)).toBeNull();
    expect(learningSummary(everything).finished).toBe(true);
  });

  it('never counts past the total, even if a stored lesson no longer exists', () => {
    // A renamed or removed lesson must not leave someone stuck at "13 of 12".
    const withGhost = read(...ALL_LESSONS.map((entry) => entry.lesson.id), 'a_lesson_that_was_deleted');
    const summary = learningSummary(withGhost);

    expect(summary.done).toBe(summary.total);
    expect(summary.ratio).toBe(1);
  });

  it('reports progress per track without leaking between them', () => {
    const one = TRACKS[0].lessons[0].id;
    const progress = trackProgress(read(one));

    expect(progress[0].done).toBe(1);
    expect(progress[0].next?.id).toBe(TRACKS[0].lessons[1].id);
    expect(progress[1].done).toBe(0);
    expect(progress[1].next?.id).toBe(TRACKS[1].lessons[0].id);
  });

  it('has no next lesson for a track that is finished', () => {
    const done = read(...TRACKS[0].lessons.map((lesson) => lesson.id));

    expect(trackProgress(done)[0].next).toBeNull();
    expect(trackProgress(done)[0].ratio).toBe(1);
  });
});

describe('the material itself', () => {
  it('gives every lesson a unique id', () => {
    const ids = ALL_LESSONS.map((entry) => entry.lesson.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('can look a lesson up and walk to the one after it', () => {
    const first = ALL_LESSONS[0].lesson.id;

    expect(findLesson(first)?.lesson.id).toBe(first);
    expect(nextLesson(first)?.lesson.id).toBe(ALL_LESSONS[1].lesson.id);
    expect(nextLesson(ALL_LESSONS.at(-1)!.lesson.id)).toBeNull();
    expect(findLesson('nope')).toBeNull();
  });

  it('keeps every card short enough to read while walking', () => {
    for (const { lesson } of ALL_LESSONS) {
      for (const card of lesson.cards) {
        const words = card.text.trim().split(/\s+/).length;
        expect(words, `"${card.text}" in ${lesson.id}`).toBeLessThanOrEqual(20);
      }
    }
  });

  it('points every check at a real option and explains itself', () => {
    for (const { lesson } of ALL_LESSONS) {
      const { check } = lesson;
      expect(check.options.length, lesson.id).toBeGreaterThanOrEqual(3);
      expect(check.answer, lesson.id).toBeGreaterThanOrEqual(0);
      expect(check.answer, lesson.id).toBeLessThan(check.options.length);
      // The explanation is the actual teaching moment, so it cannot be a stub.
      expect(check.because.length, lesson.id).toBeGreaterThan(30);
      expect(new Set(check.options).size, `duplicate options in ${lesson.id}`).toBe(check.options.length);
    }
  });

  it('sources every lesson', () => {
    for (const { lesson } of ALL_LESSONS) {
      expect(lesson.source.length, lesson.id).toBeGreaterThan(8);
    }
  });

  it('teaches the same numbers the plan is actually built from', () => {
    // The failure this guards against is the app explaining one rule on the
    // learning screen and applying a different one in the routine builder.
    const principles = TRAINING_PRINCIPLES.map((entry) => `${entry.title} ${entry.detail}`).join(' ');

    expect(principles).toMatch(/10.20 hard sets/i);
    expect(ALL_LESSONS.find((entry) => entry.lesson.id === 'dose')?.lesson.takeaway).toMatch(/ten to twenty/i);

    expect(principles).toMatch(/1\.6.2\.2 g of protein/i);
    expect(ALL_LESSONS.find((entry) => entry.lesson.id === 'protein')?.lesson.cards.some((card) =>
      /1\.6 to 2\.2/.test(card.text),
    )).toBe(true);
  });

  it('never blames the reader', () => {
    // Same rule the rest of the copy follows: second-person blame is out.
    const scolding = /you (should have|failed|didn't bother|are lazy|never)|you're not trying/i;

    for (const { lesson } of ALL_LESSONS) {
      const prose = [lesson.takeaway, lesson.check.because, ...lesson.cards.map((card) => card.text)].join(' ');
      expect(scolding.test(prose), `${lesson.id}: "${prose}"`).toBe(false);
    }
  });
});

/**
 * The two gaps that prompted this round of lessons.
 *
 * The rest of the format — id uniqueness, card length, checks, sources — is
 * already covered above. These assert the *coverage*: the app was asking
 * people to hit carb and fat targets whose purpose it had never explained,
 * and using "bulk" and "cut" as if everyone agreed what they meant.
 */
describe('the material covers what people actually ask', () => {
  it('explains each macro on its own, not just protein', () => {
    const ids = new Set(ALL_LESSONS.map((entry) => entry.lesson.id));

    expect(ids.has('protein')).toBe(true);
    expect(ids.has('carbs')).toBe(true);
    expect(ids.has('fat')).toBe(true);
  });

  it('defines bulking and cutting as rates, not vibes', () => {
    const bulk = ALL_LESSONS.find((entry) => entry.lesson.id === 'bulk')?.lesson;
    const cut = ALL_LESSONS.find((entry) => entry.lesson.id === 'cut')?.lesson;

    expect(bulk?.cards.some((card) => /0\.25 to 0\.5 percent/.test(card.text))).toBe(true);
    expect(cut?.cards.some((card) => /0\.5 to 1 percent/.test(card.text))).toBe(true);
  });
});

describe('lesson diagrams', () => {
  it('only draws for lessons that exist', () => {
    // A diagram keyed to a renamed or deleted lesson is dead weight that no
    // screen would ever surface, and nothing else would notice.
    const ids = new Set(ALL_LESSONS.map((entry) => entry.lesson.id));

    for (const key of SHAPE_IDS) {
      expect(ids.has(key), `diagram "${key}" has no lesson`).toBe(true);
    }
  });

  it('never gives a lesson both a PNG and a drawn diagram', () => {
    // The screen picks the PNG first, so the second one would silently never
    // render — a slow way to wonder why an edit did nothing.
    for (const { lesson } of ALL_LESSONS) {
      if (lesson.art) {
        expect(hasDiagram(lesson.id), `${lesson.id} has art and a diagram`).toBe(false);
      }
    }
  });

  it('keeps curve and bar values inside the plot area', () => {
    for (const key of SHAPE_IDS) {
      const shape = shapeFor(key);
      const values =
        shape?.kind === 'curve' ? shape.points : shape?.kind === 'bars' ? shape.values : [];

      for (const value of values) {
        expect(value, `${key}: ${value}`).toBeGreaterThanOrEqual(0);
        expect(value, `${key}: ${value}`).toBeLessThanOrEqual(1);
      }
    }
  });
});
