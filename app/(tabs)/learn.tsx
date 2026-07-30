import { useRouter } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/Button';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { TRACKS } from '@/data/lessons';
import { learningSummary, trackProgress } from '@/domain/learning';
import { artFor } from '@/features/learn/lessonArt';
import { useAppStore } from '@/store/useAppStore';

/**
 * The part of the app that explains the rest of it.
 *
 * Someone new does not need another screen of controls — they need to know
 * what a set is for and why the app keeps mentioning protein. So this is the
 * only screen with no numbers of yours on it: just the ideas, one at a time,
 * in the order they build on each other.
 *
 * There is always exactly one obvious thing to press. The hero is the next
 * unread lesson; everything below it is there for browsing, not for deciding.
 */
export default function LearnScreen() {
  const router = useRouter();
  const records = useAppStore((state) => state.lessons);

  const summary = learningSummary(records);
  const progress = trackProgress(records);

  return (
    <Screen>
      {/* One decision: carry on. */}
      <Reveal index={0}>
        <View style={styles.hero}>
          <Label>{summary.finished ? 'All read' : `${summary.done} of ${summary.total} read`}</Label>

          <Text variant="display" style={styles.heroTitle}>
            {summary.next ? summary.next.lesson.title : 'You have read them all'}
          </Text>

          <Text variant="body" tone="secondary" style={styles.heroLine}>
            {summary.next
              ? summary.next.lesson.takeaway
              : 'Everything in here stays available — come back whenever something stops making sense.'}
          </Text>

          {summary.next ? (
            <PrimaryButton
              label={summary.done === 0 ? 'Start' : 'Continue'}
              onPress={() =>
                router.push({ pathname: '/lesson/[id]', params: { id: summary.next!.lesson.id } })
              }
              style={styles.cta}
            />
          ) : null}
        </View>
      </Reveal>

      {progress.map((entry, index) => (
        <Reveal key={entry.track.id} index={index + 1}>
          <View style={styles.track}>
            <View style={styles.trackHead}>
              <View style={styles.trackTitles}>
                <Text variant="title">{entry.track.title}</Text>
                <Text variant="caption" tone="tertiary">
                  {entry.track.subtitle}
                </Text>
              </View>
              <Text variant="caption" tone="tertiary" mono>
                {`${entry.done}/${entry.total}`}
              </Text>
            </View>

            {/* One square per lesson, filled as it is read — the same shape the
                journal uses, so progress looks the same everywhere. */}
            <View style={styles.pips}>
              {entry.track.lessons.map((lesson) => {
                const done = records.some((record) => record.lessonId === lesson.id);
                return <View key={lesson.id} style={[styles.pip, done && styles.pipDone]} />;
              })}
            </View>

            {entry.track.lessons.map((lesson) => {
              const done = records.some((record) => record.lessonId === lesson.id);
              const art = artFor(lesson.art);

              return (
                <Pressable
                  key={lesson.id}
                  onPress={() => router.push({ pathname: '/lesson/[id]', params: { id: lesson.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={lesson.title}
                  style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
                >
                  <View style={styles.thumb}>
                    {art ? (
                      <Image source={art} style={styles.thumbImage} resizeMode="cover" />
                    ) : (
                      <Icon name="body" size={18} color={colors.textTertiary} />
                    )}
                  </View>

                  <View style={styles.rowText}>
                    <Text variant="body">{lesson.title}</Text>
                    <Text variant="caption" tone="tertiary" numberOfLines={1}>
                      {lesson.takeaway}
                    </Text>
                  </View>

                  {done ? (
                    <Icon name="check" size={16} color={colors.accent} />
                  ) : (
                    <Icon name="chevronRight" size={16} color={colors.textTertiary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Reveal>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginBottom: spacing.xxl,
  },
  heroTitle: {
    marginTop: spacing.sm,
  },
  heroLine: {
    marginTop: spacing.md,
  },
  cta: {
    marginTop: spacing.xl,
  },
  track: {
    marginBottom: spacing.xxl,
  },
  trackHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  trackTitles: {
    flex: 1,
    gap: spacing.xs,
  },
  pips: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  pip: {
    width: 22,
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
  },
  pipDone: {
    backgroundColor: colors.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  thumb: {
    width: 52,
    height: 40,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
});
