import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Reveal } from '@/components/motion/Reveal';
import { NavGroup, NavRow } from '@/components/NavRow';
import { Screen } from '@/components/Screen';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { momentumStateLabel } from '@/domain/momentum/calculateMomentum';
import { useBodyWeightSeries, useCompletedSessions, useEngine } from '@/store/hooks';

/**
 * One headline number, then rows. Every detail lives one tap deeper.
 *
 * Reached from the plan rather than living in the tab bar: how the comeback is
 * going is something you look up, not something you need on every launch.
 */
export default function ProgressScreen() {
  const router = useRouter();
  const engine = useEngine();
  const sessions = useCompletedSessions();
  const weights = useBodyWeightSeries();

  const latestWeight = weights[weights.length - 1] ?? null;
  const comeback = engine.comeback;

  return (
    <Screen>
      <Header title="Progress" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />

      <Reveal index={1}>
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <Label>Comeback</Label>
            <StatusPill
              label={comeback.value === null ? 'establishing' : `${comeback.confidence} confidence`}
              tone={comeback.value === null ? 'neutral' : comeback.confidence === 'high' ? 'accent' : 'info'}
            />
          </View>
          <View style={styles.heroValue}>
            <AnimatedNumber value={comeback.value} variant="display" />
            {comeback.value !== null ? (
              <Text variant="title" tone="tertiary">
                %
              </Text>
            ) : null}
          </View>
          <Text variant="bodySmall" tone="secondary" style={styles.heroLine}>
            {comeback.value === null
              ? 'Log three sessions and this measures how much of your level is back.'
              : 'of the level your baseline was set at'}
          </Text>
        </View>
      </Reveal>

      <Reveal index={2}>
        <NavGroup style={styles.group}>
          <NavRow
            label="Momentum"
            value={engine.momentum ? `${Math.round(engine.momentum.score)}` : '—'}
            detail={engine.momentum ? momentumStateLabel(engine.momentum.state) : 'Not enough data yet'}
            tone={engine.momentum && engine.momentum.score >= 60 ? 'accent' : 'neutral'}
            onPress={() => router.push('/momentum')}
          />
          <NavRow
            label="Body weight"
            value={latestWeight ? `${latestWeight.weightKg.toFixed(1)} kg` : 'Not logged'}
            tone={latestWeight ? 'neutral' : 'warning'}
            dot={!latestWeight}
            onPress={() => router.push('/body')}
          />
          <NavRow
            label="Consistency"
            value={`${engine.week.completed} of ${engine.week.target}`}
            detail="This week"
            onPress={() => router.push('/consistency')}
          />
          <NavRow
            label="Performance"
            value={`${sessions.length}`}
            detail="Volume and lifts"
            onPress={() => router.push('/performance')}
          />
        </NavGroup>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  heroLine: {
    marginTop: spacing.sm,
  },
  group: {
    marginTop: spacing.xl,
  },
});
