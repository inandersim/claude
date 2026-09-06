import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import { CATEGORY_META, isCertificateValid, type Certificate, type Course } from '@/domain';

interface Props {
  certificate: Certificate;
  course: Course;
  now: number;
  /** Tam ekran görünümde daha büyük tipografi */
  large?: boolean;
}

/**
 * Sertifika görünümü: logo alanı, kurum, sahibinin adı, kurs adı, doğrulama kodu,
 * veriliş ve geçerlilik tarihleri. Paylaşım ekranda yönetilir.
 */
export function CertificateCard({ certificate, course, now, large = false }: Props) {
  const { t, locale } = useT();
  const { colors, isDark } = useTheme();
  const meta = CATEGORY_META[course.category];
  const valid = isCertificateValid(certificate, now);
  const paper = isDark ? '#F4F1E8' : '#FBF8F0';
  const ink = '#1C2620';
  const inkMuted = '#5B6B62';

  return (
    <View
      style={[styles.card, { backgroundColor: paper, borderColor: meta.color }]}
      accessibilityLabel={`${course.certificateName ?? course.title}, ${certificate.holderName}, ${certificate.code}`}
    >
      <View style={[styles.stripe, { backgroundColor: meta.color }]} />
      <View style={styles.head}>
        <View style={[styles.logo, { backgroundColor: meta.color }]}>
          <Icon name={meta.icon} size={large ? 28 : 22} color="#0B1410" strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="label" weight="extrabold" color={inkMuted}>
            {course.provider.toLocaleUpperCase(locale)}
          </Text>
          <Text variant={large ? 'h3' : 'title'} weight="extrabold" color={ink} numberOfLines={2}>
            {course.certificateName ?? course.title}
          </Text>
        </View>
        <View
          style={[
            styles.status,
            { backgroundColor: valid ? 'rgba(47,207,122,0.16)' : 'rgba(255,107,107,0.16)' },
          ]}
        >
          <Icon
            name={valid ? 'shield-check' : 'circle-alert'}
            size={12}
            color={valid ? '#1E9E5E' : colors.danger}
            strokeWidth={2.6}
          />
          <Text variant="label" weight="extrabold" color={valid ? '#1E9E5E' : colors.danger}>
            {valid ? t('courses.certificate.verified') : t('courses.expired')}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text variant="caption" color={inkMuted}>
          {t('courses.certificate.issuedTo')}
        </Text>
        <Text variant={large ? 'h1' : 'h2'} weight="extrabold" color={ink}>
          {certificate.holderName}
        </Text>
        <Text variant="bodySm" color={inkMuted}>
          <Text variant="bodySm" weight="bold" color={ink}>
            {course.title}
          </Text>{' '}
          {t('courses.certificate.issuedFor')}
        </Text>
      </View>

      <View style={[styles.foot, { borderTopColor: 'rgba(28,38,32,0.12)' }]}>
        <View style={{ flex: 1 }}>
          <Text variant="label" color={inkMuted}>
            {t('courses.certificate.issuedAt')}
          </Text>
          <Text variant="bodySm" weight="bold" color={ink}>
            {formatDate(certificate.issuedAt, locale)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="label" color={inkMuted}>
            {t('courses.certificate.expiresAt')}
          </Text>
          <Text variant="bodySm" weight="bold" color={valid ? ink : colors.danger}>
            {certificate.expiresAt
              ? formatDate(certificate.expiresAt, locale)
              : t('courses.certificate.lifetime')}
          </Text>
        </View>
      </View>
      <View style={[styles.code, { backgroundColor: 'rgba(28,38,32,0.06)' }]}>
        <Icon name="stamp" size={14} color={inkMuted} />
        <Text variant="label" color={inkMuted}>
          {t('courses.certificate.code')}
        </Text>
        <Text variant="bodySm" weight="extrabold" color={ink} style={styles.mono} selectable>
          {certificate.code}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 2,
    overflow: 'hidden',
    padding: spacing.lg,
    gap: spacing.md,
  },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
  },
  body: { gap: 2, paddingVertical: spacing.sm },
  foot: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 1 },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
  },
  mono: { letterSpacing: 1.2, marginLeft: 'auto' },
});
