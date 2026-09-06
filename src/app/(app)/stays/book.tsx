import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  IconButton,
  Screen,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { msToDay, type ISODate, type QuoteInput } from '@/domain';
import {
  AvailabilityCalendar,
  monthStart,
  PolicyBadge,
  QuoteBreakdown,
  shiftMonth,
  UnitCard,
} from '@/features/inventory/components';
import {
  useAvailability,
  useBookStay,
  useHostProfile,
  useQuote,
  useUnits,
} from '@/features/inventory/hooks';
import { useBusiness } from '@/features/stays/hooks';

type Provider = 'iyzico' | 'card';

/** Emanetli rezervasyon akışı: birim → tarih → misafir → ödeme. */
export default function BookStayScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();

  const [today] = useState(() => msToDay(Date.now()));
  const [month, setMonth] = useState(() => monthStart(today));
  const [unitId, setUnitId] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState<ISODate | null>(null);
  const [checkOut, setCheckOut] = useState<ISODate | null>(null);
  const [guests, setGuests] = useState(2);
  const [provider, setProvider] = useState<Provider>('iyzico');

  const business = useBusiness(businessId, null);
  const units = useUnits(businessId);
  const host = useHostProfile(businessId);
  // Parametresiz ya da geçersiz kimlikle açıldığında "birim yok" değil "bulunamadı" göster.
  const missingBusiness = !businessId || (!business.isLoading && !business.data);
  const selectedUnitId = unitId ?? units.data?.[0]?.id ?? null;
  const selectedUnit = units.data?.find((u) => u.id === selectedUnitId) ?? null;
  const availability = useAvailability(selectedUnitId, month, shiftMonth(month, 1));

  const quoteInput = useMemo<QuoteInput | null>(
    () =>
      selectedUnitId && checkIn && checkOut
        ? { businessId, unitId: selectedUnitId, checkIn, checkOut, guests }
        : null,
    [businessId, selectedUnitId, checkIn, checkOut, guests],
  );
  const quote = useQuote(quoteInput);
  const book = useBookStay();

  const onDates = (nextIn: ISODate | null, nextOut: ISODate | null) => {
    setCheckIn(nextIn);
    setCheckOut(nextOut);
  };

  const submit = () => {
    if (!quoteInput) return;
    book.mutate(
      { ...quoteInput, provider },
      {
        onSuccess: (created) => {
          toast(t('inventory.payment.success'), 'success');
          router.replace({ pathname: '/stays/booking/[id]', params: { id: created.id } });
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  const canPay = !!quote.data?.available && !!quoteInput && !book.isPending;
  const guestOptions = selectedUnit
    ? Array.from({ length: Math.min(6, selectedUnit.capacity) }, (_, i) => i + 1)
    : [1, 2, 3, 4];

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('inventory.title')}
        subtitle={business.data?.name}
        right={
          <IconButton
            icon="x"
            onPress={() => goBack(router)}
            accessibilityLabel={t('common.close')}
          />
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {missingBusiness ? (
          <EmptyState
            icon="building-2"
            title={t('inventory.business.notFound')}
            description={t('inventory.business.notFoundDescription')}
          />
        ) : units.isError ? (
          <ErrorState onRetry={() => units.refetch()} />
        ) : units.isLoading || business.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={96} style={{ borderRadius: radius.xl }} />
            <Skeleton height={96} style={{ borderRadius: radius.xl }} />
            <Skeleton height={320} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : !units.data || units.data.length === 0 ? (
          <EmptyState
            icon="tent"
            title={t('inventory.host.noUnits')}
            description={t('inventory.host.noUnitsDescription')}
          />
        ) : (
          <>
            <Section title={t('inventory.selectUnit')}>
              {units.data.map((u) => (
                <UnitCard
                  key={u.id}
                  unit={u}
                  selected={u.id === selectedUnitId}
                  onPress={() => {
                    setUnitId(u.id);
                    setGuests((g) => Math.min(g, u.capacity));
                    onDates(null, null);
                  }}
                />
              ))}
            </Section>

            <Section title={t('inventory.selectDates')}>
              <AvailabilityCalendar
                month={month}
                onMonthChange={setMonth}
                availability={availability.data}
                loading={availability.isLoading}
                today={today}
                checkIn={checkIn}
                checkOut={checkOut}
                onChange={onDates}
              />
            </Section>

            <Section title={t('inventory.guests')}>
              <View style={styles.chips}>
                {guestOptions.map((g) => (
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
            </Section>

            <Section title={t('inventory.payment.provider')}>
              <SegmentedControl<Provider>
                segments={[
                  { value: 'iyzico', label: t('inventory.provider.iyzico') },
                  { value: 'card', label: t('inventory.provider.card') },
                ]}
                value={provider}
                onChange={setProvider}
              />
              <Text variant="caption" color="textSubtle">
                {t('inventory.payment.providerHint')}
              </Text>
            </Section>

            {host.data ? <PolicyBadge policy={host.data.cancellationPolicy} description /> : null}

            {quoteInput ? (
              quote.data ? (
                <QuoteBreakdown quote={quote.data} showDeposit />
              ) : quote.isError ? (
                <ErrorState onRetry={() => quote.refetch()} />
              ) : (
                <Skeleton height={200} style={{ borderRadius: radius.xl }} />
              )
            ) : (
              <View
                style={[styles.placeholder, { borderColor: colors.border }]}
                accessibilityLabel={t('inventory.calendar.checkInHint')}
              >
                <Icon name="calendar-days" size={18} color={colors.textSubtle} />
                <Text variant="caption" color="textSubtle">
                  {t('inventory.calendar.checkInHint')}
                </Text>
              </View>
            )}

            <View style={[styles.note, { backgroundColor: colors.primarySoft }]}>
              <Icon name="shield-check" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="caption" weight="bold">
                  {t('inventory.escrow.description')}
                </Text>
                <Text variant="label" color="textMuted">
                  {t('inventory.escrow.hint')}
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {missingBusiness ? null : (
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
            label={t('inventory.payment.payWithEscrow')}
            icon="lock"
            size="lg"
            fullWidth
            loading={book.isPending}
            disabled={!canPay}
            onPress={submit}
          />
        </View>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="h3">{title}</Text>
      {children}
    </View>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  placeholder: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
