import type { ImageSourcePropType } from 'react-native';

/**
 * The illustration for each lesson.
 *
 * Static requires, because Metro resolves image assets at build time — a
 * computed path silently yields nothing at runtime. Keyed by `Lesson.art`, and
 * a lesson whose key is missing simply renders without one rather than
 * crashing, which is the right failure for decoration.
 *
 * Flat, one accent, no text in the artwork itself: a diagram with words baked
 * into the pixels cannot be translated and cannot be read at small sizes.
 * Lessons whose subject is the reader's own body use live SVG instead — a
 * generic picture of a body is worse than a drawing of theirs.
 */
export const LESSON_ART: Record<string, ImageSourcePropType> = {
  fibres: require('../../../assets/lessons/fibres.png'),
  dose: require('../../../assets/lessons/dose.png'),
  recovery: require('../../../assets/lessons/recovery.png'),
  balance: require('../../../assets/lessons/balance.png'),
  protein: require('../../../assets/lessons/protein.png'),
  effort: require('../../../assets/lessons/effort.png'),
  overload: require('../../../assets/lessons/overload.png'),
};

export function artFor(key: string | null): ImageSourcePropType | null {
  if (!key) return null;
  return LESSON_ART[key] ?? null;
}
