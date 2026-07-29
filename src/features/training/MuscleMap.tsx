import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { Label, Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { MuscleGroup } from '@/domain/types';

/**
 * Which muscles a movement works, drawn.
 *
 * A stylised figure rather than an anatomical illustration: it has to read at
 * a glance, on a phone, between sets, and it has to be drawn in the app's own
 * language instead of a stock photo.
 *
 * The geometry is declared once as data so the same body serves both jobs —
 * showing what an exercise hits, and letting the user tap the muscles they
 * want the plan built around. Fully procedural: no image assets, sharp at any
 * size, works offline.
 */

type Shape =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number };

/** `muscle: null` means a part that is drawn but never highlighted. */
type Part = { muscle: MuscleGroup | null; shape: Shape };

const rect = (x: number, y: number, width: number, height: number, rx: number): Shape => ({
  kind: 'rect',
  x,
  y,
  width,
  height,
  rx,
});

const FRONT_PARTS: Part[] = [
  { muscle: null, shape: { kind: 'circle', cx: 50, cy: 15, r: 11 } },
  { muscle: null, shape: rect(44, 25, 12, 9, 3) },
  { muscle: 'shoulders', shape: { kind: 'ellipse', cx: 28, cy: 46, rx: 10, ry: 9 } },
  { muscle: 'shoulders', shape: { kind: 'ellipse', cx: 72, cy: 46, rx: 10, ry: 9 } },
  { muscle: 'chest', shape: rect(33, 37, 15, 20, 6) },
  { muscle: 'chest', shape: rect(52, 37, 15, 20, 6) },
  { muscle: 'core', shape: rect(39, 60, 22, 34, 7) },
  { muscle: 'biceps', shape: rect(19, 57, 11, 24, 5) },
  { muscle: 'biceps', shape: rect(70, 57, 11, 24, 5) },
  { muscle: null, shape: rect(17, 83, 9, 24, 4) },
  { muscle: null, shape: rect(74, 83, 9, 24, 4) },
  { muscle: 'quads', shape: rect(35, 97, 13, 40, 6) },
  { muscle: 'quads', shape: rect(52, 97, 13, 40, 6) },
  { muscle: 'calves', shape: rect(36, 140, 11, 32, 5) },
  { muscle: 'calves', shape: rect(53, 140, 11, 32, 5) },
];

const BACK_PARTS: Part[] = [
  { muscle: null, shape: { kind: 'circle', cx: 50, cy: 15, r: 11 } },
  { muscle: null, shape: rect(44, 25, 12, 9, 3) },
  { muscle: 'shoulders', shape: { kind: 'ellipse', cx: 28, cy: 46, rx: 10, ry: 9 } },
  { muscle: 'shoulders', shape: { kind: 'ellipse', cx: 72, cy: 46, rx: 10, ry: 9 } },
  { muscle: 'back', shape: rect(35, 36, 30, 20, 8) },
  { muscle: 'back', shape: rect(31, 54, 16, 26, 6) },
  { muscle: 'back', shape: rect(53, 54, 16, 26, 6) },
  // The lower back is trained by the same work as the core, and grouped with it.
  { muscle: 'core', shape: rect(41, 80, 18, 12, 5) },
  { muscle: 'triceps', shape: rect(19, 57, 11, 24, 5) },
  { muscle: 'triceps', shape: rect(70, 57, 11, 24, 5) },
  { muscle: null, shape: rect(17, 83, 9, 24, 4) },
  { muscle: null, shape: rect(74, 83, 9, 24, 4) },
  { muscle: 'glutes', shape: rect(35, 94, 30, 20, 9) },
  { muscle: 'hamstrings', shape: rect(35, 116, 13, 26, 6) },
  { muscle: 'hamstrings', shape: rect(52, 116, 13, 26, 6) },
  { muscle: 'calves', shape: rect(36, 144, 11, 28, 5) },
  { muscle: 'calves', shape: rect(53, 144, 11, 28, 5) },
];

