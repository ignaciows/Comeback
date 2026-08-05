import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState, Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { compareAgainstCeiling, type CeilingCheck } from '@/domain/plan/ceilingComparison';
import { recommendRoute, simulateAllRoutes, type RouteInput } from '@/domain/plan/routes';
import { RouteChart } from '@/features/plan/RouteChart';
import { useBodyWeightSeries } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { formatLongDate, today as todayOf } from '@/utils/date';

/**
 * Which plan should I follow?
 *
 * Each route is simulated week by week and drawn, because the difference
 * between "build for three months then diet" and "gain slowly for eight" is a
 * shape, not a sentence. One is recommended, with the reason it was picked.
 */
export default function RoutesScreen() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const goal = useAppStore((state) => state.goal);
  const training = useAppStore((state) => state.training);
  const planRoute = useAppStore((state) => state.planRoute);
  const weights = useBodyWeightSeries();

  const latest = weights[weights.length - 1] ?? null;

  const input: RouteInput | null = useMemo(() => {
    if (!profile || !latest) return null;
    return {
      today: todayOf(),
      currentWeightKg: latest.weightKg,
      heightCm: profile.heightCm,
      age: profile.age ?? 30,
      sex: profile.sex,
      experience: profile.experience,
      bodyFatPercent: latest.bodyFatPercent,
      sessionsPerWeek: training.preferredDaysPerWeek,
    };
  }, [profile, latest, training.preferredDaysPerWeek]);

  const simulations = useMemo(() => (input ? simulateAllRoutes(input) : []), [input]);
  const recommendation = useMemo(
    () => (input ? recommendRoute(input, goal?.objective ?? 'build') : null),
    [input, goal],
  );

  /**
   * With a ceiling set, "which plan" stops being only about size and speed:
   * some of these routes break a limit the user already committed to, and that
   * is decisive information to leave off the card they are choosing from.
   */
  const ceiling = goal?.maxBodyFatPercent ?? null;
  const comparison = useMemo(
    () => (input && ceiling !== null ? compareAgainstCeiling(input, ceiling, { horizonWeeks: goal?.horizonWeeks ?? 32 }) : null),
    [input, ceiling, goal?.horizonWeeks],
  );
  const checkFor = useMemo(() => {
    const map = new Map<string, CeilingCheck>();
    for (const other of comparison?.others ?? []) map.set(other.routeId, other);
    return map;
  }, [comparison]);

  if (!input || simulations.length === 0) {
    return (
      <Screen>
        <Header title="Plans" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />
        <EmptyState
          title="Log your weight first"
          description="Every route is drawn from your own starting point."
          action={{ label: 'Log weight', onPress: () => router.push('/log-weight') }}
        />
      </Screen>
    );
  }

  // One shared y-range so the curves can be compared directly.
  const allWeights = simulations.flatMap((simulation) => simulation.points.map((point) => point.weightKg));
  const domain: [number, number] = [Math.min(...allWeights) - 0.5, Math.max(...allWeights) + 0.5];

  const ordered = [...simulations].sort((a, b) =>
    a.route.id === recommendation?.routeId ? -1 : b.route.id === recommendation?.routeId ? 1 : 0,
  );

  return (
    <Screen>
      <Header
        title="Which plan?"
        subtitle="Same starting point, different routes"
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {recommendation ? (
        <Reveal index={0}>
          <View style={styles.recommendation}>
            <Label>Recommended for you</Label>
            <Text variant="body" tone="secondary" style={styles.recommendationText}>
              {recommendation.reason}
            </Text>
          </View>
        </Reveal>
      ) : null}

      {/*
        The ceiling plan sits above the menu rather than in it: it is not a
        sixth template, it is the one route derived from a limit the user set,
        and the routes below are being judged against it.
      */}
      {comparison ? (
        <Reveal index={0}>
          <Pressable
            onPress={() => router.push('/fat-ceiling')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.ceiling, pressed && { opacity: opacity.pressed }]}
          >
            <View style={styles.cardHead}>
              <Text variant="heading">{comparison.ours.name}</Text>
              <StatusPill label="Your limit" tone="accent" />
            </View>
            <Text variant="bodySmall" tone="secondary" style={styles.cardSummary}>
              {comparison.trade ??
                `Nothing below crosses ${comparison.ceiling} % from where you are, so the limit costs you nothing today.`}
            </Text>
            <View style={styles.stats}>
              <Stat label="Takes" value={`${comparison.ours.weeks} weeks`} />
              <Stat label="Muscle" value={`+${comparison.ours.muscleGainKg} kg`} accent />
              <Stat label="Peaks at" value={`${comparison.ours.peakBodyFatPercent} %`} />
            </View>
          </Pressable>
        </Reveal>
      ) : null}

      {latest?.bodyFatPercent === null ? (
        <Note style={styles.note}>
          Add your body fat percentage when you log your weight and these curves show where your body fat goes, not
          just the scale.
        </Note>
      ) : null}

      <View style={styles.list}>
        {ordered.map((simulation, index) => {
          const recommended = simulation.route.id === recommendation?.routeId;
          const active = planRoute?.routeId === simulation.route.id;
          return (
            <Reveal key={simulation.route.id} index={index + 1}>
              <Pressable
                onPress={() => router.push({ pathname: '/route/[id]', params: { id: simulation.route.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.card,
                  recommended && styles.cardRecommended,
                  pressed && { opacity: opacity.pressed },
                ]}
              >
                <View style={styles.cardHead}>
                  <Text variant="heading">{simulation.route.name}</Text>
                  {active ? (
                    <StatusPill label="Current" tone="accent" />
                  ) : recommended ? (
                    <StatusPill label="Recommended" tone="info" />
                  ) : null}
                </View>

                <Text variant="bodySmall" tone="secondary" style={styles.cardSummary}>
                  {simulation.route.summary}
                </Text>

                <RouteChart
                  simulation={simulation}
                  height={90}
                  domain={domain}
                  showBodyFat={latest?.bodyFatPercent !== null}
                  style={styles.chart}
                />

                <View style={styles.stats}>
                  <Stat label="Takes" value={`${simulation.totalWeeks} weeks`} />
                  <Stat label="Muscle" value={`+${simulation.muscleGainKg} kg`} accent />
                  <Stat
                    label="Fat"
                    value={`${simulation.fatChangeKg > 0 ? '+' : ''}${simulation.fatChangeKg} kg`}
                  />
                  <Stat label="Ends at" value={`${simulation.endWeightKg} kg`} />
                </View>

                <Text variant="caption" tone="tertiary" style={styles.cardFoot}>
                  {`Done around ${formatLongDate(simulation.endDate)}`}
                </Text>

                {/* Only when it breaks the limit. A route that respects it
                    needs no badge saying so. */}
                {checkFor.get(simulation.route.id)?.crosses ? (
                  <View style={styles.breach}>
                    <Icon name="info" size={13} color={colors.warning} />
                    <Text variant="caption" style={styles.breachText}>
                      {`Peaks at ${checkFor.get(simulation.route.id)!.peakBodyFatPercent} % — ${checkFor.get(simulation.route.id)!.overshoot} over your ${ceiling} % limit`}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </Reveal>
          );
        })}
      </View>

      <Pressable
        onPress={() => router.push('/builder')}
        accessibilityRole="button"
        accessibilityLabel="Build your own plan"
        style={({ pressed }) => [styles.build, pressed && { opacity: opacity.pressed }]}
      >
        <Icon name="edit" size={22} color={colors.textSecondary} />
        <Text variant="heading" style={styles.buildTitle}>
          Build your own
        </Text>
        <Text variant="bodySmall" tone="secondary">
          Drag the blocks. Everything recalculates as you move them.
        </Text>
      </Pressable>

      <Note style={styles.note}>
        Estimates, simulated week by week with muscle gain capped at what training can build. They move as your data comes in.
      </Note>
    </Screen>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.stat}>
      <Label>{label}</Label>
      <Text variant="bodySmall" mono style={accent ? { color: colors.accent } : undefined}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  recommendation: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSurface,
    marginBottom: spacing.xl,
  },
  recommendationText: {
    marginTop: spacing.sm,
  },
  list: {
    gap: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardRecommended: {
    borderColor: colors.borderStrong,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardSummary: {
    marginTop: spacing.xs,
  },
  chart: {
    marginTop: spacing.lg,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  stat: {
    gap: 2,
  },
  cardFoot: {
    marginTop: spacing.md,
  },
  ceiling: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSurface,
    marginBottom: spacing.xl,
  },
  breach: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  breachText: {
    color: colors.warning,
    flex: 1,
  },
  build: {
    marginTop: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  buildTitle: {
    marginTop: spacing.sm,
  },
  note: {
    marginTop: spacing.xl,
  },
});
