import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Badge, Button, Icon, Tappable, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import {
  rescueCountryFlag,
  countryName,
  dialUrl,
  localizedText,
  mountainNumber,
  primaryNumber,
  rescueSummary,
  UNKNOWN_COUNTRY,
  type HelicopterRescuePolicy,
  type RescueProfile,
} from '@/domain';

import type { CountrySource } from '../hooks';

interface Props {
  profile: RescueProfile;
  /** Tespit kaynağı rozeti (yalnızca tam kartta gösterilir). */
  source?: CountrySource;
  /** Tek satırlık kompakt biçim (uydu SOS ekranı vb.). */
  compact?: boolean;
  /** Kompakt kartta ad/özet alanına dokununca (ör. dizine git). */
  onPress?: () => void;
  /** Tam kartta "Ülkeyi değiştir" bağlantısı. */
  onChangeCountry?: () => void;
}

const HELI_ICON: Record<HelicopterRescuePolicy, IconName> = {
  free: 'circle-check',
  paid: 'banknote',
  insurance_required: 'shield-alert',
  limited: 'triangle-alert',
};

const TILE_KINDS = ['police', 'ambulance', 'fire', 'tourist'] as const;

function call(number: string) {
  Linking.openURL(dialUrl(number)).catch(() => undefined);
}

