import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Header } from '@/components/Header';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { exerciseName } from '@/data/exercises';
import { nextTarget, summariseStrength, type ExerciseStrength } from '@/domain/training/strength';
import { useAppStore } from '@/store/useAppStore';

/**
 * Every movement, and what it has compounded to.
 *
 * The question a month of training raises is not "what did I do on Tuesday" —
 * it is *am I stronger, and by how much*. A list of sessions cannot answer
 * that: one heavy day and one bad day look identical on it.
 *
 * So each movement gets one line, one number, and one shape. The number is
 * what to put on the bar next; the shape is the weeks behind it. Everything is
 * compared in estimated one-rep max, because 80 kg for five and 70 kg for
 * twelve are not the same performance and ranking by weight alone would call
 * a drop in reps an improvement.
 */
export default function LiftsScreen() {
  const router = useRouter();
  const sessions = useAppStore((state) => state.sessions);

  const summary = summariseStrength(sessions);

  return (
    <Screen bottomInset={spacing.xxl}>
      <Header
        title="Your lifts"
        subtitle={summary.headline}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {summary.moving.length > 0 ? (
        <Reveal index={0}>
          <View style={styles.total}>
            <AnimatedNumber value={summary.totalAddedKg} decimals={1} variant="display" />
            <Text variant="body" tone="secondary">
              kg added, across everything with enough weeks to judge
            </Text>
          </View>
        </Reveal>
      ) : null}

      {summary.moving.length > 0 ? (
        <Reveal index={1}>
          <Section title="Compounding">
            {summary.moving.map((entry) => (
              <Lift key={entry.exerciseId} entry={entry} onPress={() => open(router, entry)} />
            ))}
          </Section>
        </Reveal>
      ) : null}

      {summary.tooEarly.length > 0 ? (
        <Reveal index={2}>
          <Section
            title="Too early to say"
            footnote="A few weeks of logging and these get a trend of their own."
          >
            {summary.tooEarly.map((entry) => (
              <Lift key={entry.exerciseId} entry={entry} onPress={() => open(router, entry)} />
            ))}
          </Section>
        </Reveal>
      ) : null}
    </Screen>
  );
}

function open(router: ReturnType<typeof useRouter>, entry: ExerciseStrength) {
  router.push({ pathname: '/exercise/[id]', params: { id: entry.exerciseId } });
}

function Lift({ entry, onPress }: { entry: ExerciseStrength; onPress: () => void }) {
  const target = nextTarget(entry);
  const up = entry.changeKg > 0;
  const flat = entry.changeKg === 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={exerciseName(entry.exerciseId)}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
    >
      <View style={styles.rowText}>
        <Text variant="body">{exerciseName(entry.exerciseId)}</Text>
        <View style={styles.meta}>
          <Icon
            name={flat ? 'arrowFlat' : up ? 'arrowUp' : 'arrowDown'}
            size={12}
            color={up ? colors.accent : colors.textTertiary}
          />
          <Text variant="caption" tone="tertiary">
            {entry.perWeekKg === null
              ? `${entry.current.weightKg} kg × ${entry.current.reps} · ${entry.totalSets} sets logged`
              : `${up ? '+' : ''}${entry.changeKg} kg over ${entry.weeksSpanned} weeks · ${entry.perWeekKg} kg a week`}
          </Text>
        </View>
      </View>

      <Trend history={entry.history} />

      <View style={styles.next}>
        <Text variant="body" mono>
          {target.weightKg}
        </Text>
        <Label>next</Label>
      </View>
    </Pressable>
  );
}

/** The weeks behind the number, small enough to sit in a row. */
function Trend({ history }: { history: ExerciseStrength['history'] }) {
  if (history.length < 2) return <View style={styles.trend} />;

  const values = history.map((point) => point.estimatedMaxKg);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 44;
    const y = 16 - ((value - low) / span) * 14;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  return (
    <View style={styles.trend}>
      <Svg width={44} height={18}>
        <Path
          d={`M${points.join(' L')}`}
          stroke={values[values.length - 1] >= values[0] ? colors.accent : colors.textTertiary}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  total: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: colors.border,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trend: {
    width: 44,
    height: 18,
    justifyContent: 'center',
  },
  next: {
    alignItems: 'flex-end',
    minWidth: 44,
    paddingLeft: spacing.sm,
    borderLeftWidth: borderWidth.hairline,
    borderLeftColor: colors.border,
  },
});
