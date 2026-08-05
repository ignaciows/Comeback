import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Label, Text } from '@/design-system/Text';
import { colors, radius, spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import { effortLabel, rankedMuscles } from '@/data/muscleContribution';
import type { MuscleGroup } from '@/domain/types';

/**
 * An anatomical schematic, lit by how hard each muscle is working.
 *
 * The diagram this replaces was circles and rounded rectangles on a stick
 * figure, and it read as a toy — which undercut everything around it, because
 * a screen that explains why your elbows go where they go cannot then draw the
 * body out of building blocks.
 *
 * Two changes. The shapes are muscle shapes: pectorals fanning to the
 * shoulder, the abdominal column segmented, lats tapering from armpit to
 * waist, the calf's two heads. And they are lit on a gradient rather than in
 * two flat states, because "primary and secondary" cannot tell an incline
 * press from a flat one and the whole reason to draw this is that they are
 * different exercises.
 *
 * Still procedural — no image assets, sharp at any size, works offline, and it
 * costs nothing to add an exercise.
 */

type Props = {
  exerciseId: string;
  height?: number;
  showLegend?: boolean;
  style?: ViewStyle;
};

/**
 * The paths, in a 100 × 240 body. Front and back are separate drawings rather
 * than a mirrored one: the muscles that matter are on opposite sides, and a
 * flipped front view would put lats where pecs are.
 */
type MusclePath = { muscle: MuscleGroup; d: string };

/** Outline of the body, drawn under everything and never lit. */
const SILHOUETTE =
  'M50 6 C55 6 59 10 59 16 C59 21 57 24 55 26 L55 30 ' +
  'C63 32 70 36 73 42 L78 74 C79 80 77 84 74 84 C72 84 71 81 70 76 L67 58 ' +
  'L66 96 C66 104 64 110 63 116 L64 150 C64 160 62 168 61 176 L60 214 ' +
  'C60 220 58 224 55 224 C52 224 51 221 51 216 L50 178 L49 216 ' +
  'C49 221 48 224 45 224 C42 224 40 220 40 214 L39 176 ' +
  'C38 168 36 160 36 150 L37 116 C36 110 34 104 34 96 L33 58 ' +
  'L30 76 C29 81 28 84 26 84 C23 84 21 80 22 74 L27 42 ' +
  'C30 36 37 32 45 30 L45 26 C43 24 41 21 41 16 C41 10 45 6 50 6 Z';

const FRONT: MusclePath[] = [
  // Deltoids — the cap over the shoulder, fanning down the outside of the arm.
  { muscle: 'shoulders', d: 'M28 43 C33 38 39 36 43 38 C44 44 43 51 41 56 C36 57 30 55 27 51 C26 48 27 45 28 43 Z' },
  { muscle: 'shoulders', d: 'M72 43 C67 38 61 36 57 38 C56 44 57 51 59 56 C64 57 70 55 73 51 C74 48 73 45 72 43 Z' },

  // Pectorals — fanning from the sternum out to the shoulder, wider at the top.
  { muscle: 'chest', d: 'M49 40 L49 68 C44 68 39 65 37 60 C35 54 36 46 39 42 C42 40 46 39 49 40 Z' },
  { muscle: 'chest', d: 'M51 40 L51 68 C56 68 61 65 63 60 C65 54 64 46 61 42 C58 40 54 39 51 40 Z' },

  // Biceps — the belly of the upper arm, tapering into the elbow.
  { muscle: 'biceps', d: 'M29 57 C33 56 37 58 38 62 C39 68 37 75 34 80 C31 81 28 79 27 75 C26 68 27 61 29 57 Z' },
  { muscle: 'biceps', d: 'M71 57 C67 56 63 58 62 62 C61 68 63 75 66 80 C69 81 72 79 73 75 C74 68 73 61 71 57 Z' },

  // Rectus abdominis — a segmented column, narrowing towards the navel.
  { muscle: 'core', d: 'M43 70 L57 70 C58 82 58 94 56 104 C53 107 47 107 44 104 C42 94 42 82 43 70 Z' },
  // Obliques — the flanks either side of it.
  { muscle: 'core', d: 'M38 68 C41 70 42 76 42 84 C42 92 41 98 39 101 C36 97 35 88 35 80 C35 73 36 69 38 68 Z' },
  { muscle: 'core', d: 'M62 68 C59 70 58 76 58 84 C58 92 59 98 61 101 C64 97 65 88 65 80 C65 73 64 69 62 68 Z' },

  // Quadriceps — the sweep of the outer head with the inner teardrop below.
  { muscle: 'quads', d: 'M37 120 C42 118 46 119 48 122 C49 134 48 150 46 164 C43 167 39 166 37 162 C35 148 35 132 37 120 Z' },
  { muscle: 'quads', d: 'M63 120 C58 118 54 119 52 122 C51 134 52 150 54 164 C57 167 61 166 63 162 C65 148 65 132 63 120 Z' },

  // Tibialis — the shin, which is what a calf raise pulls against.
  { muscle: 'calves', d: 'M40 178 C43 177 45 178 46 181 C46 192 45 202 44 208 C42 210 40 209 39 206 C38 197 38 186 40 178 Z' },
  { muscle: 'calves', d: 'M60 178 C57 177 55 178 54 181 C54 192 55 202 56 208 C58 210 60 209 61 206 C62 197 62 186 60 178 Z' },
];

const BACK: MusclePath[] = [
  // Trapezius — the diamond from the neck out to the shoulders and down.
  { muscle: 'back', d: 'M50 31 C57 32 65 36 70 41 C64 45 57 47 50 47 C43 47 36 45 30 41 C35 36 43 32 50 31 Z' },
  // Rear deltoids.
  { muscle: 'shoulders', d: 'M28 43 C33 39 38 37 42 39 C43 45 42 51 40 56 C35 57 30 55 27 51 C26 48 27 45 28 43 Z' },
  { muscle: 'shoulders', d: 'M72 43 C67 39 62 37 58 39 C57 45 58 51 60 56 C65 57 70 55 73 51 C74 48 73 45 72 43 Z' },

  // Latissimus dorsi — wide under the armpit, tapering to the waist.
  { muscle: 'back', d: 'M45 49 C45 62 43 76 40 88 C36 84 34 74 34 62 C34 55 38 50 45 49 Z' },
  { muscle: 'back', d: 'M55 49 C55 62 57 76 60 88 C64 84 66 74 66 62 C66 55 62 50 55 49 Z' },
  // Erectors — the two columns either side of the lower spine.
  { muscle: 'back', d: 'M46 66 C47 78 47 90 46 100 C44 99 43 94 43 86 C43 76 44 69 46 66 Z' },
  { muscle: 'back', d: 'M54 66 C53 78 53 90 54 100 C56 99 57 94 57 86 C57 76 56 69 54 66 Z' },

  // Triceps — the horseshoe on the back of the upper arm.
  { muscle: 'triceps', d: 'M29 56 C33 55 37 57 38 61 C39 68 37 76 34 81 C31 82 28 80 27 76 C26 68 27 60 29 56 Z' },
  { muscle: 'triceps', d: 'M71 56 C67 55 63 57 62 61 C61 68 63 76 66 81 C69 82 72 80 73 76 C74 68 73 60 71 56 Z' },

  // Glutes.
  { muscle: 'glutes', d: 'M49 104 C49 116 47 122 42 124 C37 124 34 119 34 112 C34 106 38 102 43 102 C46 102 48 103 49 104 Z' },
  { muscle: 'glutes', d: 'M51 104 C51 116 53 122 58 124 C63 124 66 119 66 112 C66 106 62 102 57 102 C54 102 52 103 51 104 Z' },

  // Hamstrings — three bellies running from the sit bone to behind the knee.
  { muscle: 'hamstrings', d: 'M37 128 C42 126 46 127 48 130 C49 142 48 156 46 166 C43 169 39 168 37 164 C35 152 35 138 37 128 Z' },
  { muscle: 'hamstrings', d: 'M63 128 C58 126 54 127 52 130 C51 142 52 156 54 166 C57 169 61 168 63 164 C65 152 65 138 63 128 Z' },

  // Gastrocnemius — the two heads, which is the shape people recognise.
  { muscle: 'calves', d: 'M39 176 C43 175 46 177 47 181 C47 191 45 200 43 206 C40 207 38 205 38 200 C38 191 38 182 39 176 Z' },
  { muscle: 'calves', d: 'M61 176 C57 175 54 177 53 181 C53 191 55 200 57 206 C60 207 62 205 62 200 C62 191 62 182 61 176 Z' },
];

/** The tendon lines across the abdominal column. Drawn, never lit. */
const AB_LINES = [
  [44, 79, 56, 79],
  [44, 88, 56, 88],
  [44, 97, 56, 97],
];

export function AnatomyMap({ exerciseId, height = 210, showLegend = true, style }: Props) {
  const ranked = rankedMuscles(exerciseId);
  const weights = new Map(ranked.map((entry) => [entry.muscle, entry.weight]));

  /**
   * Intensity reads as opacity rather than as a different hue.
   *
   * A colour ramp would need the user to learn a key before the picture means
   * anything; brightness is read without one. The floor is deliberately above
   * zero for a muscle that is involved at all, because "faintly lit" and "not
   * in this exercise" have to be distinguishable at a glance.
   */
  const fillFor = (muscle: MuscleGroup) => {
    const weight = weights.get(muscle);
    if (weight === undefined || weight <= 0) return { fill: colors.surfaceRaised, opacity: 0.5 };
    return { fill: colors.accent, opacity: 0.22 + weight * 0.78 };
  };

  const width = height * 0.42;

  const body = (paths: MusclePath[], showAbLines: boolean) => (
    <Svg width={width} height={height} viewBox="0 0 100 240">
      <Defs>
        <LinearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.surface} stopOpacity="1" />
          <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
        </LinearGradient>
      </Defs>

      <Path d={SILHOUETTE} fill="url(#skin)" stroke={colors.border} strokeWidth={1} />

      <G>
        {paths.map((part, index) => {
          const { fill, opacity } = fillFor(part.muscle);
          return (
            <Path
              key={`${part.muscle}-${index}`}
              d={part.d}
              fill={fill}
              fillOpacity={opacity}
              stroke={colors.background}
              strokeWidth={0.6}
            />
          );
        })}
      </G>

      {showAbLines
        ? AB_LINES.map(([x1, y1, x2, y2]) => (
            <Line
              key={`${x1}-${y1}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={colors.background}
              strokeWidth={0.8}
              opacity={0.9}
            />
          ))
        : null}
    </Svg>
  );

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.bodies}>
        <View style={styles.body}>
          {body(FRONT, true)}
          <Label style={styles.view}>Front</Label>
        </View>
        <View style={styles.body}>
          {body(BACK, false)}
          <Label style={styles.view}>Back</Label>
        </View>
      </View>

      {/*
        The legend states the effort in words rather than as a number. The
        ordering is what the weights are good for; two decimal places would
        claim a precision they do not have.
      */}
      {showLegend && ranked.length > 0 ? (
        <View style={styles.legend}>
          {ranked.map(({ muscle, weight }) => (
            <View key={muscle} style={styles.legendRow}>
              <View style={styles.legendName}>
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: colors.accent, opacity: 0.22 + weight * 0.78 },
                  ]}
                />
                <Text variant="bodySmall">{MUSCLE_GROUP_LABELS[muscle]}</Text>
              </View>
              <Text variant="caption" tone="tertiary">
                {effortLabel(weight)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.lg,
  },
  bodies: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  body: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  view: {
    marginTop: spacing.xs,
  },
  legend: {
    gap: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  legendName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: radius.sm,
  },
});
