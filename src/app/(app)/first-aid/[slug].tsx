import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Button, EmptyState, Header, Icon, Screen, Text, type IconName } from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { getFirstAidGuide } from '@/data/content/firstAid';
import { primaryNumber } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useCountry } from '@/features/rescue/hooks';

export default function FirstAidGuideScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const guide = getFirstAidGuide(locale, slug);
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const country = useCountry(location.coords);
  const general = primaryNumber(country.profile, 'general');

  if (!guide) {
    return (
      <Screen edges={['top']}>
        <Header showBack />
        <EmptyState icon="compass" title={t('notFound.contentTitle')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={t('firstAid.title')}
        showBack
        right={
          <Button
            label={general}
            icon="siren"
            size="sm"
            variant="danger"
            onPress={() => Linking.openURL(`tel:${general}`)}
          />
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: colors.dangerSoft }]}>
            <Icon name={guide.icon as IconName} size={26} color={colors.danger} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h1">{guide.title}</Text>
            <Text variant="body" color="textMuted">
              {guide.summary}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.callHelp,
            { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
          ]}
        >
          <Icon name="siren" size={16} color={colors.danger} strokeWidth={2.4} />
          <Text variant="bodySm" style={{ flex: 1 }}>
            <Text variant="bodySm" weight="bold" color="danger">
              {t('firstAid.callHelpWhen')}:
            </Text>{' '}
            {guide.callHelpWhen}
          </Text>
        </View>

        <Text variant="h3">{t('firstAid.steps')}</Text>
        {guide.steps.map((step, i) => (
          <View
            key={i}
            style={[styles.step, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.stepNo, { backgroundColor: colors.primary }]}>
              <Text variant="title" weight="extrabold" color={colors.onPrimary}>
                {i + 1}
              </Text>
            </View>
            <Text variant="body" style={{ flex: 1 }}>
              {step}
            </Text>
          </View>
        ))}

        <Text variant="h3">{t('firstAid.donts')}</Text>
        {guide.donts.map((d, i) => (
          <View key={i} style={styles.dont}>
            <Icon name="circle-x" size={16} color={colors.danger} strokeWidth={2.4} />
            <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
              {d}
            </Text>
          </View>
        ))}

        <Text variant="caption" color="textSubtle" style={{ marginTop: spacing.md }}>
          {t('firstAid.disclaimer')}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callHelp: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepNo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dont: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
