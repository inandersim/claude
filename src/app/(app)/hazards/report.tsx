import { useRouter } from 'expo-router';
import { goBack } from '@/core/navigation';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Chip,
  Header,
  Icon,
  IconButton,
  Input,
  Screen,
  Tappable,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { fontFamily, layout, radius, spacing, useTheme } from '@/core/theme';
import {
  HAZARD_SEVERITIES,
  HAZARD_SEVERITY_META,
  HAZARD_TYPES,
  HAZARD_TYPE_META,
  type HazardSeverity,
  type HazardType,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useReportHazard } from '@/features/hazards/hooks';

const RADII = [100, 300, 500, 1000, 3000] as const;
const EXPIRIES: { hours: number | null; label: string }[] = [
  { hours: 24, label: '24' },
  { hours: 72, label: '72' },
  { hours: 168, label: '168' },
  { hours: null, label: '∞' },
];

export default function ReportHazardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const report = useReportHazard();

  const [type, setType] = useState<HazardType>('rockfall');
  const [severity, setSeverity] = useState<HazardSeverity>('high');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [radiusM, setRadiusM] = useState<number>(300);
  const [expiresInHours, setExpiresInHours] = useState<number | null>(72);
  const [errors, setErrors] = useState<{ title?: string; locationName?: string }>({});

  const submit = () => {
    const next: typeof errors = {};
    if (!title.trim()) next.title = t('hazards.titleRequired');
    if (!locationName.trim()) next.locationName = t('hazards.locationRequired');
    setErrors(next);
    if (Object.keys(next).length) return;
    report.mutate(
      {
        type,
        severity,
        title,
        description,
        locationName,
        coords: location.coords,
        radiusM,
        expiresInHours,
      },
      {
        onSuccess: () => {
          toast(t('hazards.reportedToast'), 'success');
          goBack(router);
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('hazards.reportTitle')}
        right={
          <IconButton
            icon="x"
            onPress={() => goBack(router)}
            accessibilityLabel={t('common.close')}
          />
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Field title={t('hazards.typeLabel')}>
            <View style={styles.typeGrid}>
              {HAZARD_TYPES.map((item) => {
                const meta = HAZARD_TYPE_META[item];
                const active = type === item;
                return (
                  <Tappable
                    key={item}
                    onPress={() => setType(item)}
                    haptic="selection"
                    scaleTo={0.94}
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor: active ? colors.primarySoft : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <Icon
                      name={meta.icon}
                      size={20}
                      color={active ? colors.primary : colors.textMuted}
                      strokeWidth={2.2}
                    />
                    <Text
                      variant="caption"
                      weight="bold"
                      color={active ? 'primary' : 'text'}
                      numberOfLines={1}
                    >
                      {t(meta.labelKey)}
                    </Text>
                  </Tappable>
                );
              })}
            </View>
          </Field>

          <Field title={t('hazards.severityLabel')}>
            <View style={styles.chips}>
              {HAZARD_SEVERITIES.map((s) => (
                <Chip
                  key={s}
                  label={t(HAZARD_SEVERITY_META[s].labelKey)}
                  color={HAZARD_SEVERITY_META[s].color}
                  selected={severity === s}
                  onPress={() => setSeverity(s)}
                  icon={s === 'critical' ? 'siren' : undefined}
                />
              ))}
            </View>
          </Field>

          <Input
            label={t('hazards.titleLabel')}
            value={title}
            onChangeText={setTitle}
            placeholder={t('hazards.titlePlaceholder')}
            error={errors.title}
          />

          <View>
            <Text variant="caption" color="textMuted" style={styles.label}>
              {t('hazards.descriptionLabel')}
            </Text>
            <View
              style={[
                styles.textarea,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('hazards.descriptionPlaceholder')}
                placeholderTextColor={colors.textSubtle}
                multiline
                maxLength={600}
                style={[
                  styles.textareaInput,
                  { color: colors.text, fontFamily: fontFamily.medium },
                ]}
              />
            </View>
          </View>

          <Input
            label={t('post.location')}
            icon="map-pin"
            value={locationName}
            onChangeText={setLocationName}
            placeholder={t('post.locationPlaceholder')}
            error={errors.locationName}
            hint={location.isFallback ? undefined : t('hazards.locationUsed')}
            right={
              <IconButton
                icon="locate-fixed"
                size={32}
                iconSize={16}
                variant="ghost"
                color={location.isFallback ? colors.textSubtle : colors.primary}
                onPress={location.request}
                accessibilityLabel={t('hazards.useMyLocation')}
              />
            }
          />

          <Field title={t('hazards.radius')}>
            <View style={styles.chips}>
              {RADII.map((r) => (
                <Chip
                  key={r}
                  size="sm"
                  label={r >= 1000 ? `${r / 1000} km` : `${r} m`}
                  selected={radiusM === r}
                  onPress={() => setRadiusM(r)}
                />
              ))}
            </View>
          </Field>

          <Field title={`${t('hazards.expires')} (${t('hazards.hours')})`}>
            <View style={styles.chips}>
              {EXPIRIES.map((e) => (
                <Chip
                  key={e.label}
                  size="sm"
                  label={e.hours === null ? t('hazards.noExpiry') : e.label}
                  selected={expiresInHours === e.hours}
                  onPress={() => setExpiresInHours(e.hours)}
                />
              ))}
            </View>
          </Field>
        </ScrollView>
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <Button
            label={t('hazards.report')}
            icon="siren"
            variant="danger"
            size="lg"
            fullWidth
            loading={report.isPending}
            onPress={submit}
            style={{ backgroundColor: colors.danger }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" color="textMuted" style={styles.label}>
        {title}
      </Text>
      {children}
    </View>
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
  label: { marginLeft: spacing.xs },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: {
    flexBasis: '22%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  textarea: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    minHeight: 100,
    marginTop: spacing.xs + 2,
  },
  textareaInput: {
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
