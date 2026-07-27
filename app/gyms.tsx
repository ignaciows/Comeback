import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SecondaryButton } from '@/components/Button';
import { EmptyState, ErrorState, LoadingState, Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { EQUIPMENT_LABELS } from '@/data/exercises';
import type { EquipmentId } from '@/domain/types';
import {
  CITIES,
  equipmentSummary,
  formatDistance,
  searchGyms,
  type GymSearchResult,
} from '@/services/gyms/gymSearch';
import { useAppStore } from '@/store/useAppStore';

/**
 * Find a gym, and know what is in it before you go.
 *
 * Locations come from OpenStreetMap. Equipment does not exist in that data, so
 * it comes from the chain profiles and is labelled as typical rather than
 * confirmed — an independent gym shows as unknown instead of being guessed at.
 */
export default function GymsScreen() {
  const router = useRouter();
  const adoptGym = useAppStore((state) => state.adoptGym);

  const [city, setCity] = useState<string>('cologne');
  const [useMyLocation, setUseMyLocation] = useState(false);
  const [results, setResults] = useState<GymSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let origin = CITIES.find((entry) => entry.id === city) ?? CITIES[0];

      if (useMyLocation) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          setError('Location permission was declined. Pick a city instead.');
          setUseMyLocation(false);
          setLoading(false);
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        origin = {
          id: 'me',
          label: 'Near me',
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        };
      }

      const found = await searchGyms({ lat: origin.lat, lon: origin.lon, radius: 4000 });
      setResults(found);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not reach the map service');
    } finally {
      setLoading(false);
    }
  }, [city, useMyLocation]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <Screen>
      <Header
        title="Find a gym"
        subtitle={useMyLocation ? 'Near you' : CITIES.find((entry) => entry.id === city)?.label}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Section>
        <SegmentedControl
          options={CITIES.map((entry) => ({ value: entry.id, label: entry.label }))}
          value={useMyLocation ? null : city}
          onChange={(value) => {
            setUseMyLocation(false);
            setCity(value);
          }}
          layout="wrap"
        />
        <SecondaryButton
          label="Search near me"
          onPress={() => setUseMyLocation(true)}
          style={styles.locate}
        />
      </Section>

      {loading ? <LoadingState label="Searching" /> : null}

      {error ? (
        <ErrorState description={error} onRetry={() => void run()} />
      ) : null}

      {!loading && !error && results?.length === 0 ? (
        <EmptyState
          title="Nothing found here"
          description="No gyms are mapped within four kilometres. Try another city, or add your gym by hand."
          action={{ label: 'Add manually', onPress: () => router.push('/gym') }}
        />
      ) : null}

      {results && results.length > 0 ? (
        <View style={styles.list}>
          {results.slice(0, 25).map((result, index) => (
            <Reveal key={result.id} index={Math.min(index, 8)}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  adoptGym({
                    name: result.name,
                    equipment: result.equipment,
                    address: result.address,
                    source: result.equipmentSource,
                  });
                  router.back();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.card, pressed && { opacity: opacity.pressed }]}
              >
                <View style={styles.cardHead}>
                  <Text variant="heading">{result.name}</Text>
                  <Text variant="caption" tone="tertiary" mono>
                    {formatDistance(result.distanceMeters)}
                  </Text>
                </View>

                {result.address ? (
                  <Text variant="bodySmall" tone="secondary" style={styles.address}>
                    {result.address}
                  </Text>
                ) : null}

                <View style={styles.tags}>
                  <StatusPill
                    label={equipmentSummary(result)}
                    tone={result.equipmentSource === 'chain' ? 'accent' : 'neutral'}
                  />
                  {result.chain ? <StatusPill label={result.chain.label} tone="info" /> : null}
                </View>

                {result.chain ? (
                  <Text variant="caption" tone="tertiary" style={styles.note}>
                    {result.chain.note}
                  </Text>
                ) : null}

                {result.equipmentSource === 'chain' ? (
                  <View style={styles.equipment}>
                    {(Object.keys(result.equipment) as EquipmentId[])
                      .filter((key) => result.equipment[key] === 'available')
                      .map((key) => (
                        <Label key={key}>{EQUIPMENT_LABELS[key]}</Label>
                      ))}
                  </View>
                ) : null}

                {result.openingHours ? (
                  <Text variant="caption" tone="tertiary" style={styles.hours}>
                    {result.openingHours}
                  </Text>
                ) : null}
              </Pressable>
            </Reveal>
          ))}
        </View>
      ) : null}

      <Note style={styles.footer}>
        Locations from OpenStreetMap; yoga, pilates and class-only studios are left out. Equipment is what the chain
        normally has — confirm it on your first visit and the app will use what you saw instead.
      </Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  locate: {
    marginTop: spacing.lg,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  address: {
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  note: {
    marginTop: spacing.sm,
  },
  equipment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  hours: {
    marginTop: spacing.sm,
  },
  footer: {
    marginTop: spacing.xl,
  },
});
