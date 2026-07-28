import { useRouter } from 'expo-router';

import { Reveal } from '@/components/motion/Reveal';
import { NavGroup, NavRow } from '@/components/NavRow';
import { Screen } from '@/components/Screen';
import { Label, Text } from '@/design-system/Text';
import { spacing } from '@/design-system/tokens';
import { strategyProfile } from '@/domain/plan/strategies';
import { useActiveRoutine, useBodyWeightSeries } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';

/**
 * Rows only, each with its own glyph.
 *
 * A column of six identical text rows is a wall you read top to bottom; the
 * same six with a symbol each is something you find your place in. Detail
 * lines are used only where the label genuinely does not answer the row.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const goal = useAppStore((state) => state.goal);
  const training = useAppStore((state) => state.training);
  const gyms = useAppStore((state) => state.gyms);
  const routine = useActiveRoutine();
  const weights = useBodyWeightSeries();

  const gym = gyms.find((entry) => entry.id === training.gymId) ?? gyms[0] ?? null;
  const latest = weights[weights.length - 1] ?? null;

  return (
    <Screen>
      <Reveal index={0}>
        <Text variant="title" style={styles.title}>
          Profile
        </Text>
      </Reveal>

      <Reveal index={1}>
        <NavGroup>
          {/* Until a gym is set the app is guessing at the equipment, so this
              sits first and marks itself until it is answered. */}
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
            label="You"
            icon="body"
            value={profile?.name || 'Set your name'}
            detail={latest ? `${latest.weightKg.toFixed(1)} kg · ${profile?.heightCm ?? '—'} cm` : undefined}
            onPress={() => router.push('/you')}
          />
          <NavRow
            label="Plan"
            icon="target"
            value={goal ? strategyProfile(goal.strategy).label : '—'}
            onPress={() => router.push('/adjust')}
          />
          <NavRow label="Compare plans" icon="progress" onPress={() => router.push('/routes')} />
          <NavRow
            label="Schedule"
            icon="calendar"
            value={`${training.preferredDaysPerWeek} days`}
            onPress={() => router.push('/schedule')}
          />
          <NavRow
            label="Routine"
            icon="train"
            value={routine ? `${routine.days.length} days` : '—'}
            onPress={() => router.push('/routine')}
          />
        </NavGroup>
      </Reveal>

      <Label style={styles.label}>App</Label>
      <Reveal index={2}>
        <NavGroup>
          <NavRow label="Method" icon="method" onPress={() => router.push('/method')} />
          <NavRow label="Data sources" icon="sources" value="Manual" onPress={() => router.push('/sources')} />
          <NavRow label="Your data" icon="trash" onPress={() => router.push('/data')} />
        </NavGroup>
      </Reveal>
    </Screen>
  );
}

const styles = {
  title: {
    marginBottom: spacing.xl,
  },
  label: {
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
} as const;
