import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design-system/Text';
import { colors, radius, spacing } from '@/design-system/tokens';
import { PrimaryButton, SecondaryButton } from './Button';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Caps the sheet height; content scrolls beyond it. */
  maxHeightRatio?: number;
};

export function BottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightRatio = 0.85,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg, maxHeight: `${maxHeightRatio * 100}%` }]}>
          <View style={styles.grabber} />
          <Text variant="title">{title}</Text>
          {subtitle ? (
            <Text variant="bodySmall" tone="secondary" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Destructive or irreversible actions ask here first. */
export function ConfirmationSheet({
  visible,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
  destructive = false,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} maxHeightRatio={0.5}>
      <Text variant="body" tone="secondary">
        {message}
      </Text>
      <View style={styles.actions}>
        {destructive ? (
          <SecondaryButton
            label={confirmLabel}
            tone="danger"
            onPress={() => {
              onConfirm();
              onClose();
            }}
          />
        ) : (
          <PrimaryButton
            label={confirmLabel}
            onPress={() => {
              onConfirm();
              onClose();
            }}
          />
        )}
        <SecondaryButton label="Cancel" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  body: {
    marginTop: spacing.lg,
  },
  bodyContent: {
    paddingBottom: spacing.md,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
