import { useLocalSearchParams, useRouter } from 'expo-router';
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
  Avatar,
  Button,
  Chip,
  Header,
  Icon,
  IconButton,
  Input,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { fontFamily, layout, radius, spacing, useTheme } from '@/core/theme';
import { ADVENTURE_TYPES, ADVENTURE_TYPE_META, type AdventureType } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { useUser } from '@/features/profile/hooks';
import { useRequestMatch } from '@/features/zmatch/hooks';

const DATE_OPTIONS = [2, 4, 7, 14, 30] as const;

export default function MatchRequestScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const me = useCurrentUser();
  const other = useUser(userId);
  const request = useRequestMatch();

  const shared = other.data?.favoriteTypes.filter((type) => me.favoriteTypes.includes(type)) ?? [];
  const [adventureType, setAdventureType] = useState<AdventureType | null>(null);
  const [daysAhead, setDaysAhead] = useState<number | null>(7);
  const [locationName, setLocationName] = useState('');
  const [message, setMessage] = useState('');
  const [now] = useState(() => Date.now());

  const effectiveType = adventureType ?? shared[0] ?? other.data?.favoriteTypes[0] ?? 'hiking';

  const submit = () => {
    if (!userId) return;
    const plannedDate = daysAhead ? new Date(now + daysAhead * 86_400_000).toISOString() : null;
    request.mutate(
      {
        receiverId: userId,
        adventureType: effectiveType,
        plannedDate,
        locationName: locationName.trim() || null,
        message,
      },
      {
        onSuccess: () => {
          toast(t('zmatch.requestSuccess'), 'success');
          goBack(router);
        },
        onError: () => toast(t('common.error'), 'error'),
      },
    );
  };

  const formatOption = (days: number) => {
    const date = new Date(now + days * 86_400_000);
    return date.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('zmatch.matchRequestTitle')}
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
        >
          {other.isLoading ? (
            <Skeleton height={80} style={{ borderRadius: radius.xl }} />
          ) : other.data ? (
            <View
              style={[
                styles.userCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Avatar
                uri={other.data.avatarUrl}
                name={other.data.displayName}
                size={56}
                verified={other.data.isVerified}
                ring
              />
              <View style={{ flex: 1 }}>
                <Text variant="h3">{other.data.displayName}</Text>
                <View style={styles.metaRow}>
                  <Icon name="map-pin" size={12} color={colors.textSubtle} />
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {other.data.locationName}
                  </Text>
                </View>
              </View>
              <View style={[styles.trust, { backgroundColor: colors.primarySoft }]}>
                <Icon name="shield-check" size={12} color={colors.primary} strokeWidth={2.6} />
                <Text variant="label" weight="extrabold" color="primary">
                  {other.data.trustScore}
                </Text>
              </View>
            </View>
          ) : null}

          <Field title={t('zmatch.preferredType')}>
            <View style={styles.chips}>
              {(other.data?.favoriteTypes ?? ADVENTURE_TYPES).map((type) => {
                const meta = ADVENTURE_TYPE_META[type];
                return (
                  <Chip
                    key={type}
                    label={t(meta.labelKey)}
                    icon={meta.icon}
                    color={meta.color}
                    selected={effectiveType === type}
                    onPress={() => setAdventureType(type)}
                  />
                );
              })}
            </View>
          </Field>

          <Field title={t('zmatch.when')}>
            <View style={styles.chips}>
              {DATE_OPTIONS.map((days) => (
                <Chip
                  key={days}
                  size="sm"
                  label={formatOption(days)}
                  icon="calendar"
                  selected={daysAhead === days}
                  onPress={() => setDaysAhead(daysAhead === days ? null : days)}
                />
              ))}
            </View>
          </Field>

          <Input
            label={t('zmatch.where')}
            icon="map-pin"
            value={locationName}
            onChangeText={setLocationName}
            placeholder={t('post.locationPlaceholder')}
          />

          <Field title={t('chat.title')}>
            <View
              style={[
                styles.messageWrap,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
              ]}
            >
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder={t('zmatch.matchMessagePlaceholder')}
                placeholderTextColor={colors.textSubtle}
                multiline
                maxLength={300}
                style={[styles.message, { color: colors.text, fontFamily: fontFamily.medium }]}
              />
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
            label={t('zmatch.sendRequest')}
            size="lg"
            fullWidth
            icon="heart-handshake"
            loading={request.isPending}
            disabled={!other.data}
            onPress={submit}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" color="textMuted" style={{ marginLeft: spacing.xs }}>
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  trust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  messageWrap: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    minHeight: 96,
  },
  message: {
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
