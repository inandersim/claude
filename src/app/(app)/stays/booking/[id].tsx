import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  Input,
  Header,
  Screen,
  Skeleton,
  SkeletonGroup,
  Tappable,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT, type TranslationKey } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import {
  BUSINESS_TYPE_META,
  canCancel,
  canReview,
  eachNight,
  formatPriceTry,
  nightlyPrice,
  type BookingWithPayment,
  type Quote,
} from '@/domain';
import {
  PaymentTimeline,
  PolicyBadge,
  QuoteBreakdown,
  ReviewRow,
  STAY_STATUS_COLOR,
  UnitCard,
} from '@/features/inventory/components';
import {
  useBookingDetail,
  useCancelBooking,
  useCheckIn,
  useRefundPreview,
  useStayReviews,
  useWriteReview,
} from '@/features/inventory/hooks';

/** Rezervasyon detayı: birim, tarihler, fiyat, ödeme yolculuğu, iptal / giriş / yorum. */
export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [now] = useState(() => Date.now());

  const booking = useBookingDetail(id);
  const data = booking.data ?? null;
  const reviews = useStayReviews(data?.businessId);
  const myReview = reviews.data?.find((r) => r.bookingId === id) ?? null;

  const [cancelOpen, setCancelOpen] = useState(false);
  const refund = useRefundPreview(id, cancelOpen);
  const cancel = useCancelBooking();
  const checkIn = useCheckIn();
  const writeReview = useWriteReview();

  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  const quote = useMemo<Quote | null>(() => (data ? quoteFromBooking(data) : null), [data]);
  const onError = (e: unknown) =>
    toast(e instanceof Error ? e.message : t('common.error'), 'error');

  const confirmCancel = () => {
    if (!data) return;
    cancel.mutate(data.id, {
      onSuccess: () => {
        setCancelOpen(false);
        toast(t('inventory.refund.cancelled'), 'success');
      },
      onError,
    });
  };

  const doCheckIn = () => {
    if (!data) return;
    checkIn.mutate(data.id, {
      onSuccess: () => toast(t('inventory.checkedIn'), 'success'),
      onError,
    });
  };

  const submitReview = () => {
    if (!data) return;
    if (reviewText.trim().length < 3) {
      toast(t('inventory.review.textRequired'), 'error');
      return;
    }
    writeReview.mutate(
      { bookingId: data.id, rating, text: reviewText },
      {
        onSuccess: () => {
          setReviewText('');
          toast(t('inventory.review.submitted'), 'success');
        },
        onError,
      },
    );
  };

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('inventory.booking.title')}
        subtitle={data ? `${t('inventory.booking.code')} ${data.id.toUpperCase()}` : undefined}
        showBack
        onBack={() => goBack(router)}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {booking.isError ? (
          <ErrorState onRetry={() => booking.refetch()} />
        ) : booking.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={90} style={{ borderRadius: radius.xl }} />
            <Skeleton height={120} style={{ borderRadius: radius.xl }} />
            <Skeleton height={220} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : !data ? (
          <EmptyState
            icon="calendar-days"
            title={t('inventory.booking.notFound')}
            description={t('inventory.booking.notFoundDescription')}
          />
        ) : (
          <>
            <Tappable
              onPress={() =>
                router.push({ pathname: '/stays/[id]', params: { id: data.businessId } })
              }
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={t('inventory.booking.viewBusiness')}
              style={[
                styles.business,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.bizIcon, { backgroundColor: colors.surfaceMuted }]}>
                <Icon
                  name={BUSINESS_TYPE_META[data.business.type].icon}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title" numberOfLines={1}>
                  {data.business.name}
                </Text>
                <Text variant="caption" color="textMuted" numberOfLines={1}>
                  {data.business.locationName}
                </Text>
              </View>
              <Badge
                label={t(`inventory.status.${data.status}`)}
                color={STAY_STATUS_COLOR[data.status]}
              />
            </Tappable>

            <View
              style={[
                styles.dates,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <DateCol
                label={t('stays.checkIn')}
                value={formatDate(data.checkIn, locale, 'EEE d MMM')}
              />
              <View style={[styles.arrow, { backgroundColor: colors.surfaceMuted }]}>
                <Icon name="arrow-right" size={14} color={colors.textMuted} />
                <Text variant="label" color="textMuted">
                  {t('inventory.nights', { count: data.nights })}
                </Text>
              </View>
              <DateCol
                label={t('stays.checkOut')}
                value={formatDate(data.checkOut, locale, 'EEE d MMM')}
              />
              <View style={styles.guests}>
                <Icon name="users" size={14} color={colors.textMuted} />
                <Text variant="caption" weight="bold">
                  {data.guests}
                </Text>
              </View>
            </View>

            {data.unit ? <UnitCard unit={data.unit} /> : null}

            {quote ? <QuoteBreakdown quote={quote} /> : null}

            <PolicyBadge policy={data.policy} description />

            {data.payment ? (
              <PaymentTimeline payment={data.payment} />
            ) : (
              <View style={[styles.hint, { backgroundColor: colors.surfaceMuted }]}>
                <Icon name="info" size={14} color={colors.textMuted} />
                <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                  {t('inventory.payment.none')}
                </Text>
              </View>
            )}

            {canCancel(data, now) ? (
              <View style={{ gap: spacing.sm }}>
                {!cancelOpen ? (
                  <Button
                    label={t('inventory.cancel')}
                    variant="danger"
                    icon="circle-x"
                    onPress={() => setCancelOpen(true)}
                  />
                ) : (
                  <View
                    style={[
                      styles.refund,
                      { backgroundColor: colors.surface, borderColor: colors.danger },
                    ]}
                  >
                    <Text variant="h3">{t('inventory.cancelConfirmTitle')}</Text>
                    {refund.data ? (
                      <>
                        <View style={styles.row}>
                          <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
                            {t('inventory.refund.amount')}
                          </Text>
                          <Text variant="title" color="success">
                            {formatPriceTry(refund.data.refundTry, locale, false)}
                          </Text>
                        </View>
                        <View style={styles.row}>
                          <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
                            {t('inventory.refund.kept')}
                          </Text>
                          <Text variant="title" color={refund.data.keptTry > 0 ? 'danger' : 'text'}>
                            {formatPriceTry(refund.data.keptTry, locale, false)}
                          </Text>
                        </View>
                        <Text variant="caption" color="textMuted">
                          {t(refund.data.reason as TranslationKey)}
                        </Text>
                      </>
                    ) : refund.isError ? (
                      <ErrorState onRetry={() => refund.refetch()} />
                    ) : (
                      <Skeleton height={48} />
                    )}
                    <View style={styles.actions}>
                      <Button
                        label={t('inventory.keep')}
                        variant="secondary"
                        onPress={() => setCancelOpen(false)}
                        style={{ flex: 1 }}
                      />
                      <Button
                        label={t('inventory.refund.confirm')}
                        variant="danger"
                        loading={cancel.isPending}
                        disabled={!refund.data}
                        onPress={confirmCancel}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                )}
                <Button
                  label={t('inventory.checkIn')}
                  variant="secondary"
                  icon="key-round"
                  loading={checkIn.isPending}
                  onPress={doCheckIn}
                />
                <Text variant="label" color="textSubtle" align="center">
                  {t('inventory.checkInHint')}
                </Text>
              </View>
            ) : data.status === 'confirmed' || data.status === 'pending' ? (
              <Button
                label={t('inventory.checkIn')}
                variant="secondary"
                icon="key-round"
                loading={checkIn.isPending}
                onPress={doCheckIn}
              />
            ) : null}

            {data.status === 'completed' ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="h3">{t('inventory.review.write')}</Text>
                {myReview ? (
                  <ReviewRow review={myReview} />
                ) : canReview(data, now) ? (
                  <View
                    style={[
                      styles.refund,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text variant="caption" color="textMuted">
                      {t('inventory.review.rating')}
                    </Text>
                    <View style={styles.stars}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Tappable
                          key={i}
                          onPress={() => setRating(i)}
                          haptic="selection"
                          accessibilityRole="button"
                          accessibilityLabel={`${i}/5`}
                          accessibilityState={{ selected: i <= rating }}
                          style={styles.star}
                        >
                          <Icon
                            name="star"
                            size={28}
                            color="#FFB547"
                            fill={i <= rating ? '#FFB547' : 'none'}
                            strokeWidth={2}
                          />
                        </Tappable>
                      ))}
                    </View>
                    <Input
                      placeholder={t('inventory.review.placeholder')}
                      value={reviewText}
                      onChangeText={setReviewText}
                      multiline
                      numberOfLines={4}
                      style={{ minHeight: 88, textAlignVertical: 'top' }}
                    />
                    <Button
                      label={t('inventory.review.submit')}
                      icon="send"
                      loading={writeReview.isPending}
                      onPress={submitReview}
                    />
                    <Text variant="label" color="textSubtle">
                      {t('inventory.review.window')}
                    </Text>
                  </View>
                ) : (
                  <Text variant="caption" color="textSubtle">
                    {t('inventory.review.window')}
                  </Text>
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Rezervasyondan deterministik fiyat kırılımı üretir (birim fiyatı saf fonksiyondur). */
function quoteFromBooking(b: BookingWithPayment): Quote {
  const nightly = b.unit
    ? eachNight(b.checkIn, b.checkOut).map((date) => ({
        date,
        priceTry: nightlyPrice(b.unit!, date),
      }))
    : [];
  const subtotalTry = b.totalTry - b.platformFeeTry;
  return {
    nights: b.nights,
    nightly,
    subtotalTry,
    platformFeeTry: b.platformFeeTry,
    totalTry: b.totalTry,
    depositTry: Math.round(b.totalTry * 0.2),
    policy: b.policy,
    available: true,
  };
}

function DateCol({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="label" color="textSubtle">
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
    paddingTop: spacing.sm,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  business: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bizIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  arrow: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 1,
  },
  guests: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  refund: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  stars: { flexDirection: 'row', gap: spacing.xs },
  star: { padding: 2 },
});
