import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBack } from '@/core/navigation';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
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
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatPriceTry, stayTotal } from '@/domain';
import { useBusiness, useReserveStay } from '@/features/stays/hooks';

export default function ReserveStayScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const business = useBusiness(businessId, null);
  const reserve = useReserveStay();
  const [now] = useState(() => Date.now());
  const [inOffset, setInOffset] = useState(7);
  const [nights, setNights] = useState(2);
  const [guests, setGuests] = useState(2);
  const data = business.data;

  const dateAt = (days: number) => new Date(now + days * 86_400_000);
  const fmt = (d: Date) =>
    d.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  const totals = data?.priceFromTry !== null && data ? stayTotal(data.priceFromTry, nights) : null;

  const submit = () => {
    if (!data) return;
    reserve.mutate(
      {
        businessId: data.id,
        checkIn: dateAt(inOffset).toISOString(),
        checkOut: dateAt(inOffset + nights).toISOString(),
        guests,
      },
      {
        onSuccess: () => {
          toast(t('stays.reserved'), 'success');
          goBack(router);
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('stays.reserveTitle')}
        subtitle={data?.name}
        right={
          <IconButton
            icon="x"
            onPress={() => goBack(router)}
            accessibilityLabel={t('common.close')}
          />
        }
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        {!data && (business.isLoading || business.isFetching) ? (
          <Skeleton height={80} style={{ borderRadius: radius.xl }} />
        ) : !data ? (
          <EmptyState
            icon="compass"
            title={t('notFound.title')}
            description={t('notFound.description')}
          />
        ) : (
          <>
            <Field title={`${t('stays.checkIn')} (${t('stays.dateHint')})`}>
              <View style={styles.chips}>
                {[1, 3, 7, 14, 30].map((d) => (
                  <Chip
                    key={d}
                    size="sm"
                    icon="calendar"
                    label={fmt(dateAt(d))}
                    selected={inOffset === d}
                    onPress={() => setInOffset(d)}
                  />
                ))}
              </View>
            </Field>
            <Field title={t('stays.nights')}>
              <View style={styles.chips}>
                {[1, 2, 3, 5, 7].map((n) => (
                  <Chip
                    key={n}
                    size="sm"
                    label={`${n} ${t('stays.nights')}`}
                    selected={nights === n}
                    onPress={() => setNights(n)}
                  />
                ))}
              </View>
            </Field>
            <Field title={t('stays.guests')}>
              <View style={styles.chips}>
                {[1, 2, 3, 4, 6].map((g) => (
                  <Chip
                    key={g}
                    size="sm"
                    icon="users"
                    label={`${g}`}
                    selected={guests === g}
                    onPress={() => setGuests(g)}
                  />
                ))}
              </View>
            </Field>

            <View
              style={[
                styles.summary,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Row
                label={`${t('stays.checkIn')} → ${t('stays.checkOut')}`}
                value={`${fmt(dateAt(inOffset))} → ${fmt(dateAt(inOffset + nights))}`}
              />
              {totals ? (
                <>
                  <Row
                    label={`${formatPriceTry(data.priceFromTry ?? 0, locale)} × ${nights} ${t('stays.nights')}`}
                    value={formatPriceTry(totals.subtotalTry, locale)}
                  />
                  <Row
                    label={t('stays.serviceFee')}
                    value={formatPriceTry(totals.feeTry, locale)}
                  />
                  <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
                    <Text variant="title">{t('stays.total')}</Text>
                    <Text variant="h2" color="primary">
                      {formatPriceTry(totals.totalTry, locale)}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>
            <View style={[styles.note, { backgroundColor: colors.primarySoft }]}>
              <Icon name="shield-check" size={14} color={colors.primary} />
              <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                {t('market.safeTrade')}
              </Text>
            </View>
          </>
        )}
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
          label={t('stays.confirm')}
          icon="calendar-check"
          size="lg"
          fullWidth
          loading={reserve.isPending}
          disabled={!data}
          onPress={submit}
        />
      </View>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
        {label}
      </Text>
      <Text variant="bodySm" weight="bold">
        {value}
      </Text>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summary: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
