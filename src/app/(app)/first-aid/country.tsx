import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Badge, Header, Icon, Screen, SectionHeader, Tappable, Text } from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  rescueCountryFlag,
  countryName,
  languageName,
  localizedText,
  UNKNOWN_COUNTRY,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { CountryPicker } from '@/features/rescue/components/CountryPicker';
import { CountryRescueCard } from '@/features/rescue/components/CountryRescueCard';
import { EmbassyRow } from '@/features/rescue/components/EmbassyRow';
import { OrganizationRow } from '@/features/rescue/components/OrganizationRow';
import { useCountry } from '@/features/rescue/hooks';

export default function CountryRescueScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const country = useCountry(location.coords);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { profile, neighbors } = country;
  const home = profile.countryCode === 'TR';
  const unknown = profile.countryCode === UNKNOWN_COUNTRY;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('rescue.title')}
        subtitle={t('rescue.subtitle')}
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/first-aid'))}
      />
      <View style={styles.content}>
        <View style={styles.detectedRow}>
          <Text variant="caption" color="textMuted">
            {t('rescue.detected')}
          </Text>
          <Badge
            label={t(`rescue.source.${country.source}`)}
            icon={
              country.source === 'geocode'
                ? 'locate-fixed'
                : country.source === 'manual'
                  ? 'pencil'
                  : 'map'
            }
            color={country.source === 'manual' ? colors.accent : colors.info}
          />
          {location.isFallback && country.source !== 'manual' ? (
            <Text variant="caption" color="textSubtle">
              · {t('rescue.source.fallback')}
            </Text>
          ) : null}
        </View>

        <CountryRescueCard
          profile={profile}
          source={country.source}
          onChangeCountry={() => setPickerOpen(true)}
        />

        {neighbors.length > 0 ? (
          <View
            style={[
              styles.neighbors,
              { backgroundColor: colors.warningSoft, borderColor: colors.warning },
            ]}
          >
            <View style={styles.neighborHeader}>
              <Icon name="triangle-alert" size={16} color={colors.warning} strokeWidth={2.4} />
              <Text variant="title" style={{ flex: 1 }}>
                {t('rescue.neighbors')}
              </Text>
            </View>
            <Text variant="caption" color="textMuted">
              {t('rescue.neighborsHint')}
            </Text>
            <View style={styles.neighborList}>
              {neighbors.map((n) => (
                <Tappable
                  key={n.countryCode}
                  onPress={() => country.setManualCountry(n.countryCode)}
                  haptic="selection"
                  style={[
                    styles.neighborChip,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${countryName(n.countryCode, locale)} · ${n.profile.emergency.general}`}
                >
                  <Text variant="body">{rescueCountryFlag(n.countryCode)}</Text>
                  <Text variant="caption" weight="bold">
                    {countryName(n.countryCode, locale)}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {t('rescue.numbers.general')} {n.profile.emergency.general} ·{' '}
                    {t('rescue.neighborDistance', { km: n.distanceKm })}
                  </Text>
                </Tappable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.linkRow}>
          <Tappable
            onPress={() => router.push('/satellite/sos')}
            haptic="selection"
            style={[styles.link, { backgroundColor: colors.surfaceMuted }]}
            accessibilityRole="button"
            accessibilityLabel={t('rescue.satelliteSos')}
          >
            <Icon name="satellite" size={16} color={colors.primary} />
            <Text variant="caption" weight="bold" style={{ flex: 1 }}>
              {t('rescue.satelliteSos')}
            </Text>
            <Icon name="chevron-right" size={14} color={colors.textSubtle} />
          </Tappable>
          <Tappable
            onPress={() => router.push('/first-aid')}
            haptic="selection"
            style={[styles.link, { backgroundColor: colors.surfaceMuted }]}
            accessibilityRole="button"
            accessibilityLabel={t('rescue.nearestCenters')}
          >
            <Icon name="map-pin" size={16} color={colors.primary} />
            <Text variant="caption" weight="bold" style={{ flex: 1 }}>
              {t('rescue.nearestCenters')}
            </Text>
            <Icon name="chevron-right" size={14} color={colors.textSubtle} />
          </Tappable>
        </View>

        <SectionHeader title={t('rescue.organizations')} />
        {profile.organizations.length === 0 ? (
          <Text variant="caption" color="textMuted">
            {t('rescue.noOrganizations')}
          </Text>
        ) : (
          profile.organizations.map((org) => (
            <OrganizationRow key={`${org.name}-${org.scope}`} org={org} />
          ))
        )}

        <SectionHeader title={t('rescue.embassy')} />
        <EmbassyRow embassy={profile.turkishEmbassy} home={home} />

        {!unknown ? (
          <>
            <SectionHeader title={t('rescue.languages')} />
            <View style={styles.langRow}>
              {profile.languages.map((code) => (
                <Badge
                  key={code}
                  label={languageName(code, locale)}
                  icon="languages"
                  color={colors.textMuted}
                />
              ))}
            </View>
          </>
        ) : null}

        <SectionHeader title={t('rescue.notes')} />
        <View
          style={[
            styles.notes,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          ]}
        >
          {profile.notes.map((note, i) => (
            <View key={i} style={styles.noteRow}>
              <Icon name="info" size={14} color={colors.textMuted} />
              <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                {localizedText(note, locale)}
              </Text>
            </View>
          ))}
          <View style={styles.noteRow}>
            <Icon name="shield" size={14} color={colors.warning} />
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('rescue.insuranceReminder')}
            </Text>
          </View>
        </View>
      </View>

      <CountryPicker
        visible={pickerOpen}
        value={country.isManual ? country.countryCode : null}
        onSelect={(code) => country.setManualCountry(code)}
        onAuto={() => country.setManualCountry(null)}
        onClose={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  detectedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  neighbors: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  neighborHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  neighborList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  neighborChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  linkRow: { flexDirection: 'row', gap: spacing.sm },
  link: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
  },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  notes: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
