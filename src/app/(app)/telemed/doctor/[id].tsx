import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Header,
  Screen,
  Skeleton,
  StatTile,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { spacing, useTheme } from '@/core/theme';
import { countryName, formatPriceTry, languageName, rescueCountryFlag } from '@/domain';
import { DisclaimerBanner } from '@/features/telemed/components/DisclaimerBanner';
import { DoctorCard } from '@/features/telemed/components/DoctorCard';
import { useDoctor } from '@/features/telemed/hooks';

export default function DoctorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const doctor = useDoctor(id);

  const onConsult = () =>
    router.push({
      pathname: '/telemed/request',
      params: { specialty: doctor.data?.specialties[0] ?? '' },
    });

  return (
    <Screen edges={['top', 'bottom']}>
      <Header showBack onBack={() => goBack(router, '/explore')} title={t('telemed.title')} />
      {doctor.isLoading ? (
        <View style={styles.pad}>
          <Skeleton height={120} />
          <Skeleton height={80} />
          <Skeleton height={160} />
        </View>
      ) : doctor.isError ? (
        <ErrorState onRetry={() => doctor.refetch()} />
      ) : !doctor.data ? (
        <EmptyState icon="user" title={t('telemed.doctor.notFound')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <DoctorCard doctor={doctor.data} full />

          <View style={styles.stats}>
            <StatTile
              icon="star"
              label={t('telemed.doctor.rating')}
              value={doctor.data.rating.toFixed(1)}
              color={colors.warning}
              compact
              style={{ flex: 1 }}
            />
            <StatTile
              icon="timer"
              label={t('telemed.doctor.response')}
              value={t('telemed.responseIn', { min: doctor.data.responseMin })}
              compact
              style={{ flex: 1 }}
            />
            <StatTile
              icon="banknote"
              label={t('telemed.doctor.price')}
              value={
                doctor.data.volunteer
                  ? t('telemed.volunteer')
                  : formatPriceTry(doctor.data.priceTryPerConsult, locale, false)
              }
              color={doctor.data.volunteer ? colors.success : undefined}
              compact
              style={{ flex: 1 }}
            />
          </View>

          <Section title={t('telemed.doctor.specialties')}>
            <View style={styles.wrap}>
              {doctor.data.specialties.map((s) => (
                <Badge key={s} label={t(`telemed.specialty.${s}`)} color={colors.primary} />
              ))}
            </View>
          </Section>

          <Section title={t('telemed.doctor.languages')}>
            <View style={styles.wrap}>
              {doctor.data.languages.map((l) => (
                <Badge
                  key={l}
                  label={languageName(l, locale)}
                  color={colors.info}
                  icon="languages"
                />
              ))}
            </View>
          </Section>

          <Section title={t('telemed.doctor.countries')}>
            <View style={styles.wrap}>
              {doctor.data.countryCodes.map((c) => (
                <Badge
                  key={c}
                  label={`${rescueCountryFlag(c)} ${countryName(c, locale)}`}
                  color={colors.textMuted}
                />
              ))}
            </View>
          </Section>

          <Section title={t('telemed.doctor.institution')}>
            <Text variant="body">{doctor.data.institution}</Text>
            <Text variant="caption" color="textMuted">
              {t('telemed.doctor.license')}: {doctor.data.licenseNo}
              {doctor.data.isVerified ? ` · ${t('telemed.verifiedDoctor')}` : ''}
              {' · '}
              {t('telemed.consultCount', { count: doctor.data.consultCount })}
            </Text>
          </Section>

          <Section title={t('telemed.doctor.bio')}>
            <Text variant="body">{doctor.data.bio}</Text>
          </Section>

          {doctor.data.isOnline ? null : (
            <Text variant="caption" color="textMuted">
              {t('telemed.doctor.offlineHint')}
            </Text>
          )}
          <DisclaimerBanner compact />
          <Button
            label={t('telemed.doctor.consult')}
            icon="heart-pulse"
            size="lg"
            fullWidth
            onPress={onConsult}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" color="textMuted">
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  pad: { padding: spacing.lg, gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