/** Muscles visible from each side, derived from the geometry itself. */
const FRONT_MUSCLES = [...new Set(FRONT_PARTS.map((part) => part.muscle).filter(Boolean))] as MuscleGroup[];
const BACK_MUSCLES = [...new Set(BACK_PARTS.map((part) => part.muscle).filter(Boolean))] as MuscleGroup[];

/** The single view that shows a muscle, for places with room for only one. */
export function preferredView(muscle: MuscleGroup): 'front' | 'back' {
  return FRONT_MUSCLES.includes(muscle) ? 'front' : 'back';
}

/**
 * The body itself, drawn once behind the muscles.
 *
 * Without it the highlighted muscles float in the dark with nothing to belong
 * to — which is exactly how the first version read. The silhouette is what
 * makes a shoulder look like a shoulder rather than a green blob.
 */
const SILHOUETTE =
  'M44 30C36 30 22 34 17 42C14 47 12 62 12 80L13 108 Q13 112 17 112 L25 112 Q29 112 29 108L30 80 C30 66 31 58 33 55L33 92 L32 104C32 120 34 150 35 172 Q35 176 39 176 L45 176 Q49 176 49 172L48 104 L50 100 L52 104 L51 172Q51 176 55 176 L61 176 Q65 176 65 172C66 150 68 120 68 104L67 92 L67 55C69 58 70 66 70 80L71 108 Q71 112 75 112 L83 112 Q87 112 87 108L88 80 C88 62 86 47 83 42C78 34 64 30 56 30Z';

function Figure({
  parts,
  width,
  fillOf,
  onPressMuscle,
}: {
  parts: Part[];
  width: number;
  fillOf: (muscle: MuscleGroup | null) => string;
  onPressMuscle?: (muscle: MuscleGroup) => void;
}) {
  return (
    <Svg width={width} height={width * 2} viewBox="0 0 100 200">
      <Circle cx={50} cy={15} r={12} fill={colors.surfaceRaised} stroke={colors.borderStrong} strokeWidth={1.2} />
      <Rect x={44} y={24} width={12} height={9} fill={colors.surfaceRaised} stroke={colors.borderStrong} strokeWidth={1.2} />
      <Path
        d={SILHOUETTE}
        fill={colors.surfaceRaised}
        stroke={colors.borderStrong}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />

      {parts.map((part, index) => {
        const fill = fillOf(part.muscle);
        const press = part.muscle && onPressMuscle ? () => onPressMuscle(part.muscle as MuscleGroup) : undefined;
        const key = `${part.muscle ?? 'inert'}-${index}`;

        if (part.shape.kind === 'circle') {
          return <Circle key={key} cx={part.shape.cx} cy={part.shape.cy} r={part.shape.r} fill={fill} onPress={press} />;
        }
        if (part.shape.kind === 'ellipse') {
          return (
            <Ellipse
              key={key}
              cx={part.shape.cx}
              cy={part.shape.cy}
              rx={part.shape.rx}
              ry={part.shape.ry}
              fill={fill}
              onPress={press}
            />
          );
        }
        return (
          <Rect
            key={key}
            x={part.shape.x}
            y={part.shape.y}
            width={part.shape.width}
            height={part.shape.height}
            rx={part.shape.rx}
            fill={fill}
            onPress={press}
          />
        );
      })}
    </Svg>
  );
}

type Props = {
  primary: MuscleGroup;
  secondary?: MuscleGroup[];
  /** Both views by default; a single view when space is tight. */
  view?: 'front' | 'back' | 'both';
  height?: number;
  showLegend?: boolean;
  style?: ViewStyle;
};

