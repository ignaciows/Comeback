import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Reveal } from '@/components/motion/Reveal';
import { NavGroup, NavRow } from '@/components/NavRow';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { useBodyWeightSeries, useNextStep } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';

/**
 * You: the handful of facts the plan is built out of.
 *
 * This tab used to carry the plan, the routine and the plan comparison as
 * well, which put three routes to the same places in two different tabs. Those
 * belong where the plan lives. What is left here is only what is true about
 * *you* — your name, your weight, your gym, the days you can train — plus the
 * app's own drawers at the bottom.
 *
 * When the setup is unfinished the bar at the top says so with a number and a
 * single next step, because "you are three quarters of the way there" is a
 * reason to finish and a list of missing fields is a reason to close the app.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const training = useAppStore((state) => state.training);
  const gyms = useAppStore((state) => state.gyms);
  const weights = useBodyWeightSeries();
  const { setup, progress } = useNextStep();

  const gym = gyms.find((entry) => entry.id === training.gymId) ?? gyms[0] ?? null;
  const latest = weights[weights.length - 1] ?? null;
  const next = setup[0] ?? null;

  return (
    <Screen>
      <Reveal index={0}>
        <View style={styles.identity}>
          <Text variant="title">{profile?.name || 'You'}</Text>
          <Text variant="body" tone="secondary" style={styles.identityLine}>
            {latest
              ? `${latest.weightKg.toFixed(1)} kg${profile?.heightCm ? ` · ${profile.heightCm} cm` : ''}`
              : 'No weight logged yet'}
          </Text>
        </View>
      </Reveal>

      {next ? (
        <Reveal index={1}>
          <View style={styles.setup}>
            <View style={styles.setupHead}>
              <Label>Setting up</Label>
              <Text variant="caption" tone="tertiary" mono>
                {`${Math.round(progress * 100)}%`}
              </Text>
            </View>
            <ProgressBar value={progress} style={styles.setupBar} />
            <NavRow label={next.label} icon={next.icon} detail={next.why} tone="accent" onPress={() => router.push(next.route)} />
          </View>
        </Reveal>
      ) : null}

      <Reveal index={2}>
        <NavGroup>
          <NavRow
            label="Your details"
            icon="body"
            value={profile?.name || 'Set them'}
            detail="Name, height, birthday"
            onPress={() => router.push('/you')}
          />
          <NavRow
            label="Your weight"
            icon="progress"
            value={latest ? `${latest.weightKg.toFixed(1)} kg` : 'Log it'}
            tone={latest ? 'neutral' : 'accent'}
            dot={!latest}
            onPress={() => router.push('/log-weight')}
          />
          <NavRow
            label="Your gym"
            icon="gym"
            value={gym ? gym.name.split(' · ')[0] : 'Find one'}
            detail={gym ? undefined : 'The plan is guessing at your equipment'}
            tone={gym ? 'neutral' : 'accent'}
            dot={!gym}
            onPress={() => router.push(gym ? '/gym' : '/gyms')}
          />
          <NavRow
            label="The days you train"
            icon="calendar"
            value={`${training.preferredDaysPerWeek} a week`}
            onPress={() => router.push('/schedule')}
          />
          <NavRow
            label="Your body"
            icon="body"
            detail="Now, and at the end of each phase"
            onPress={() => router.push('/body-shape')}
          />
        </NavGroup>
      </Reveal>

      <Label style={styles.label}>The app</Label>
      <Reveal index={3}>
        <NavGroup>
          <NavRow label="How it works" icon="method" onPress={() => router.push('/method')} />
          <NavRow label="Where the numbers come from" icon="sources" onPress={() => router.push('/sources')} />
          <NavRow label="Your data" icon="trash" detail="Export or delete everything" onPress={() => router.push('/data')} />
        </NavGroup>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    marginBottom: spacing.xl,
  },
  identityLine: {
    marginTop: spacing.xs,
  },
  setup: {
    marginBottom: spacing.xl,
    padding: spacing.lg,
    paddingBottom: 0,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSurface,
  },
  setupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setupBar: {
    marginTop: spacing.sm,
  },
  label: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
});
