import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { MetricRow } from '@/components/Metric';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS, searchExercises } from '@/data/exercises';
import { bestE1rmByExercise } from '@/domain/training/metrics';
import { useCompletedSessions } from '@/store/hooks';

/**
 * The whole exercise library. Each row opens how to do it and your history
 * with it — searching here is how you look up technique outside a session.
 */
export default function ExercisesScreen() {
  const router = useRouter();
  const sessions = useCompletedSessions();
  const [query, setQuery] = useState('');

  const bests = useMemo(() => bestE1rmByExercise(sessions), [sessions]);
  const results = useMemo(() => searchExercises(query), [query]);

  return (
    <Screen>
      <Header
        title="Exercises"
        subtitle={`${results.length} movements`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Input
        value={query}
        onChangeText={setQuery}
        placeholder="Search"
        autoCorrect={false}
        style={styles.search}
      />

      <Reveal>
        <Section>
          {results.map((exercise, index) => (
            <View key={exercise.id}>
              {index > 0 ? <Divider /> : null}
              <MetricRow
                label={exercise.name}
                detail={MUSCLE_GROUP_LABELS[exercise.primaryMuscle]}
                value={bests[exercise.id] ? `${bests[exercise.id]} kg` : ''}
                onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
              />
            </View>
          ))}
        </Section>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    marginBottom: spacing.xl,
  },
});
