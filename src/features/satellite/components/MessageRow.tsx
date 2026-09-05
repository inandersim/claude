import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import {
  checkinPresetFromText,
  decodeSatMessage,
  LINK_META,
  nextRetryDelayS,
  SAT_KIND_META,
  SAT_MAX_ATTEMPTS,
  type SatMessage,
} from '@/domain';

interface Props {
  message: SatMessage;
}

/** Tek uydu mesajı satırı: tür ikonu, çözülmüş gövde, durum rozeti ve deneme sayısı. */
export function MessageRow({ message }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const meta = SAT_KIND_META[message.kind];
  const decoded = decodeSatMessage(message.body);
  const preset = message.kind === 'checkin' ? checkinPresetFromText(decoded.text) : null;
  const pending = message.status === 'queued' || message.status === 'sending';
  const statusColor: Record<SatMessage['status'], string> = {
    queued: colors.warning,
    sending: colors.info,
    sent: colors.info,
    delivered: colors.success,
    failed: colors.danger,
  };
  const statusIcon: Record<SatMessage['status'], IconName> = {
    queued: 'hourglass',
    sending: 'send',
    sent: 'check',
    delivered: 'check-check',
    failed: 'circle-x',
  };
  const kindColor = message.kind === 'sos' ? colors.danger : colors.primary;
  const text = preset
    ? `${t(preset.labelKey)} — ${decoded.text.slice(preset.code.length).trim()}`
    : decoded.text || (message.kind === 'location' ? t('satellite.kind.location') : message.body);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: pending ? colors.surfaceMuted : colors.surface,
          borderColor: message.kind === 'sos' ? colors.danger : colors.border,
        },
      ]}
      accessibilityLabel={`${t(meta.labelKey)}: ${text}. ${t(`satellite.status.${message.status}`)}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${kindColor}22` }]}>
        <Icon name={meta.icon as IconName} size={18} color={kindColor} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.titleRow}>
          <Text variant="label" color="textSubtle">
            {t(meta.labelKey)}
            {decoded.time ? ` · ${decoded.time}` : ''}
          </Text>
          <Badge
            label={t(`satellite.status.${message.status}`)}
            color={statusColor[message.status]}
            icon={statusIcon[message.status]}
            soft
          />
        </View>
        <Text variant="body" numberOfLines={3}>
          {text}
        </Text>
        <View style={styles.metaRow}>
          {decoded.coords ? (
            <View style={styles.metaItem}>
              <Icon name="map-pin" size={12} color={colors.textSubtle} />
              <Text variant="caption" color="textSubtle">
                {decoded.coords.latitude.toFixed(4)}, {decoded.coords.longitude.toFixed(4)}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Icon
              name={LINK_META[message.link].icon as IconName}
              size={12}
              color={colors.textSubtle}
            />
            <Text variant="caption" color="textSubtle">
              {formatRelative(message.createdAt, new Date(), locale)}
            </Text>
          </View>
          {message.attempts > 1 || pending || message.status === 'failed' ? (
            <View style={styles.metaItem}>
              <Icon name="repeat" size={12} color={colors.textSubtle} />
              <Text variant="caption" color="textSubtle">
                {t('satellite.attempts', { count: message.attempts })}
                {pending && message.attempts < SAT_MAX_ATTEMPTS
                  ? ` · ${t('satellite.nextRetry', { seconds: nextRetryDelayS(message.attempts) })}`
                  : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
