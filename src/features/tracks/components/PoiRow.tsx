import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Button, Chip, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDistance, type PoiKind, type TrackPoi, type TrackPoiWithDistance } from '@/domain';

import { POI_COLOR, POI_ICON } from './meta';

interface ChipProps {
  kind: PoiKind;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
}

/** POI türü çipi (filtre / tür seçimi) */
export function PoiChip({ kind, selected = false, onPress, size = 'md' }: ChipProps) {
  const { t } = useT();
  return (
    <Chip
      label={t(`tracks.poi.kind.${kind}`)}
      icon={POI_ICON[kind]}
      color={POI_COLOR[kind]}
      selected={selected}
      onPress={onPress}
      size={size}
    />
  );
}

interface RowProps {
  poi: TrackPoi | TrackPoiWithDistance;
  onConfirm?: () => void;
  confirming?: boolean;
  /** Onay yerine "Ekle" eylemi (medya önerileri) */
  actionLabel?: string;
  onAction?: () => void;
}

/** POI satırı: tür ikonu, ad, not, onay sayısı, mesafe; sağda onay/ekle düğmesi */
export function PoiRow({ poi, onConfirm, confirming = false, actionLabel, onAction }: RowProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const withDistance = poi as Partial<TrackPoiWithDistance>;
  const confirmedByMe = withDistance.confirmedByMe ?? false;
  const distance = withDistance.distanceKm ?? null;

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: POI_COLOR[poi.kind] }]}>
        <Icon name={POI_ICON[poi.kind]} size={16} color="#06120B" strokeWidth={2.6} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
            {poi.name}
          </Text>
          {poi.source !== 'user' && poi.source !== 'track' ? (
            <Badge label={t('tracks.poi.fromMedia')} color={colors.accent} icon="camera" soft />
          ) : null}
        </View>
        {poi.note ? (
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {poi.note}
          </Text>
        ) : null}
        <Text variant="label" color="textSubtle">
          {t(`tracks.poi.kind.${poi.kind}`)}
          {' · '}
          {t('tracks.poi.confirmations', { count: poi.confirmations })}
          {distance !== null ? ` · ${formatDistance(distance, locale)}` : ''}
          {poi.elevationM !== null ? ` · ${poi.elevationM} m` : ''}
        </Text>
      </View>
      {onAction && actionLabel ? (
        <Button label={actionLabel} size="sm" variant="secondary" icon="plus" onPress={onAction} />
      ) : onConfirm ? (
        confirmedByMe ? (
          <Badge label={t('tracks.poi.confirmed')} color={colors.success} icon="check" soft />
        ) : (
          <Button
            label={t('tracks.poi.confirm')}
            size="sm"
            variant="secondary"
            icon="circle-check"
            onPress={onConfirm}
            loading={confirming}
          />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
