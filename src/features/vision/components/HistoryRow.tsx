import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import type { VisionHistoryItem } from '@/domain';

import { RiskBadge } from './RiskBadge';
import { SITUATION_ICONS } from './SituationChips';

export interface HistoryRowProps {
  item: VisionHistoryItem;
  /** Göreli tarih için referans zaman (render içinde Date.now çağrılmasın diye) */
  now: Date;
  onPress?: () => void;
}

const THUMB = 64;

/** Geçmiş listesi satırı: küçük resim, durum, risk rozeti, soru ve tarih. */
export function HistoryRow({ item, now, onPress }: HistoryRowProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const situationLabel = t(`vision.situation.${item.situation}`);

  return (
    <Card
      onPress={onPress}
      style={styles.card}
      accessibilityLabel={t('vision.historyScreen.itemLabel', {
        situation: situationLabel,
        risk: t(`vision.risk.${item.risk}`),
      })}
    >
      <View style={styles.row}>
        <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>
          {item.thumbnailUri ? (
            <Image
              source={{ uri: item.thumbnailUri }}
              style={styles.thumbImage}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Icon name={SITUATION_ICONS[item.situation]} size={24} color={colors.textSubtle} />
          )}
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Icon name={SITUATION_ICONS[item.situation]} size={14} color={colors.primary} />
            <Text variant="title" numberOfLines={1} style={styles.title}>
              {situationLabel}
            </Text>
          </View>
          <Text variant="bodySm" color="textMuted" numberOfLines={1}>
            {item.question || t('vision.historyScreen.noQuestion')}
          </Text>
          <View style={styles.metaRow}>
            <RiskBadge risk={item.risk} />
            <Text variant="caption" color="textSubtle">
              {formatRelative(item.createdAt, now, locale)}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textSubtle} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { width: THUMB, height: THUMB },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 },
  title: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
