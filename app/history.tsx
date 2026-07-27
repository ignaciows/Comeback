import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { EmptyState } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { MetricRow } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { sessionDurationMinutes, sessionSetCount, sessionVolume } from '@/domain/training/metrics';
import { useCompletedSessions } from '@/store/hooks';
import { formatShortDate } from '@/utils/date';

export default function HistoryScreen() {
  const router = useRouter();
  const sessions = useCompletedSessions();

  return (
    <Screen>
      <Header
        title="History"
        subtitle={`${sessions.length} session${sessions.length === 1 ? '' : 's'} logged`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Section>
        {sessions.length === 0 ? (
          <EmptyState title="Nothing logged yet" description="Sessions appear here once you finish one." />
        ) : (
          sessions.map((session, index) => (
            <View key={session.id}>
              {index > 0 ? <Divider /> : null}
              <MetricRow
                label={session.name}
                detail={`${formatShortDate(session.date)} · ${sessionSetCount(session)} sets · ${
                  sessionDurationMinutes(session) ?? '—'
                } min`}
                value={`${Math.round(sessionVolume(session)).toLocaleString()} kg`}
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: session.id } })}
              />
            </View>
          ))
        )}
      </Section>
    </Screen>
  );
}
