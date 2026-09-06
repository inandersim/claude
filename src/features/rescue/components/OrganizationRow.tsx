import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { dialUrl, localizedText, type RescueOrganization, type RescueScope } from '@/domain';

const SCOPE_ICON: Record<RescueScope, IconName> = {
  mountain: 'mountain',
  sea: 'anchor',
  cave: 'layers',
  medical: 'heart-pulse',
  general: 'life-buoy',
};

/** Kurtarma örgütü satırı: kapsam ikonu, ad, not; ara / web düğmeleri. */
export function OrganizationRow({ org }: { org: RescueOrganization }) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const scopeColor: Record<RescueScope, string> = {
    mountain: colors.primary,
    sea: colors.info,
    cave: colors.accent,
    medical: colors.danger,
    general: colors.textMuted,
  };
  const color = scopeColor[org.scope];

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: `${color}22` }]}>
        <Icon name={SCOPE_ICON[org.scope]} size={18} color={color} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="title" numberOfLines={2}>
          {org.name}
        </Text>
        <Text variant="caption" color="textSubtle">
          {t(`rescue.scope.${org.scope}`)}
          {org.phone ? ` · ${org.phone}` : ''}
        </Text>
        <Text variant="caption" color="textMuted">
          {localizedText(org.note, locale)}
        </Text>
      </View>
      <View style={styles.actions}>
        {org.phone ? (
          <Button
            label={t('rescue.call')}
            icon="phone"
            size="sm"
            variant="secondary"
            onPress={() => Linking.openURL(dialUrl(org.phone ?? '')).catch(() => undefined)}
            accessibilityLabel={`${t('rescue.call')} ${org.name} ${org.phone}`}
          />
        ) : null}
        {org.url ? (
          <Button
            label={t('rescue.website')}
            icon="external-link"
            size="sm"
            variant="ghost"
            onPress={() => Linking.openURL(org.url ?? '').catch(() => undefined)}
            accessibilityLabel={`${org.name} ${t('rescue.website')}`}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: spacing.xs, alignItems: 'flex-end' },
});
