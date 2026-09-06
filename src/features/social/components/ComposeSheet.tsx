import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';

import { BottomSheet } from './BottomSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** "+" seçim sayfası: Macera paylaş / Durum paylaş */
export function ComposeSheet({ visible, onClose }: Props) {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();

  const go = (pathname: '/post/new' | '/post/status') => {
    onClose();
    router.push(pathname);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('social.compose.title')}>
      <View style={styles.options}>
        <Option
          icon="mountain-snow"
          color={colors.primary}
          title={t('social.compose.adventure')}
          hint={t('social.compose.adventureHint')}
          onPress={() => go('/post/new')}
        />
        <Option
          icon="image-plus"
          color={colors.accent}
          title={t('social.compose.status')}
          hint={t('social.compose.statusHint')}
          onPress={() => go('/post/status')}
        />
      </View>
    </BottomSheet>
  );
}

function Option({
  icon,
  color,
  title,
  hint,
  onPress,
}: {
  icon: IconName;
  color: string;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Tappable
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.option, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={hint}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
        <Icon name={icon} size={22} color={color} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="title">{title}</Text>
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textSubtle} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  options: { gap: spacing.sm, marginTop: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
