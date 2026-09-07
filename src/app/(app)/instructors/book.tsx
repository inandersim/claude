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
  EmptyState,
  Header,
  Icon,
  IconButton,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { fontFamily, layout, radius, spacing, useTheme } from '@/core/theme';
import { ADVENTURE_TYPE_META, formatPriceTry, type AdventureType } from '@/domain';
import { RatingStars } from '@/features/instructors/components/RatingStars';
import { useBook, useInstructor } from '@/features/instructors/hooks';

export default function BookInstructorScreen() {
  const { instructorId } = useLocalSearchParams<{ instructorId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const instructor = useInstructor(instructorId, null);
  const book = useBook();
  const [now] = useState(() => Date.now());
  const [type, setType] = useState<AdventureType | null>(null);
  const [dayOffset, setDayOffset] = useState<number>(3);
  const [message, setMessage] = useState('');
  const data = instructor.data;
  // Parametresiz ya da geçersiz kimlikle açıldığında iskelet takılı kalmasın.
  const notFound = !instructorId || (!instructor.isLoading && !data);
  const effectiveType = type ?? data?.specialties[0] ?? 'hiking';

  // Eğitmenin uygun günlerine denk gelen sonraki 10 gün
  const options: { offset: number; date: Date }[] = [];
  for (let i = 1; i <= 21 && options.length < 8; i++) {
    const date = new Date(now + i * 86_400_000);
    if (!data || data.availableDays.includes(date.getDay())) options.push({ offset: i, date });
  }
  const selected = options.find((o) => o.offset === dayOffset) ?? options[0];

  const submit = () => {
    if (!data || !selected) return;
    book.mutate(
      {
        instructorId: data.id,
        adventureType: effectiveType,
        date: selected.date.toISOString(),
        message,
      },
      {
        onSuccess: () => {
          toast(t('instructors.requestSent'), 'success');
          goBack(router);
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('instructors.bookTitle')}
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
          {notFound ? (
            <EmptyState
              icon="graduation-cap"
              // Eksik olan rota değil, seçim: bu ekrana eğitmen kimliği
              // olmadan gelinebilir (derin bağlantı, geri gezinme).
              title={t('instructors.notFound')}
              description={t('instructors.notFoundDescription')}
            />
          ) : (
            <>
              {instructor.isLoading || !data ? (
                <Skeleton height={80} style={{ borderRadius: radius.xl }} />
              ) : (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Avatar
                    uri={data.user.avatarUrl}
                    name={data.user.displayName}
                    size={52}
                    verified={data.user.isVerified}
                    ring
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="h3">{data.user.displayName}</Text>
                    <Text variant="caption" color="textMuted" numberOfLines={1}>
                      {data.headline}
                    </Text>
                    <RatingStars rating={data.rating} count={data.reviewCount} size={11} />
                  </View>
                </View>
              )}

              <Field title={t('post.adventureType')}>
                <View style={styles.chips}>
                  {(data?.specialties ?? []).map((item) => {
                    const meta = ADVENTURE_TYPE_META[item];
                    return (
                      <Chip
                        key={item}
                        label={t(meta.labelKey)}
                        icon={meta.icon}
                        color={meta.color}
                        selected={effectiveType === item}
                        onPress={() => setType(item)}
                      />
                    );
                  })}
                </View>
              </Field>

              <Field title={t('instructors.date')}>
                <View style={styles.chips}>
                  {options.map((o) => (
                    <Chip
                      key={o.offset}
                      size="sm"
                      icon="calendar"
                      label={o.date.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                      selected={selected?.offset === o.offset}
                      onPress={() => setDayOffset(o.offset)}
                    />
                  ))}
                </View>
              </Field>

              <Field title={t('chat.title')}>
                <View
                  style={[
                    styles.textarea,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                  ]}
                >
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder={t('instructors.messagePlaceholder')}
                    placeholderTextColor={colors.textSubtle}
                    multiline
                    maxLength={400}
                    style={[
                      styles.textareaInput,
                      { color: colors.text, fontFamily: fontFamily.medium },
                    ]}
                  />
                </View>
              </Field>

              {data ? (
                <View style={[styles.summary, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="banknote" size={18} color={colors.primary} strokeWidth={2.4} />
                  <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
                    {data.sessionDurationMin} {t('common.min')} ·{' '}
                    {t(ADVENTURE_TYPE_META[effectiveType].labelKey)}
                  </Text>
                  <Text variant="h3" color="primary">
                    {formatPriceTry(data.pricePerSessionTry, locale)}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
        {notFound ? null : (
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
              label={t('instructors.sendRequest')}
              icon="calendar-check"
              size="lg"
              fullWidth
              loading={book.isPending}
              disabled={!data}
              onPress={submit}
            />
          </View>
        )}
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  textarea: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    minHeight: 96,
  },
  textareaInput: {
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    minHeight: 90,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
