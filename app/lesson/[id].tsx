import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { PrimaryButton, TextButton } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { motion } from '@/design-system/motion';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { findLesson, nextLesson } from '@/data/lessons';
import { artFor } from '@/features/learn/lessonArt';
import { useAppStore } from '@/store/useAppStore';

/**
 * One lesson, one idea, one screen at a time.
 *
 * The shape is deliberate: art, then the cards one after another, then a
 * single question. Nothing is scrollable past — you move through it, which is
 * what makes it feel like progress rather than a document.
 *
 * The question is not marked. Getting it wrong shows the same explanation as
 * getting it right, because the explanation is the teaching and withholding it
 * from the person who needed it most would be exactly backwards.
 */
export default function LessonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const completeLesson = useAppStore((state) => state.completeLesson);
  const alreadyRead = useAppStore((state) => state.lessons.some((entry) => entry.lessonId === id));

  const found = findLesson(id ?? '');

  // Step 0..cards.length-1 are the cards; the last step is the check.
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  if (!found) {
    return (
      <Screen scroll={false}>
        <View style={styles.centre}>
          <Text variant="body" tone="secondary">
            That lesson is not here any more.
          </Text>
          <TextButton label="Back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const { lesson, track } = found;
  const art = artFor(lesson.art);
  const onCheck = step >= lesson.cards.length;
  const answered = picked !== null;
  const after = nextLesson(lesson.id);

  const advance = () => {
    Haptics.selectionAsync();
    setStep((value) => value + 1);
  };

  const answer = (index: number) => {
    if (answered) return;
    setPicked(index);
    Haptics.notificationAsync(
      index === lesson.check.answer
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    // Read is read. Whether the check went well only colours the record.
    completeLesson(lesson.id, index === lesson.check.answer);
  };

  return (
    <Screen bottomInset={spacing.xxl}>
      {/* Progress through this lesson, and the way out. */}
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={20} color={colors.textTertiary} />
        </Pressable>
        <View style={styles.bar}>
          {Array.from({ length: lesson.cards.length + 1 }, (_, index) => (
            <View key={index} style={[styles.barCell, index <= step && styles.barCellOn]} />
          ))}
        </View>
      </View>

      <Label style={styles.track}>{track.title}</Label>
      <Text variant="display" style={styles.title}>
        {lesson.title}
      </Text>

      {art ? <Image source={art} style={styles.art} resizeMode="contain" /> : null}

      {/* Cards accumulate rather than replacing each other: by the time the
          question arrives, the whole argument is still on screen. */}
      {lesson.cards.slice(0, Math.min(step + 1, lesson.cards.length)).map((card, index) => (
        <Animated.View key={index} entering={FadeIn.duration(motion.duration.base)} style={styles.card}>
          <Text variant="body">{card.text}</Text>
          {card.note ? (
            <Text variant="caption" tone="tertiary" style={styles.note}>
              {card.note}
            </Text>
          ) : null}
        </Animated.View>
      ))}

      {!onCheck ? (
        <PrimaryButton
          label={step === lesson.cards.length - 1 ? 'One question' : 'Next'}
          onPress={advance}
          style={styles.cta}
        />
      ) : (
        <Animated.View entering={FadeIn.duration(motion.duration.base)} exiting={FadeOut}>
          <View style={styles.checkHead}>
            <Icon name="target" size={16} color={colors.accent} />
            <Text variant="title" style={styles.question}>
              {lesson.check.question}
            </Text>
          </View>

          {lesson.check.options.map((option, index) => {
            const isAnswer = index === lesson.check.answer;
            const isPicked = index === picked;

            return (
              <Pressable
                key={option}
                onPress={() => answer(index)}
                disabled={answered}
                accessibilityRole="button"
                accessibilityState={{ selected: isPicked }}
                style={({ pressed }) => [
                  styles.option,
                  pressed && !answered && { opacity: opacity.pressed },
                  answered && isAnswer && styles.optionRight,
                  answered && isPicked && !isAnswer && styles.optionWrong,
                ]}
              >
                <Text variant="body" style={styles.optionText}>
                  {option}
                </Text>
                {answered && isAnswer ? <Icon name="check" size={16} color={colors.accent} /> : null}
              </Pressable>
            );
          })}

          {answered ? (
            <Animated.View entering={FadeIn.duration(motion.duration.base)} style={styles.because}>
              <Text variant="body">{lesson.check.because}</Text>
              <Text variant="caption" tone="tertiary" style={styles.source}>
                {lesson.source}
              </Text>
            </Animated.View>
          ) : null}

          {answered ? (
            after ? (
              <PrimaryButton
                label="Next lesson"
                onPress={() => router.replace({ pathname: '/lesson/[id]', params: { id: after.lesson.id } })}
                style={styles.cta}
              />
            ) : (
              <PrimaryButton label="Done" onPress={() => router.back()} style={styles.cta} />
            )
          ) : null}

          {answered && after ? (
            <TextButton label="Stop here" onPress={() => router.back()} style={styles.stop} />
          ) : null}
        </Animated.View>
      )}

      {alreadyRead && !answered ? (
        <Text variant="caption" tone="tertiary" style={styles.reread}>
          You have read this one before.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  barCell: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  barCellOn: {
    backgroundColor: colors.accent,
  },
  track: {
    marginBottom: spacing.sm,
  },
  title: {
    marginBottom: spacing.xl,
  },
  art: {
    width: '100%',
    height: 180,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
  },
  card: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  note: {
    lineHeight: 18,
  },
  cta: {
    marginTop: spacing.xl,
  },
  checkHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  question: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  optionRight: {
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSurface,
  },
  optionWrong: {
    borderColor: colors.border,
    opacity: opacity.disabled,
  },
  optionText: {
    flex: 1,
  },
  because: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  source: {
    lineHeight: 16,
  },
  stop: {
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  reread: {
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
