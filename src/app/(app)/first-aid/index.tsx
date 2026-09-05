import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Linking, Platform, Share, StyleSheet, View } from 'react-native';

import {
  Button,
  ErrorState,
  Header,
  Icon,
  Screen,
  SectionHeader,
  Skeleton,
  Tappable,
  Text,
  type IconName,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT, type TranslationKey } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { getFirstAidGuides } from '@/data/content/firstAid';
import {
  EMERGENCY_CENTER_META,
  emergencyNumber,
  estimateEtaMin,
  FIRST_AID_CATEGORIES,
  formatDistance,
  mapsUrl,
  sosMessage,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { SosButton } from '@/features/firstaid/components/SosButton';
import {
  useActiveSos,
  useEmergencyCenters,
  useResolveSos,
  useTriggerSos,
} from '@/features/firstaid/hooks';

export default function FirstAidScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const centers = useEmergencyCenters(location.coords);
  const activeSos = useActiveSos();
  const trigger = useTriggerSos();
  const resolve = useResolveSos();
  const guides = getFirstAidGuides(locale);
  const number = emergencyNumber('TR');
  const active = Boolean(activeSos.data);

  const onTrigger = () => {
    Alert.alert(
      t('firstAid.sosConfirm'),
      t('firstAid.sosConfirmDescription', { number: number.general }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('firstAid.sosSend'),
          style: 'destructive',
          onPress: () =>
            trigger.mutate(location.coords, {
              onSuccess: async (event) => {
                toast(t('firstAid.sosSent', { count: event.notifiedContacts }), 'success');
                if (Platform.OS !== 'web')
                  Linking.openURL(`tel:${number.general}`).catch(() => undefined);
                const message = sosMessage(me.displayName, location.coords, locale);
                Share.share({ message }).catch(() => undefined);
              },
            }),
        },
      ],
    );
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('firstAid.title')}
        subtitle={t('firstAid.subtitle')}
        showBack
        right={
          <Button
            label={t('firstAid.contacts')}
            icon="users"
            size="sm"
            variant="secondary"
            onPress={() => router.push('/first-aid/contacts')}
          />
        }
      />
      <View style={styles.content}>
        <View
          style={[
            styles.sosCard,
            {
              backgroundColor: colors.surface,
              borderColor: active ? colors.success : colors.border,
            },
          ]}
        >
          <SosButton
            active={active}
            onTrigger={onTrigger}
            onResolve={() =>
              resolve.mutate(undefined, {
                onSuccess: () => toast(t('presence.stoppedToast'), 'info'),
              })
            }
          />
          <Text variant="caption" color="textMuted" align="center">
            {active ? t('firstAid.sosResolve') : t('firstAid.sosHint')}
          </Text>
          <View style={styles.quickRow}>
            <Button
              label={`${t('firstAid.call')} ${number.general}`}
              icon="siren"
              variant="danger"
              onPress={() => Linking.openURL(`tel:${number.general}`)}
              style={{ flex: 1 }}
            />
            <Button
              label={t('firstAid.shareLocation')}
              icon="locate-fixed"
              variant="secondary"
              onPress={() =>
                Share.share({ message: sosMessage(me.displayName, location.coords, locale) })
              }
              style={{ flex: 1 }}
            />
          </View>
          <Tappable
            onPress={() => router.push('/satellite/sos')}
            haptic="selection"
            style={[styles.contactsHint, { backgroundColor: colors.surfaceMuted }]}
            accessibilityRole="button"
            accessibilityLabel={t('satellite.sos.title')}
          >
            <Icon name="satellite" size={14} color={colors.primary} />
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('satellite.sos.title')} — {t('satellite.sos.subtitle')}
            </Text>
            <Icon name="chevron-right" size={14} color={colors.textSubtle} />
          </Tappable>
          {me.emergencyContacts.length === 0 ? (
            <Tappable
              onPress={() => router.push('/first-aid/contacts')}
              haptic="selection"
              style={[styles.contactsHint, { backgroundColor: colors.accentSoft }]}
              accessibilityRole="button"
            >
              <Icon name="user-plus" size={14} color={colors.accent} />
              <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                {t('firstAid.noContacts')} — {t('firstAid.addContact')}
              </Text>
            </Tappable>
          ) : (
            <Text variant="caption" color="textSubtle" align="center">
              {t('firstAid.contacts')}: {me.emergencyContacts.map((c) => c.name).join(', ')}
            </Text>
          )}
        </View>

        <SectionHeader title={t('firstAid.nearest')} />
        {centers.isError ? (
          <ErrorState onRetry={() => centers.refetch()} />
        ) : centers.isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} height={72} style={{ borderRadius: radius.lg }} />)
        ) : (
          centers.data?.map((c) => {
            const meta = EMERGENCY_CENTER_META[c.type];
            return (
              <View
                key={c.id}
                style={[
                  styles.center,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.centerIcon, { backgroundColor: `${meta.color}22` }]}>
                  <Icon name={meta.icon} size={18} color={meta.color} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="title" numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {t(meta.labelKey)} · {formatDistance(c.distanceKm, locale)} ·{' '}
                    {t('firstAid.eta')} {estimateEtaMin(c.distanceKm)} dk
                    {c.open24h ? ` · ${t('firstAid.open24h')}` : ''}
                  </Text>
                </View>
                {c.phone ? (
                  <Button
                    label={t('firstAid.call')}
                    size="sm"
                    variant="secondary"
                    icon="mail"
                    onPress={() => Linking.openURL(`tel:${c.phone}`)}
                  />
                ) : null}
                <Button
                  label={t('firstAid.directions')}
                  size="sm"
                  icon="navigation"
                  onPress={() =>
                    Linking.openURL(mapsUrl(c.coords.latitude, c.coords.longitude, c.name))
                  }
                />
              </View>
            );
          })
        )}

        <SectionHeader title={t('firstAid.guides')} subtitle={t('firstAid.guidesDescription')} />
        {FIRST_AID_CATEGORIES.map((cat) => (
          <View key={cat} style={{ gap: spacing.sm }}>
            <Text variant="label" color="textSubtle">
              {t(`firstAid.category.${cat}` as TranslationKey).toLocaleUpperCase('tr-TR')}
            </Text>
            {guides
              .filter((g) => g.category === cat)
              .map((g) => (
                <Tappable
                  key={g.slug}
                  onPress={() =>
                    router.push({ pathname: '/first-aid/[slug]', params: { slug: g.slug } })
                  }
                  scaleTo={0.985}
                  style={[
                    styles.guide,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={g.title}
                >
                  <View style={[styles.guideIcon, { backgroundColor: colors.dangerSoft }]}>
                    <Icon
                      name={g.icon as IconName}
                      size={18}
                      color={colors.danger}
                      strokeWidth={2.2}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="title">{g.title}</Text>
                    <Text variant="caption" color="textMuted" numberOfLines={1}>
                      {g.summary}
                    </Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textSubtle} />
                </Tappable>
              ))}
          </View>
        ))}

        <View
          style={[
            styles.tips,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          ]}
        >
          <View style={styles.tipRow}>
            <Icon name="bell-ring" size={14} color={colors.textMuted} />
            <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
              {t('firstAid.whistle')}: {t('firstAid.whistleHint')}
            </Text>
          </View>
          <Text variant="caption" color="textSubtle">
            {t('firstAid.disclaimer')}
          </Text>
        </View>
      </View>
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
  sosCard: {
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'stretch',
  },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  contactsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.md,
  },
  center: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  centerIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  guideIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tips: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