/** Ülkenin bayrağı, ana acil numarası ve kurtarma hatlarını gösteren kart. */
export function CountryRescueCard({
  profile,
  source,
  compact = false,
  onPress,
  onChangeCountry,
}: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const name = countryName(profile.countryCode, locale);
  const flag = rescueCountryFlag(profile.countryCode);
  const general = primaryNumber(profile, 'general');
  const mountain = mountainNumber(profile);
  const sea =
    profile.emergency.sea && profile.emergency.sea !== general ? profile.emergency.sea : null;
  const medical = profile.emergency.ambulance !== general ? profile.emergency.ambulance : null;
  const unknown = profile.countryCode === UNKNOWN_COUNTRY;
  const tiles = TILE_KINDS.flatMap((kind) => {
    const number = profile.emergency[kind];
    return number ? [{ kind, number }] : [];
  });
  const heliColor: Record<HelicopterRescuePolicy, string> = {
    free: colors.success,
    paid: colors.warning,
    insurance_required: colors.danger,
    limited: colors.textMuted,
  };

  if (compact) {
    return (
      <View
        style={[styles.compact, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Tappable
          onPress={onPress}
          disabled={!onPress}
          haptic="selection"
          style={styles.compactInfo}
          accessibilityRole="button"
          accessibilityLabel={`${name} · ${t('rescue.compactLine', { number: general })}`}
        >
          <Text variant="h2">{flag}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title" numberOfLines={1}>
              {unknown ? t('rescue.unknownCountry') : name}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={2}>
              {rescueSummary(profile, locale)}
            </Text>
          </View>
          {onPress ? <Icon name="chevron-right" size={16} color={colors.textSubtle} /> : null}
        </Tappable>
        <Button
          label={general}
          icon="phone"
          size="sm"
          variant="danger"
          onPress={() => call(general)}
          accessibilityLabel={`${t('rescue.call')} ${general}`}
        />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Text variant="display">{flag}</Text>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="h2" numberOfLines={2}>
            {unknown ? t('rescue.unknownCountry') : name}
          </Text>
          <View style={styles.badgeRow}>
            {source ? (
              <Badge
                label={t(`rescue.source.${source}`)}
                icon={
                  source === 'geocode' ? 'locate-fixed' : source === 'manual' ? 'pencil' : 'map'
                }
                color={source === 'manual' ? colors.accent : colors.info}
              />
            ) : null}
            {!unknown ? (
              <Text variant="caption" color="textSubtle">
                {profile.countryCode}
              </Text>
            ) : null}
          </View>
        </View>
        {onChangeCountry ? (
          <Tappable
            onPress={onChangeCountry}
            haptic="selection"
            style={[styles.changeLink, { backgroundColor: colors.surfaceMuted }]}
            accessibilityRole="button"
            accessibilityLabel={t('rescue.changeCountry')}
          >
            <Icon name="globe" size={14} color={colors.primary} strokeWidth={2.4} />
            <Text variant="caption" weight="bold" color="primary">
              {t('rescue.changeCountry')}
            </Text>
          </Tappable>
        ) : null}
      </View>

      {unknown ? (
        <Text variant="caption" color="textMuted">
          {t('rescue.unknownCountryHint')}
        </Text>
      ) : null}

      <Tappable
        onPress={() => call(general)}
        haptic="medium"
        scaleTo={0.98}
        style={[styles.callButton, { backgroundColor: colors.danger }]}
        accessibilityRole="button"
        accessibilityLabel={`${t('rescue.call')} ${general}`}
      >
        <Icon name="phone" size={26} color="#FFFFFF" strokeWidth={2.4} />
        <View style={{ flex: 1 }}>
          <Text variant="label" color="#FFFFFF" style={{ opacity: 0.85 }}>
            {t('rescue.numbers.general').toLocaleUpperCase('tr-TR')} · {t('rescue.call')}
          </Text>
          <Text variant="h1" color="#FFFFFF" weight="extrabold">
            {general}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color="#FFFFFF" />
      </Tappable>

      {mountain || sea || medical ? (
        <View style={styles.secondaryRow}>
          {mountain ? (
            <Button
              label={`${t('rescue.numbers.mountain')} ${mountain}`}
              icon="mountain"
              size="sm"
              variant="secondary"
              onPress={() => call(mountain)}
              style={styles.secondaryButton}
              accessibilityLabel={`${t('rescue.callMountain')} ${mountain}`}
            />
          ) : null}
          {sea ? (
            <Button
              label={`${t('rescue.numbers.sea')} ${sea}`}
              icon="anchor"
              size="sm"
              variant="secondary"
              onPress={() => call(sea)}
              style={styles.secondaryButton}
              accessibilityLabel={`${t('rescue.callSea')} ${sea}`}
            />
          ) : null}
          {medical ? (
            <Button
              label={`${t('rescue.numbers.ambulance')} ${medical}`}
              icon="ambulance"
              size="sm"
              variant="secondary"
              onPress={() => call(medical)}
              style={styles.secondaryButton}
              accessibilityLabel={`${t('rescue.callMedical')} ${medical}`}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.numbersGrid}>
        {tiles.map(({ kind, number }) => (
          <Tappable
            key={kind}
            onPress={() => call(number)}
            haptic="selection"
            style={[styles.numberTile, { backgroundColor: colors.surfaceMuted }]}
            accessibilityRole="button"
            accessibilityLabel={`${t(`rescue.numbers.${kind}`)} ${number}`}
          >
            <Text variant="label" color="textSubtle">
              {t(`rescue.numbers.${kind}`).toLocaleUpperCase('tr-TR')}
            </Text>
            <Text variant="title" weight="bold">
              {number}
            </Text>
          </Tappable>
        ))}
      </View>

      <View style={[styles.policy, { borderColor: colors.border }]}>
        <View style={styles.policyRow}>
          <Badge
            label={`${t('rescue.helicopter.title')}: ${t(`rescue.helicopter.${profile.helicopterRescue}`)}`}
            icon={HELI_ICON[profile.helicopterRescue]}
            color={heliColor[profile.helicopterRescue]}
          />
        </View>
        <View style={styles.policyRow}>
          <Icon name="shield" size={14} color={colors.textMuted} />
          <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
            {localizedText(profile.insuranceNote, locale)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  changeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
  },
  secondaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  secondaryButton: { flexGrow: 1 },
  numbersGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  numberTile: {
    flexGrow: 1,
    flexBasis: '30%',
    padding: spacing.sm + 2,
    borderRadius: radius.md,
    gap: 2,
  },
  policy: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: spacing.sm },
  policyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  compactInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