/** What one exercise works: the mover in the accent, its helpers muted. */
export function MuscleMap({
  primary,
  secondary = [],
  view = 'both',
  height = 180,
  showLegend = true,
  style,
}: Props) {
  const width = height / 2;
  const fillOf = (muscle: MuscleGroup | null) => {
    if (muscle === null) return 'transparent';
    if (muscle === primary) return colors.accent;
    if (secondary.includes(muscle)) return colors.accentMuted;
    return 'transparent';
  };

  const showFront =
    view === 'front' ||
    (view === 'both' &&
      (FRONT_MUSCLES.includes(primary) || secondary.some((muscle) => FRONT_MUSCLES.includes(muscle))));
  const showBack =
    view === 'back' ||
    (view === 'both' && (BACK_MUSCLES.includes(primary) || secondary.some((muscle) => BACK_MUSCLES.includes(muscle))));

  return (
    <View style={style}>
      <View style={styles.figures}>
        {showFront ? (
          <View style={styles.figure}>
            <Figure parts={FRONT_PARTS} width={width} fillOf={fillOf} />
            <Label style={styles.viewLabel}>Front</Label>
          </View>
        ) : null}
        {showBack ? (
          <View style={styles.figure}>
            <Figure parts={BACK_PARTS} width={width} fillOf={fillOf} />
            <Label style={styles.viewLabel}>Back</Label>
          </View>
        ) : null}
      </View>

      {showLegend ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colors.accent }]} />
            <Text variant="caption" tone="secondary">
              {MUSCLE_GROUP_LABELS[primary]}
            </Text>
          </View>
          {secondary.map((muscle) => (
            <View key={muscle} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: colors.accentMuted }]} />
              <Text variant="caption" tone="tertiary">
                {MUSCLE_GROUP_LABELS[muscle]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type PickerProps = {
  selected: MuscleGroup[];
  onToggle: (muscle: MuscleGroup) => void;
  height?: number;
  style?: ViewStyle;
};

/**
 * The same body, used as the control. Tapping a muscle picks it — no list, no
 * checkboxes, nothing to read to understand what the tap does.
 */
export function MusclePicker({ selected, onToggle, height = 220, style }: PickerProps) {
  const width = height / 2;
  const fillOf = (muscle: MuscleGroup | null) => {
    if (muscle === null) return 'transparent';
    // Unpicked muscles stay visible on the body, just quiet.
    return selected.includes(muscle) ? colors.accent : colors.borderStrong;
  };

  return (
    <View style={[styles.figures, style]}>
      <View style={styles.figure}>
        <Figure parts={FRONT_PARTS} width={width} fillOf={fillOf} onPressMuscle={onToggle} />
        <Label style={styles.viewLabel}>Front</Label>
      </View>
      <View style={styles.figure}>
        <Figure parts={BACK_PARTS} width={width} fillOf={fillOf} onPressMuscle={onToggle} />
        <Label style={styles.viewLabel}>Back</Label>
      </View>
    </View>
  );
}

/**
 * A body shaded by how much weekly volume each muscle gets. Reading it needs
 * no numbers: bright is trained hard, dim is barely trained.
 */
export function MuscleHeatmap({
  setsByMuscle,
  height = 200,
  style,
}: {
  setsByMuscle: Partial<Record<MuscleGroup, number>>;
  height?: number;
  style?: ViewStyle;
}) {
  const width = height / 2;
  const peak = Math.max(1, ...Object.values(setsByMuscle).map((value) => value ?? 0));

  const fillOf = (muscle: MuscleGroup | null) => {
    if (muscle === null) return 'transparent';
    const share = (setsByMuscle[muscle] ?? 0) / peak;
    // Steps, not a gradient: a glance between sets resolves steps, not shades.
    if (share <= 0) return 'transparent';
    if (share < 0.5) return colors.accentMuted;
    return colors.accent;
  };

  return (
    <View style={[styles.figures, style]}>
      <View style={styles.figure}>
        <Figure parts={FRONT_PARTS} width={width} fillOf={fillOf} />
      </View>
      <View style={styles.figure}>
        <Figure parts={BACK_PARTS} width={width} fillOf={fillOf} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  figures: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  figure: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  viewLabel: {
    marginTop: spacing.xs,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
