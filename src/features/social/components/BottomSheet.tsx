import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}

/** Sosyal aksiyonlar için ortak alt sayfa (tepki, kaydet, yeniden paylaş, oluştur). */
export function BottomSheet({ visible, onClose, title, subtitle, children }: Props) {
  const { colors } = useTheme();
  const { t } = useT();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.close')}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.wrap, { pointerEvents: 'box-none' }]}
      >
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceElevated, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          {title ? (
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text variant="h3">{title}</Text>
                {subtitle ? (
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <IconButton icon="x" onPress={onClose} accessibilityLabel={t('common.close')} />
            </View>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.sm,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
