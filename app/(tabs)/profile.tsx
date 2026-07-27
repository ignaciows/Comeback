import { useRouter } from 'expo-router';

import { Reveal } from '@/components/motion/Reveal';
import { NavGroup, NavRow } from '@/components/NavRow';
import { Screen } from '@/components/Screen';
import { Label, Text } from '@/design-system/Text';
import { spacing } from '@/design-system/tokens';
import { strategyProfile } from '@/domain/plan/strategies';
import { useActiveRoutine, useBodyWeightSeries } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';

/** Rows only. Every setting lives on its own screen, one tap away. */
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
          <NavRow
            label="You"
            value={profile?.name || 'Set your name'}
            detail={latest ? `${latest.weightKg.toFixed(1)} kg · ${profile?.heightCm ?? '—'} cm` : undefined}
            onPress={() => router.push('/you')}
          />
          <NavRow
            label="Plan"
            value={goal ? strategyProfile(goal.strategy).label : '—'}
            detail={goal?.targetWeightKg ? `Target ${goal.targetWeightKg.toFixed(1)} kg` : 'No target set'}
            onPress={() => router.push('/plan')}
          />
          <NavRow
            label="Compare plans"
            detail="Build then cut, lean build, cut first"
            onPress={() => router.push('/routes')}
          />
          <NavRow
            label="Schedule"
            value={`${training.preferredDaysPerWeek} days`}
            detail={`${training.sessionMinutes} min · ${training.location}`}
            onPress={() => router.push('/schedule')}
          />
          <NavRow
            label="Routine"
            value={routine ? `${routine.days.length} days` : '—'}
            detail={routine?.name}
            onPress={() => router.push('/routine')}
          />
          <NavRow
            label="Gym"
            value={gym?.name ?? 'Not set'}
            onPress={() => router.push('/gym')}
          />
        </NavGroup>
      </Reveal>

      <Label style={styles.label}>App</Label>
      <Reveal index={2}>
        <NavGroup>
          <NavRow label="Method" detail="What the plans are built from" onPress={() => router.push('/method')} />
          <NavRow label="Data sources" value="Manual" onPress={() => router.push('/sources')} />
          <NavRow label="Your data" detail="Sample history, delete everything" onPress={() => router.push('/data')} />
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
