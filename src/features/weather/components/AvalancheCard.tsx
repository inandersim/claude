import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Badge, Button, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import {
  AVALANCHE_LEVELS,
  avalancheMeta,
  avalancheProblemKey,
  type AvalancheBulletin,
  type EawsRegion,
} from '@/domain';

interface Props {
  bulletin: AvalancheBulletin | null;
  region: EawsRegion | null;
}

/** Çığ bülteni kartı: 1–5 seviye ölçeği, yükseklik bandı, problemler, kaynak. */
export function AvalancheCard({ bulletin, region }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();

  if (!region || !bulletin) {
    return (
      <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.head}>
          <Icon name="mountain-snow" size={20} color={colors.textSubtle} />
          <Text variant="title" style={{ flex: 1 }}>
            {t('weather.avalanche.title')}
          </Text>
        </View>
        <Text variant="bodySm" color="textMuted">
          {t('weather.avalanche.noRegion')}
        </Text>
        <Text variant="caption" color="textSubtle">
          {t('weather.avalanche.noRegionHint')}
        </Text>
      </View>
    );
  }

  const meta = avalancheMeta(bulletin.dangerLevel);
  const unofficial = bulletin.source === 'mock' || !region.official;

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`${t('weather.avalanche.title')} ${bulletin.regionName}: ${bulletin.dangerLevel} ${t(meta.labelKey)}`}
    >
      <View style={styles.head}>
        <Icon name="mountain-snow" size={20} color={meta.color} />
        <View style={{ flex: 1 }}>
          <Text variant="title">{t('weather.avalanche.title')}</Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {t('weather.avalanche.region')}: {bulletin.regionName}
          </Text>
        </View>
        <Badge
          label={unofficial ? t('weather.avalanche.unofficial') : t('weather.source.eaws')}
          color={unofficial ? colors.warning : colors.success}
          icon={unofficial ? 'triangle-alert' : 'badge-check'}
        />
      </View>

      <View style={styles.levelRow}>
        <View
          style={[
            styles.levelBadge,
            { backgroundColor: meta.color, borderColor: meta.accentColor ?? meta.color },
          ]}
        >
          <Text
            variant="display"
            weight="extrabold"
            color={bulletin.dangerLevel === 2 ? '#111111' : '#FFFFFF'}
          >
            {bulletin.dangerLevel}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="h3" weight="extrabold" color={meta.color}>
            {t(meta.labelKey)}
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={3}>
            {t(meta.descriptionKey)}
          </Text>
          {bulletin.dangerAbove ? (
            <View style={styles.band}>
              <Icon name="mountain" size={12} color={colors.textSubtle} />
              <Text variant="caption" color="textMuted">
                {t('weather.avalanche.above', { elevation: bulletin.dangerAbove.elevationM })}:{' '}
                <Text
                  variant="caption"
                  weight="bold"
                  color={avalancheMeta(bulletin.dangerAbove.level).color}
                >
                  {bulletin.dangerAbove.level} ·{' '}
                  {t(avalancheMeta(bulletin.dangerAbove.level).labelKey)}
                </Text>
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.scale} accessible={false}>
        {AVALANCHE_LEVELS.map((lvl) => {
          const m = avalancheMeta(lvl);
          const active = lvl <= bulletin.dangerLevel;
          return (
            <View
              key={lvl}
              style={[
                styles.scaleStep,
                {
                  backgroundColor: active ? m.color : colors.surfaceMuted,
                  borderColor: active && m.accentColor ? m.accentColor : 'transparent',
                },
              ]}
            />
          );
        })}
      </View>

      {bulletin.problems.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text variant="label" color="textSubtle">
            {t('weather.avalanche.problems').toLocaleUpperCase()}
          </Text>
          <View style={styles.problems}>
            {bulletin.problems.map((p) => {
              const key = avalancheProblemKey(p);
              return (
                <Badge key={p} label={key ? t(key) : p} color={colors.textMuted} icon="snowflake" />
              );
            })}
          </View>
        </View>
      ) : null}

      {bulletin.summary ? (
        <Text variant="bodySm" color="textMuted">
          {bulletin.summary}
        </Text>
      ) : null}
      {unofficial ? (
        <Text variant="caption" color="textSubtle">
          {t('weather.avalanche.unofficialHint')}
        </Text>
      ) : null}

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text variant="caption" color="textSubtle" style={{ flex: 1 }} numberOfLines={2}>
          {t('weather.avalanche.validUntil', {
            date: formatDate(bulletin.validTo, locale, 'd MMM HH:mm'),
          })}
          {' · '}
          {t('weather.avalanche.source')}:{' '}
          {bulletin.source === 'eaws' ? t('weather.source.eaws') : t('weather.source.mock')}
        </Text>
        {bulletin.url ? (
          <Button
            label={t('weather.avalanche.openBulletin')}
            icon="external-link"
            size="sm"
            variant="secondary"
            onPress={() => Linking.openURL(bulletin.url!)}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  levelBadge: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  band: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  scale: { flexDirection: 'row', gap: 4 },
  scaleStep: { flex: 1, height: 8, borderRadius: 4, borderWidth: 1.5 },
  problems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
});
