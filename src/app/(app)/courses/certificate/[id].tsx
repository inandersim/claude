import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import { isCertificateValid } from '@/domain';
import { CertificateCard } from '@/features/courses/components/CertificateCard';
import { useCertificates } from '@/features/courses/hooks';

export default function CertificateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [now] = useState(() => Date.now());

  const certificates = useCertificates();
  const cert = useMemo(
    () => certificates.data?.find((c) => c.id === id) ?? null,
    [certificates.data, id],
  );
  const valid = cert ? isCertificateValid(cert, now) : false;

  const share = () => {
    if (!cert) return;
    const message = t('courses.certificate.shareText', {
      name: cert.holderName,
      course: cert.course.certificateName ?? cert.course.title,
      code: cert.code,
    });
    Share.share({ message }).catch(() => toast(t('common.error'), 'error'));
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('courses.certificate.title')}
        subtitle={cert?.course.provider}
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/courses/my'))}
      />
      <View style={styles.content}>
        {certificates.isError ? (
          <ErrorState onRetry={() => certificates.refetch()} />
        ) : certificates.isLoading ? (
          <Skeleton height={280} style={{ borderRadius: radius.xl }} />
        ) : !cert ? (
          <EmptyState icon="award" title={t('courses.certificate.notFound')} />
        ) : (
          <>
            <CertificateCard certificate={cert} course={cert.course} now={now} large />

            <Card padded style={{ gap: spacing.sm }}>
              <View style={styles.row}>
                <Icon name="stamp" size={18} color={colors.primary} />
                <Text variant="title">{t('courses.certificate.code')}</Text>
              </View>
              <Text variant="h2" weight="extrabold" style={styles.code} selectable>
                {cert.code}
              </Text>
              <Text variant="caption" color="textMuted">
                {valid
                  ? cert.expiresAt
                    ? t('courses.validUntil', { date: formatDate(cert.expiresAt, locale) })
                    : t('courses.certificate.lifetime')
                  : t('courses.expired')}
              </Text>
            </Card>

            <View style={styles.actions}>
              <Button
                label={t('courses.certificate.share')}
                icon="share-2"
                fullWidth
                onPress={share}
              />
              <Button
                label={cert.course.title}
                icon="graduation-cap"
                variant="secondary"
                fullWidth
                onPress={() =>
                  router.push({ pathname: '/courses/[id]', params: { id: cert.courseId } })
                }
              />
            </View>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    paddingBottom: spacing.xxl,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  code: { letterSpacing: 2 },
  actions: { gap: spacing.sm },
});
