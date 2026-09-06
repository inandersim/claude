import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';

import { SOURCE_META } from './meta';

const APPS = ['strava', 'komoot', 'alltrails', 'wikiloc', 'garmin'] as const;

/** Uygulama başına GPX dışa aktarma adımları (kısa) */
export function ImportGuide() {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <View
      style={[styles.root, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
    >
      <Text variant="title">{t('tracks.importScreen.guideTitle')}</Text>
      {APPS.map((app) => (
        <View key={app} style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.surface }]}>
            <Icon
              name={SOURCE_META[app].icon}
              size={16}
              color={SOURCE_META[app].color}
              strokeWidth={2.4}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodySm" weight="bold">
              {t(`tracks.source.${app}`)}
            </Text>
            <Text variant="caption" color="textMuted">
              {t(`tracks.importScreen.guide.${app}`)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
