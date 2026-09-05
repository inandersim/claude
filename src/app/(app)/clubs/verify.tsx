import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, ErrorState, Header, Icon, Input, Screen, Skeleton, Text } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import { isStudentEmail, universityFromEmail } from '@/domain';
import { StudentBadge } from '@/features/clubs/components/StudentBadge';
import { useStudentVerification, useVerifyStudent } from '@/features/clubs/hooks';

const BENEFITS = [
  { key: 'discount', icon: 'badge-percent' },
  { key: 'plan', icon: 'ticket' },
  { key: 'priority', icon: 'rocket' },
  { key: 'gear', icon: 'backpack' },
] as const;

export default function VerifyStudentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const verification = useStudentVerification();
  const verify = useVerifyStudent();
  const [email, setEmail] = useState('');
  const trimmed = email.trim();
  const student = trimmed.length > 3 && isStudentEmail(trimmed);
  const detected = student ? universityFromEmail(trimmed) : null;
  const showError = trimmed.includes('@') && trimmed.split('@')[1]!.includes('.') && !student;
  const data = verification.data;
  const verified = Boolean(data?.verifiedAt);

  const submit = () =>
    verify.mutate(trimmed, {
      onSuccess: () => toast(t('clubs.verify.success'), 'success'),
      onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
    });

  return (
    <Screen edges={['top']}>
      <Header
        title={t('clubs.verify.title')}
        showBack
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/clubs'))}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {verification.isError ? (
          <ErrorState onRetry={() => verification.refetch()} />
        ) : verification.isLoading ? (
          <Skeleton height={160} style={{ borderRadius: radius.xl }} />
        ) : verified && data ? (
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.info }]}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.infoSoft }]}>
              <Icon name="graduation-cap" size={28} color={colors.info} />
            </View>
            <Text variant="h2" align="center">
              {t('clubs.verify.verifiedTitle')}
            </Text>
            <StudentBadge verification={data} />
            <Text variant="caption" color="textMuted" align="center">
              {data.email}
            </Text>
            <Text variant="caption" color="textSubtle" align="center">
              {t('clubs.verify.verifiedAt', { date: formatDate(data.verifiedAt!, locale) })}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                alignItems: 'stretch',
              },
            ]}
          >
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
                <Icon name="school" size={28} color={colors.primary} />
              </View>
              <Text variant="body" color="textMuted" align="center">
                {t('clubs.verify.intro')}
              </Text>
            </View>
            <Input
              label={t('clubs.verify.email')}
              icon="mail"
              placeholder={t('clubs.verify.emailPlaceholder')}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              error={showError ? t('clubs.verify.notStudent') : null}
              hint={!showError ? t('clubs.verify.hint') : undefined}
              accessibilityLabel={t('clubs.verify.email')}
            />
            {detected ? (
              <View style={[styles.detected, { backgroundColor: colors.successSoft }]}>
                <Icon name="circle-check" size={18} color={colors.success} />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color="textSubtle">
                    {t('clubs.verify.detected')}
                  </Text>
                  <Text variant="title">{detected}</Text>
                </View>
              </View>
            ) : null}
            <Button
              label={verify.isPending ? t('clubs.verify.sending') : t('clubs.verify.send')}
              icon="send"
              size="lg"
              fullWidth
              disabled={!student}
              loading={verify.isPending}
              onPress={submit}
            />
          </View>
        )}

        <View style={{ gap: spacing.sm }}>
          <Text variant="h3">{t('clubs.verify.benefitsTitle')}</Text>
          {BENEFITS.map((b) => (
            <View
              key={b.key}
              style={[
                styles.benefit,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: verified ? 1 : 0.85,
                },
              ]}
            >
              <View
                style={[
                  styles.benefitIcon,
                  { backgroundColor: verified ? colors.successSoft : colors.surfaceMuted },
                ]}
              >
                <Icon
                  name={b.icon}
                  size={18}
                  color={verified ? colors.success : colors.textMuted}
                />
              </View>
              <Text variant="body" weight="semibold" style={{ flex: 1 }}>
                {t(`clubs.verify.benefits.${b.key}`)}
              </Text>
              {verified ? (
                <Icon name="check" size={18} color={colors.success} strokeWidth={2.8} />
              ) : (
                <Icon name="lock" size={16} color={colors.textSubtle} />
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.xl,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  card: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
