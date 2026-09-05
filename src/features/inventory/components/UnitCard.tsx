import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatPriceTry, type StayUnit } from '@/domain';

import { UNIT_KIND_ICON } from './meta';

export interface UnitCardProps {
  unit: StayUnit;
  selected?: boolean;
  onPress?: () => void;
  /** Sağ üstte gösterilecek ek rozet (örn. "3 boş") */
  badge?: string;
  /** Sağ alt köşe eylemi (düzenle vb.) — Tappable içinde buton olmaz, metin olarak */
  actionLabel?: string;
}

/** Birim kartı: tür ikonu, kapasite, taban fiyat, olanaklar. */
export function UnitCard({ unit, selected = false, onPress, badge, actionLabel }: UnitCardProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const body = (
    <>
      <View style={styles.row}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: selected ? colors.primary : colors.surfaceMuted },
          ]}
        >
          <Icon
            name={UNIT_KIND_ICON[unit.kind]}
            size={20}
            color={selected ? colors.onPrimary : colors.primary}
          />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={1}>
            {unit.name}
          </Text>
          <View style={styles.metaRow}>
            <Text variant="caption" color="textMuted">
              {t(`inventory.unitKind.${unit.kind}`)}
            </Text>
            <Text variant="caption" color="textSubtle">
              ·
            </Text>
            <Icon name="users" size={12} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {t('inventory.capacity', { count: unit.capacity })}
            </Text>
            <Text variant="caption" color="textSubtle">
              ·
            </Text>
            <Text variant="caption" color="textMuted">
              ×{unit.quantity}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          {badge ? <Badge label={badge} color={colors.primary} /> : null}
          <Text variant="title" color="primary">
            {formatPriceTry(unit.basePriceTry, locale)}
          </Text>
          <Text variant="label" color="textSubtle">
            {t('inventory.perNight')}
          </Text>
        </View>
      </View>
      {unit.amenities.length > 0 ? (
        <View style={styles.amenities}>
          {unit.amenities.slice(0, 4).map((a) => (
            <View
              key={a}
              style={[
                styles.amenity,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <Icon name="check" size={10} color={colors.primary} strokeWidth={2.8} />
              <Text variant="label" color="textMuted">
                {a}
              </Text>
            </View>
          ))}
          {unit.amenities.length > 4 ? (
            <Text variant="label" color="textSubtle" style={{ alignSelf: 'center' }}>
              +{unit.amenities.length - 4}
            </Text>
          ) : null}
        </View>
      ) : null}
      {actionLabel ? (
        <View style={styles.actionRow}>
          <Text variant="caption" weight="bold" color="primary">
            {actionLabel}
          </Text>
          <Icon name="chevron-right" size={14} color={colors.primary} strokeWidth={2.6} />
        </View>
      ) : null}
    </>
  );

  const style = [
    styles.card,
    {
      backgroundColor: selected ? colors.primarySoft : colors.surface,
      borderColor: selected ? colors.primary : colors.border,
      borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
    },
  ];

  if (!onPress) return <View style={style}>{body}</View>;
  return (
    <Tappable
      onPress={onPress}
      haptic="selection"
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={unit.name}
      accessibilityState={{ selected }}
      style={style}
    >
      {body}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  amenity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-end' },
});
