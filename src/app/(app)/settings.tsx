import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { goBack } from '@/core/navigation';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Header, Icon, Screen, Tappable, Text, type IconName } from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { LANGUAGE_META, LOCALES, useLocaleStore, useT, type Locale } from '@/core/i18n';
import { layout, radius, spacing, useTheme, type ThemePreference } from '@/core/theme';
import { confirmDialog } from '@/core/utils/confirm';
import { getDataProvider } from '@/data';
import { useSessionStore } from '@/features/auth/session.store';

export default function SettingsScreen() {
  const { t } = useT();
  const { preference, setPreference, ambientSource, scheme } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const signOut = useSessionStore((s) => s.signOut);
  const refreshUser = useSessionStore((s) => s.refreshUser);
  const qc = useQueryClient();
  const toast = useToast();
  const router = useRouter();

  const themeOptions: { value: ThemePreference; label: string; icon: IconName }[] = [
    { value: 'auto', label: t('settings.themeAuto'), icon: 'cloud-sun' },
    { value: 'light', label: t('settings.themeLight'), icon: 'sun' },
    { value: 'dark', label: t('settings.themeDark'), icon: 'moon' },
    { value: 'sun', label: t('settings.themeSun'), icon: 'sunrise' },
    { value: 'system', label: t('settings.themeSystem'), icon: 'sparkles' },
  ];
  const localeOptions: { value: Locale; label: string }[] = LOCALES.map((code) => ({
    value: code,
    label: `${LANGUAGE_META[code].flag} ${LANGUAGE_META[code].native}`,
  }));

  const confirmSignOut = () => {
    confirmDialog(
      t('auth.signOut'),
      t('auth.signOutConfirm'),
      t('auth.signOut'),
      t('common.cancel'),
      () => {
        signOut().catch(() => toast(t('common.error'), 'error'));
      },
    );
  };

  const confirmReset = () => {
    confirmDialog(
      t('settings.resetData'),
      t('settings.resetConfirm'),
      t('settings.resetData'),
      t('common.cancel'),
      () => {
        void (async () => {
          try {
            await getDataProvider().reset();
            await qc.invalidateQueries();
            await refreshUser();
            toast(t('settings.resetDone'), 'success');
            goBack(router);
          } catch {
            toast(t('common.error'), 'error');
          }
        })();
      },
    );
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('settings.title')} showBack />
      <View style={styles.content}>
        <Group title={t('settings.appearance')}>
          <Row icon="moon" label={t('settings.theme')}>
            <View style={styles.options}>
              {themeOptions.map((opt) => (
                <Option
                  key={opt.value}
                  label={opt.label}
                  icon={opt.icon}
                  active={preference === opt.value}
                  onPress={() => setPreference(opt.value)}
                />
              ))}
            </View>
            {preference === 'auto' ? (
              <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
                {t(
                  ambientSource === 'sensor'
                    ? 'settings.themeAutoSensor'
                    : 'settings.themeAutoClock',
                  {
                    scheme: t(
                      scheme === 'sun'
                        ? 'settings.themeSun'
                        : scheme === 'dark'
                          ? 'settings.themeDark'
                          : 'settings.themeLight',
                    ),
                  },
                )}
              </Text>
            ) : null}
          </Row>
          <Row icon="languages" label={t('settings.language')} last>
            <View style={styles.options}>
              {localeOptions.map((opt) => (
                <Option
                  key={opt.value}
                  label={opt.label}
                  active={locale === opt.value}
                  onPress={() => setLocale(opt.value)}
                />
              ))}
            </View>
          </Row>
        </Group>

        <Group title={t('settings.account')}>
          <LinkRow
            icon="sparkles"
            label={t('settings.subscription')}
            description={t('plans.subtitle')}
            onPress={() => router.push('/plans')}
          />
          <LinkRow
            icon="siren"
            label={t('settings.emergencyContacts')}
            description={t('firstAid.sosHint')}
            onPress={() => router.push('/first-aid/contacts')}
          />
          <LinkRow icon="bell" label={t('settings.notifications')} />
          <LinkRow icon="lock" label={t('settings.privacy')} />
          <LinkRow
            icon="refresh-cw"
            label={t('settings.resetData')}
            description={t('settings.resetDataDescription')}
            onPress={confirmReset}
          />
          <LinkRow icon="log-out" label={t('auth.signOut')} onPress={confirmSignOut} danger last />
        </Group>

        <Group title={t('settings.about')}>
          <Row icon="info" label={t('settings.version')} last>
            <Text variant="bodySm" color="textMuted">
              {Constants.expoConfig?.version ?? '1.0.0'}
            </Text>
          </Row>
        </Group>

        <Text variant="caption" color="textSubtle" align="center" style={{ marginTop: spacing.lg }}>
          {t('common.appName')} · {t('common.tagline')}
        </Text>
      </View>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const { locale } = useT();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="label" color="textSubtle" style={{ marginLeft: spacing.xs }}>
        {title.toLocaleUpperCase(locale)}
      </Text>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  children,
  last,
}: {
  icon: IconName;
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={styles.rowHead}>
        <Icon name={icon} size={18} color={colors.textMuted} />
        <Text variant="title" style={{ flex: 1 }}>
          {label}
        </Text>
      </View>
      {children}
    </View>
  );
}

function LinkRow({
  icon,
  label,
  description,
  onPress,
  danger,
  last,
}: {
  icon: IconName;
  label: string;
  description?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Tappable
      onPress={onPress}
      haptic="selection"
      scaleTo={0.99}
      style={[
        styles.linkRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
      accessibilityRole="button"
    >
      <Icon name={icon} size={18} color={danger ? colors.danger : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text variant="title" color={danger ? 'danger' : 'text'}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" color="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
      {!danger ? <Icon name="chevron-right" size={18} color={colors.textSubtle} /> : null}
    </Tappable>
  );
}

function Option({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: IconName;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Tappable
      onPress={onPress}
      haptic="selection"
      scaleTo={0.95}
      style={[
        styles.option,
        {
          backgroundColor: active ? colors.primary : colors.surfaceMuted,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: active, selected: active }}
      aria-checked={active}
    >
      {icon ? (
        <Icon
          name={icon}
          size={14}
          color={active ? colors.onPrimary : colors.textMuted}
          strokeWidth={2.4}
        />
      ) : null}
      <Text variant="caption" weight="bold" color={active ? colors.onPrimary : colors.text}>
        {label}
      </Text>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xl,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  group: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { padding: spacing.lg, gap: spacing.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
});
