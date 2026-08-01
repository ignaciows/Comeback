import { useRouter } from 'expo-router';
import { StyleSheet, Switch, View } from 'react-native';

import { EmptyState, Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { MetricRow } from '@/components/Metric';
import { ProgressBar } from '@/components/ProgressBar';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { fuelConfig } from '@/domain/config';
import { fuelLabel, type FuelComponents } from '@/domain/fuel/calculateFuel';
import { HABITS } from '@/domain/nudges/nudges';
import { useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';

const COMPONENT_HELP: Record<keyof FuelComponents, string> = {
  nutrition:
    'Calories and protein against your plan’s targets, averaged over the last couple of days. Protein counts for more: it predicts recovery more directly than total calories do.',
  sleep: 'Last night’s hours and quality, on the same scale readiness uses, so the two never disagree.',
  trainingLoad: 'How your readiness has trended over the last week — what recent training has already taken out of you.',
};

/**
 * What today has to run on, and the levers that change it.
 *
 * Momentum answers whether the trajectory is holding. Fuel answers whether
 * today has the resources, which is a different question with different
 * answers: a strong month of training and four hours of sleep is high
 * momentum and low fuel, and the app would be lying if it showed one number
 * for both.
 */
export default function FuelScreen() {
  const router = useRouter();
  const { fuel, nudges } = useEngine();

  const enabledHabits = useAppStore((state) => state.enabledHabits);
  const toggleHabit = useAppStore((state) => state.toggleHabit);
  const weatherEnabled = useAppStore((state) => state.weatherEnabled);
  const setWeatherEnabled = useAppStore((state) => state.setWeatherEnabled);
  const nutritionLog = useAppStore((state) => state.nutritionLog);

  const latestNutrition = [...nutritionLog].sort((a, b) => (a.date < b.date ? -1 : 1)).pop() ?? null;

  return (
    <Screen>
      <Header
        title="Fuel"
        subtitle={fuelLabel(fuel.score)}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {fuel.score === null ? (
        <EmptyState
          title="Nothing to score yet"
          description="Fuel needs meals, sleep or a check-in. Connect MIKUY through Apple Health and log a check-in, and it starts."
        />
      ) : (
        <Reveal index={0}>
          <Section>
            <View style={styles.scoreRow}>
              <Text variant="display">{Math.round(fuel.score)}</Text>
              <Text variant="bodySmall" tone="tertiary" mono>
                {`${fuel.confidence} confidence`}
              </Text>
            </View>
            <Text variant="bodySmall" tone="secondary" style={styles.explanation}>
              {fuel.explanation}
            </Text>
          </Section>
        </Reveal>
      )}

      <Reveal index={1}>
        <Section title="What it is made of">
          {fuel.breakdown.map((component) => {
            const weight = Math.round(fuelConfig.weights[component.key] * 100);
            return (
              <View key={component.key} style={styles.component}>
                <View style={styles.componentHead}>
                  <Text variant="body">{component.label}</Text>
                  <Text variant="bodySmall" tone="secondary" mono>
                    {component.score === null ? 'No data' : `${Math.round(component.score)}`}
                  </Text>
                </View>
                <ProgressBar
                  value={component.score === null ? 0 : component.score / 100}
                  color={component.score === null ? colors.border : colors.accent}
                  label={component.label}
                />
                <Text variant="caption" tone="tertiary" style={styles.componentHelp}>
                  {`${weight}% of the score · ${COMPONENT_HELP[component.key]}`}
                </Text>
              </View>
            );
          })}
          <Note style={styles.note}>
            A component with no data is dropped and its weight shared, never counted as a zero.
          </Note>
        </Section>
      </Reveal>

      {latestNutrition ? (
        <Reveal index={2}>
          <Section title="Last logged day" footnote="Imported from MIKUY through Apple Health.">
            <MetricRow label="Calories" value={latestNutrition.kcal === null ? '—' : `${latestNutrition.kcal} kcal`} />
            <Divider />
            <MetricRow label="Protein" value={latestNutrition.proteinG === null ? '—' : `${latestNutrition.proteinG} g`} />
            <Divider />
            <MetricRow label="Carbs" value={latestNutrition.carbsG === null ? '—' : `${latestNutrition.carbsG} g`} />
            <Divider />
            <MetricRow label="Fat" value={latestNutrition.fatG === null ? '—' : `${latestNutrition.fatG} g`} />
          </Section>
        </Reveal>
      ) : (
        <Reveal index={2}>
          <Section title="Meals">
            <Text variant="bodySmall" tone="secondary">
              Nothing imported yet. MIKUY writes what you eat into Apple Health, and Comeback reads it back — one
              connection, no account to link.
            </Text>
            <MetricRow label="Connect" detail="Data sources" onPress={() => router.push('/sources')} />
          </Section>
        </Reveal>
      )}

      {/* Every nudge currently applicable, not just the one Today shows —
          this is the screen where seeing the whole list is the point. */}
      {nudges.length > 0 ? (
        <Reveal index={3}>
          <Section title="What would move it" footnote="Ranked by what is actionable right now.">
            {nudges.map((nudge, index) => (
              <View key={nudge.id}>
                {index > 0 ? <Divider /> : null}
                <MetricRow
                  label={nudge.headline}
                  detail={nudge.detail}
                  value={nudge.projectedGain === null ? undefined : `+${nudge.projectedGain}`}
                />
              </View>
            ))}
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={4}>
        <Section
          title="Habits"
          footnote="Switched on, these change which nudges you get. Nothing here is a streak to keep."
        >
          {HABITS.map((habit, index) => (
            <View key={habit.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.habit}>
                <View style={styles.habitText}>
                  <Text variant="body">{habit.label}</Text>
                  <Text variant="caption" tone="tertiary" style={styles.habitDetail}>
                    {habit.detail}
                  </Text>
                </View>
                <Switch
                  value={enabledHabits.includes(habit.id)}
                  onValueChange={() => toggleHabit(habit.id)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                />
              </View>
            </View>
          ))}
        </Section>
      </Reveal>

      <Reveal index={5}>
        <Section title="Weather">
          <View style={styles.habit}>
            <View style={styles.habitText}>
              <Text variant="body">Use local weather</Text>
              <Text variant="caption" tone="tertiary" style={styles.habitDetail}>
                Changes how a training day is framed, nothing else. This is the only part of the app that reaches the
                network, and your location is rounded to about 11 km before it is sent. No health or training data
                leaves the device.
              </Text>
            </View>
            <Switch
              value={weatherEnabled}
              onValueChange={setWeatherEnabled}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </Section>
      </Reveal>

      <Label style={styles.footer}>Fuel is a Comeback metric, not a measurement</Label>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  explanation: {
    marginTop: spacing.md,
  },
  component: {
    marginBottom: spacing.lg,
  },
  componentHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  componentHelp: {
    marginTop: spacing.sm,
  },
  note: {
    marginTop: spacing.sm,
  },
  habit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  habitText: {
    flex: 1,
  },
  habitDetail: {
    marginTop: spacing.xs,
  },
  footer: {
    marginTop: spacing.xxl,
    textAlign: 'center',
  },
});
