import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Card, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { spacing, useTheme } from '@/core/theme';
import { doctorDisplayName, formatPriceTry, type DoctorWithUser } from '@/domain';

interface Props {
  doctor: DoctorWithUser;
  onPress?: () => void;
  /** Uzmanlık rozetlerinin tamamı (profil) yoksa ilk ikisi (liste) */
  full?: boolean;
}

/** Doktor listesi kartı: avatar, unvan+ad, uzmanlıklar, diller, çevrimiçi durumu, ücret, puan. */
export function DoctorCard({ doctor, onPress, full = false }: Props) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const name = doctorDisplayName(doctor, doctor.user.displayName);
  const specialties = full ? doctor.specialties : doctor.specialties.slice(0, 2);
  const extra = doctor.specialties.length - specialties.length;
  const price = doctor.volunteer
    ? t('telemed.volunteer')
    : formatPriceTry(doctor.priceTryPerConsult, locale, false);

  return (
    <Card onPress={onPress} padded accessibilityLabel={`${name}, ${price}`}>
      <View style={styles.row}>
        <View>
          <Avatar
            uri={doctor.user.avatarUrl}
            name={doctor.user.displayName}
            size={56}
            verified={doctor.isVerified}
          />
          <View
            style={[
              styles.dot,
              {
                backgroundColor: doctor.isOnline ? colors.success : colors.textSubtle,
                borderColor: colors.surface,
              },
            ]}
            accessibilityLabel={doctor.isOnline ? t('telemed.online') : t('telemed.offline')}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.titleRow}>
            <Text variant="title" numberOfLines={1} style={{ flex: 1 }}>
              {name}
            </Text>
            <View style={styles.rating}>
              <Icon name="star" size={13} color={colors.warning} />
              <Text variant="label" weight="bold">
                {doctor.rating.toFixed(1)}
              </Text>
            </View>
          </View>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {doctor.institution}
          </Text>
          <View style={styles.badges}>
            {specialties.map((s) => (
              <Badge key={s} label={t(`telemed.specialty.${s}`)} color={colors.primary} />
            ))}
            {extra > 0 ? <Badge label={`+${extra}`} color={colors.textMuted} /> : null}
          </View>
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <Icon name="languages" size={13} color={colors.textSubtle} />
              <Text variant="caption" color="textMuted">
                {doctor.languages.map((l) => l.toUpperCase()).join(' · ')}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Icon name="timer" size={13} color={colors.textSubtle} />
              <Text variant="caption" color="textMuted">
                {t('telemed.responseIn', { min: doctor.responseMin })}
              </Text>
            </View>
            <Text
              variant="caption"
              weight="bold"
              color={doctor.volunteer ? colors.success : colors.text}
            >
              {price}
            </Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dot: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
