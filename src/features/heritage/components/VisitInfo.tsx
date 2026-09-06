import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatAltitude } from '@/core/utils/format';
import { formatDuration } from '@/core/utils/time';
import { heritageFeeLabel, heritageOpenNow, type HeritageSite } from '@/domain';

import { accessibilityKey } from './meta';

interface Props {
  site: HeritageSite;
  /** Render içinde Date.now() çağrılmaması için dışarıdan verilir */
  now: Date;
}

/** Ziyaret bilgileri: saat + açık mı, ücret + Müzekart, süre, erişilebilirlik, rakım. */
export function VisitInfo({ site, now }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const open = heritageOpenNow(site, now);
  const openColor = open === null ? colors.textSubtle : open ? colors.success : colors.danger;
  const openLabel =
    open === null
      ? t('heritage.hoursUnknown')
      : open
        ? t('heritage.openNow')
        : t('heritage.closed');
  const accessColor =
    site.accessibility === 'easy'
      ? colors.success
      : site.accessibility === 'moderate'
        ? colors.warning
        : colors.danger;

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Row icon="clock" label={t('heritage.hours')} value={site.openingHours}>
        <View style={[styles.dotRow]}>
          <View style={[styles.dot, { backgroundColor: openColor }]} />
          <Text variant="caption" weight="bold" color={openColor}>
            {openLabel}
          </Text>
        </View>
      </Row>
      <Row
        icon="ticket"
        label={t('heritage.fee')}
        value={heritageFeeLabel(site, locale, t('heritage.free'))}
      >
        {site.entryFeeTry ? (
          <Text variant="caption" color={site.museumPassValid ? 'success' : 'textSubtle'}>
            {site.museumPassValid ? t('heritage.museumPass') : t('heritage.museumPassNo')}
          </Text>
        ) : null}
      </Row>
      <Row
        icon="hourglass"
        label={t('heritage.visitDuration')}
        value={formatDuration(site.visitDurationMin, locale)}
      />
      <Row
        icon="footprints"
        label={t('heritage.accessibility.title')}
        value={t(accessibilityKey(site.accessibility))}
      >
        <View style={[styles.dot, { backgroundColor: accessColor }]} />
      </Row>
      {site.elevationM !== null ? (
        <Row
          icon="mountain"
          label={t('heritage.elevation')}
          value={formatAltitude(site.elevationM, locale)}
          last
        />
      ) : null}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  children,
  last = false,
}: {
  icon: 'clock' | 'ticket' | 'hourglass' | 'footprints' | 'mountain';
  label: string;
  value: string;
  children?: React.ReactNode;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" color="textSubtle">
          {label}
        </Text>
        <Text variant="body" weight="semibold">
          {value}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
