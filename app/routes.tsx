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
import { recommendRoute, simulateAllRoutes, type RouteInput } from '@/domain/plan/routes';
import { routeOutlook } from '@/domain/plan/outlook';
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

  const outlooks = Object.fromEntries(
    simulations.map((simulation) => [
      simulation.route.id,
      routeOutlook(simulation, goal?.objective ?? 'build'),
    ]),
  );

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

                {/* Las paradas con fecha. «Ocho kilos en dos años» no se
                    puede sentir; «para abril pesas 79 al 17 %» sí, porque
                    abril llega. */}
                {outlooks[simulation.route.id] ? (
                  <View style={styles.stops}>
                    {outlooks[simulation.route.id].milestones.map((stop) => (
                      <View key={stop.week} style={styles.stop}>
                        <Text variant="caption" tone="tertiary">
                          {stop.away}
                        </Text>
                        <Text variant="bodySmall" mono>
                          {`${stop.weightKg} kg`}
                        </Text>
                        <Text variant="caption" tone="accent" mono>
                          {`+${stop.muscleKg}`}
                        </Text>
                        {stop.bodyFatPercent !== null ? (
                          <Text variant="caption" tone="tertiary" mono>
                            {`${stop.bodyFatPercent}%`}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* El precio, en sesiones. Sin esto la que más promete gana
                    siempre, y la que más promete es siempre la más larga. */}
                {outlooks[simulation.route.id] ? (
                  <Text variant="caption" tone="tertiary" style={styles.cardFoot}>
                    {`${outlooks[simulation.route.id].sessionsPerWeek}× a week · ${
                      outlooks[simulation.route.id].totalSessions
                    } sessions · done around ${formatLongDate(simulation.endDate)}`}
                  </Text>
                ) : (
                  <Text variant="caption" tone="tertiary" style={styles.cardFoot}>
                    {`Done around ${formatLongDate(simulation.endDate)}`}
                  </Text>
                )}
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
  stops: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  stop: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
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
