import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatTime } from '@/core/utils/time';
import { alertIcon, alertLabelKey, shortDayName, type WeatherAlert } from '@/domain';

interface Props {
  alert: WeatherAlert;
  compact?: boolean;
}

/** Tek uyarı şeridi: seviye rengi, ikon, metin ve zaman aralığı. */
export function AlertBanner({ alert, compact = false }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const tint =
    alert.level === 'danger'
      ? colors.danger
      : alert.level === 'warning'
        ? colors.warning
        : colors.info;
  const bg =
    alert.level === 'danger'
      ? colors.dangerSoft
      : alert.level === 'warning'
        ? colors.warningSoft
        : colors.infoSoft;
  const message = t(alertLabelKey(alert), { value: alert.value });
  const sameDay = alert.from.slice(0, 10) === alert.to.slice(0, 10);
  const range = sameDay
    ? `${shortDayName(alert.from, locale)} ${formatTime(alert.from)}–${formatTime(alert.to)}`
    : `${shortDayName(alert.from, locale)} ${formatTime(alert.from)} → ${shortDayName(alert.to, locale)} ${formatTime(alert.to)}`;

  return (
    <View
      style={[styles.root, compact && styles.compact, { backgroundColor: bg, borderColor: tint }]}
      accessibilityRole="alert"
      accessibilityLabel={`${t(`weather.alerts.level.${alert.level}`)}: ${message}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: tint }]}>
        <Icon
          name={alertIcon(alert.kind) as IconName}
          size={compact ? 14 : 18}
          color="#fff"
          strokeWidth={2.2}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          variant={compact ? 'bodySm' : 'body'}
          weight="semibold"
          numberOfLines={compact ? 1 : 3}
        >
          {message}
        </Text>
        {!compact ? (
          <Text variant="caption" color="textMuted">
            {t(`weather.alerts.level.${alert.level}`)} · {range}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  compact: { padding: spacing.sm, gap: spacing.sm },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
