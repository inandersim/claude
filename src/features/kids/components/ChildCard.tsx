import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, IconButton, Tappable, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { kidAgeBandMeta, type ChildProfile } from '@/domain';

interface Props {
  child: ChildProfile;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  compact?: boolean;
}

/**
 * Çocuk profili kartı. Seçim ve kaldırma ayrı butonlardır; dış sarmalayıcı View'dır
 * (iç içe buton kuralı).
 */
export function ChildCard({ child, selected, onPress, onRemove, compact }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const band = kidAgeBandMeta[child.ageBand];
  return (
    <View
      style={[
        styles.root,
        compact && styles.compact,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Tappable
        onPress={onPress}
        disabled={!onPress}
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel={`${child.name}, ${t(band.labelKey)}`}
        accessibilityState={{ selected: Boolean(selected) }}
        style={styles.main}
      >
        <View style={[styles.avatar, { backgroundColor: `${band.color}26` }]}>
          <Text style={styles.emoji}>{child.avatar}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant={compact ? 'body' : 'title'} weight="extrabold" numberOfLines={1}>
            {child.name}
          </Text>
          <View style={styles.bandRow}>
            <Icon name={band.icon as IconName} size={12} color={band.color} strokeWidth={2.4} />
            <Text variant="caption" color="textMuted">
              {t(band.labelKey)}
            </Text>
          </View>
        </View>
        {selected ? <Icon name="circle-check" size={20} color={colors.primary} /> : null}
      </Tappable>
      {onRemove ? (
        <IconButton
          icon="trash"
          variant="ghost"
          size={36}
          iconSize={16}
          color={colors.textSubtle}
          onPress={onRemove}
          accessibilityLabel={`${t('kids.child.remove')}: ${child.name}`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 1.5,
    paddingRight: spacing.xs,
  },
  compact: { borderRadius: radius.lg },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24, lineHeight: 30 },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
