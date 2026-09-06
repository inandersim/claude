import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Input,
  Screen,
  SegmentedControl,
  Skeleton,
  SkeletonGroup,
  StatTile,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { goBack } from '@/core/navigation';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import {
  CANCELLATION_POLICIES,
  formatPriceTry,
  hostTrustScore,
  msToDay,
  payoutSummary,
  UNIT_KINDS,
  type BookingWithPayment,
  type CancellationPolicy,
  type ISODate,
  type StayUnit,
  type UnitKind,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import {
  AvailabilityCalendar,
  HostVerificationSteps,
  monthStart,
  PAYMENT_STATUS_COLOR,
  PolicyBadge,
  shiftMonth,
  STAY_STATUS_COLOR,
  TrustScoreRing,
  UnitCard,
} from '@/features/inventory/components';
import {
  useAvailability,
  useBlockDates,
  useHostBookings,
  useHostProfile,
  useStayReviews,
  useUnits,
  useUpsertUnit,
  useVerifyHost,
} from '@/features/inventory/hooks';
import { useBusiness } from '@/features/stays/hooks';

type Tab = 'inventory' | 'calendar' | 'bookings' | 'payouts' | 'verification';
const TABS: Tab[] = ['inventory', 'calendar', 'bookings', 'payouts', 'verification'];

/** İşletme host paneli: envanter, takvim, rezervasyonlar, ödemeler, doğrulama. */
export default function HostBusinessScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const [tab, setTab] = useState<Tab>('inventory');

  const business = useBusiness(businessId, null);
  const host = useHostProfile(businessId);
  const units = useUnits(businessId);
  const bookings = useHostBookings(businessId);
  const reviews = useStayReviews(businessId);

  const isOwner = business.data?.ownerId === me.id;
  const score = host.data ? hostTrustScore(host.data, reviews.data ?? []) : null;

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={business.data?.name ?? t('inventory.host.title')}
        subtitle={business.data?.locationName}
        showBack
        onBack={() => goBack(router)}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {business.isError ? (
          <ErrorState onRetry={() => business.refetch()} />
        ) : business.isLoading || host.isLoading ? (
          <SkeletonGroup>
            <Skeleton height={110} style={{ borderRadius: radius.xl }} />
            <Skeleton height={44} style={{ borderRadius: radius.full }} />
            <Skeleton height={200} style={{ borderRadius: radius.xl }} />
          </SkeletonGroup>
        ) : !business.data || !host.data ? (
          <EmptyState icon="building-2" title={t('notFound.title')} />
        ) : (
          <>
            <View
              style={[
                styles.summary,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {score !== null ? <TrustScoreRing score={score} size={72} /> : null}
              <View style={{ flex: 1, gap: spacing.sm }}>
                <View style={styles.badges}>
                  {!isOwner ? (
                    <Badge label={t('inventory.host.demo')} color={colors.warning} icon="eye" />
                  ) : null}
                  <Badge
                    label={t(`inventory.verification.${host.data.verification}`)}
                    color={host.data.verification === 'none' ? colors.textMuted : colors.primary}
                    icon="shield-check"
                  />
                </View>
                <View style={styles.stats}>
                  <MiniStat
                    label={t('inventory.host.stats.units')}
                    value={units.data?.length ?? 0}
                  />
                  <MiniStat
                    label={t('inventory.host.stats.bookings')}
                    value={bookings.data?.length ?? 0}
                  />
                  <MiniStat
                    label={t('inventory.host.stats.reviews')}
                    value={reviews.data?.length ?? 0}
                  />
                </View>
                <Text variant="label" color="textSubtle">
                  {t('inventory.trust.hint')}
                </Text>
              </View>
            </View>

            {!isOwner ? (
              <View style={[styles.hint, { backgroundColor: colors.warningSoft }]}>
                <Icon name="lock" size={14} color={colors.warning} />
                <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                  {t('inventory.host.demoHint')}
                </Text>
              </View>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.tabs}>
                {TABS.map((k) => (
                  <Chip
                    key={k}
                    label={t(`inventory.tabs.${k}`)}
                    selected={tab === k}
                    onPress={() => setTab(k)}
                    size="sm"
                  />
                ))}
              </View>
            </ScrollView>

            {tab === 'inventory' ? (
              <InventoryTab
                businessId={businessId}
                units={units.data ?? []}
                loading={units.isLoading}
                error={units.isError}
                onRetry={() => units.refetch()}
                isOwner={isOwner}
              />
            ) : tab === 'calendar' ? (
              <CalendarTab units={units.data ?? []} isOwner={isOwner} />
            ) : tab === 'bookings' ? (
              <BookingsTab
                bookings={bookings.data ?? []}
                loading={bookings.isLoading}
                error={bookings.isError}
                onRetry={() => bookings.refetch()}
              />
            ) : tab === 'payouts' ? (
              <PayoutsTab bookings={bookings.data ?? []} iban={host.data.payoutIban} />
            ) : (
              <VerificationTab
                businessId={businessId}
                level={host.data.verification}
                policy={host.data.cancellationPolicy}
                responseRatePct={host.data.responseRatePct}
                responseTimeMin={host.data.responseTimeMin}
                isOwner={isOwner}
              />
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Envanter                                                             */
/* ------------------------------------------------------------------ */

interface UnitForm {
  id?: string;
  name: string;
  kind: UnitKind;
  capacity: string;
  quantity: string;
  basePriceTry: string;
  weekendMultiplier: string;
  amenities: string;
}

const emptyForm = (): UnitForm => ({
  name: '',
  kind: 'room',
  capacity: '2',
  quantity: '1',
  basePriceTry: '',
  weekendMultiplier: '1.2',
  amenities: '',
});

const toForm = (u: StayUnit): UnitForm => ({
  id: u.id,
  name: u.name,
  kind: u.kind,
  capacity: String(u.capacity),
  quantity: String(u.quantity),
  basePriceTry: String(u.basePriceTry),
  weekendMultiplier: String(u.weekendMultiplier),
  amenities: u.amenities.join(', '),
});

function InventoryTab({
  businessId,
  units,
  loading,
  error,
  onRetry,
  isOwner,
}: {
  businessId: string;
  units: StayUnit[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  isOwner: boolean;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const upsert = useUpsertUnit();
  const [form, setForm] = useState<UnitForm | null>(null);
  const set = <K extends keyof UnitForm>(key: K, value: UnitForm[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = () => {
    if (!form) return;
    if (!form.name.trim()) return toast(t('inventory.host.nameRequired'), 'error');
    const price = Number(form.basePriceTry);
    if (!(price > 0)) return toast(t('inventory.host.priceInvalid'), 'error');
    const existing = units.find((u) => u.id === form.id);
    upsert.mutate(
      {
        id: form.id,
        businessId,
        name: form.name,
        kind: form.kind,
        capacity: Number(form.capacity) || 1,
        quantity: Number(form.quantity) || 1,
        basePriceTry: price,
        weekendMultiplier: Number(form.weekendMultiplier.replace(',', '.')) || 1,
        seasons: existing?.seasons ?? [],
        amenities: form.amenities
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
      },
      {
        onSuccess: () => {
          setForm(null);
          toast(t('inventory.host.saved'), 'success');
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  if (error) return <ErrorState onRetry={onRetry} />;
  if (loading) return <Skeleton height={200} style={{ borderRadius: radius.xl }} />;

  return (
    <View style={{ gap: spacing.md }}>
      {form ? (
        <View
          style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text variant="h3">
            {form.id ? t('inventory.host.editUnit') : t('inventory.host.newUnit')}
          </Text>
          <Input
            label={t('inventory.host.unitName')}
            placeholder={t('inventory.host.unitNamePlaceholder')}
            value={form.name}
            onChangeText={(v) => set('name', v)}
          />
          <Text variant="caption" color="textMuted" style={{ marginLeft: spacing.xs }}>
            {t('inventory.host.unitKind')}
          </Text>
          <View style={styles.chips}>
            {UNIT_KINDS.map((k) => (
              <Chip
                key={k}
                size="sm"
                label={t(`inventory.unitKind.${k}`)}
                selected={form.kind === k}
                onPress={() => set('kind', k)}
              />
            ))}
          </View>
          <View style={styles.formRow}>
            <Input
              label={t('inventory.host.capacity')}
              keyboardType="number-pad"
              value={form.capacity}
              onChangeText={(v) => set('capacity', v)}
              containerStyle={{ flex: 1 }}
            />
            <Input
              label={t('inventory.host.quantity')}
              keyboardType="number-pad"
              value={form.quantity}
              onChangeText={(v) => set('quantity', v)}
              containerStyle={{ flex: 1 }}
            />
          </View>
          <View style={styles.formRow}>
            <Input
              label={t('inventory.host.basePrice')}
              keyboardType="number-pad"
              value={form.basePriceTry}
              onChangeText={(v) => set('basePriceTry', v)}
              containerStyle={{ flex: 1 }}
            />
            <Input
              label={t('inventory.host.weekendMultiplier')}
              keyboardType="decimal-pad"
              value={form.weekendMultiplier}
              onChangeText={(v) => set('weekendMultiplier', v)}
              containerStyle={{ flex: 1 }}
            />
          </View>
          <Input
            label={t('inventory.host.amenities')}
            value={form.amenities}
            onChangeText={(v) => set('amenities', v)}
          />
          <View style={styles.actions}>
            <Button
              label={t('common.cancel')}
              variant="secondary"
              onPress={() => setForm(null)}
              style={{ flex: 1 }}
            />
            <Button
              label={t('inventory.host.save')}
              icon="check"
              loading={upsert.isPending}
              disabled={!isOwner}
              onPress={save}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      ) : (
        <Button
          label={t('inventory.host.addUnit')}
          icon="plus"
          variant="secondary"
          disabled={!isOwner}
          onPress={() => setForm(emptyForm())}
        />
      )}
      {units.length === 0 ? (
        <EmptyState
          icon="tent"
          title={t('inventory.host.noUnits')}
          description={t('inventory.host.noUnitsDescription')}
          compact
        />
      ) : (
        units.map((u) => (
          <UnitCard
            key={u.id}
            unit={u}
            actionLabel={isOwner ? t('common.edit') : undefined}
            onPress={isOwner ? () => setForm(toForm(u)) : undefined}
          />
        ))
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Takvim                                                               */
/* ------------------------------------------------------------------ */

function CalendarTab({ units, isOwner }: { units: StayUnit[]; isOwner: boolean }) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const [today] = useState(() => msToDay(Date.now()));
  const [month, setMonth] = useState(() => monthStart(today));
  const [unitId, setUnitId] = useState<string | null>(null);
  const [from, setFrom] = useState<ISODate | null>(null);
  const [to, setTo] = useState<ISODate | null>(null);
  const selected = unitId ?? units[0]?.id ?? null;
  const availability = useAvailability(selected, month, shiftMonth(month, 1));
  const block = useBlockDates();

  const blockedDays = useMemo(
    () => (availability.data ?? []).filter((a) => a.available <= 0).map((a) => a.date),
    [availability.data],
  );

  const submit = () => {
    if (!selected || !from || !to) return;
    block.mutate(
      { unitId: selected, from, to },
      {
        onSuccess: () => {
          setFrom(null);
          setTo(null);
          toast(t('inventory.host.blocked'), 'success');
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  if (units.length === 0) {
    return <EmptyState icon="calendar-days" title={t('inventory.host.noUnits')} compact />;
  }

  return (
    <View style={{ gap: spacing.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.chips}>
          {units.map((u) => (
            <Chip
              key={u.id}
              size="sm"
              label={u.name}
              selected={selected === u.id}
              onPress={() => {
                setUnitId(u.id);
                setFrom(null);
                setTo(null);
              }}
            />
          ))}
        </View>
      </ScrollView>
      <AvailabilityCalendar
        month={month}
        onMonthChange={setMonth}
        availability={availability.data}
        loading={availability.isLoading}
        today={today}
        checkIn={from}
        checkOut={to}
        onChange={(a, b) => {
          setFrom(a);
          setTo(b);
        }}
      />
      <Text variant="caption" color="textMuted">
        {t('inventory.host.blockHint')}
      </Text>
      <Button
        label={t('inventory.host.blockDates')}
        icon="ban"
        variant="secondary"
        disabled={!isOwner || !from || !to}
        loading={block.isPending}
        onPress={submit}
      />
      <View
        style={[styles.blocks, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text variant="title">{t('inventory.host.blocks')}</Text>
        {blockedDays.length === 0 ? (
          <Text variant="caption" color="textSubtle">
            {t('inventory.host.noBlocks')}
          </Text>
        ) : (
          <View style={styles.chips}>
            {blockedDays.map((d) => (
              <Badge
                key={d}
                label={formatDate(`${d}T00:00:00`, locale, 'd MMM')}
                color={colors.danger}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Rezervasyonlar                                                       */
/* ------------------------------------------------------------------ */

function BookingsTab({
  bookings,
  loading,
  error,
  onRetry,
}: {
  bookings: BookingWithPayment[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  if (error) return <ErrorState onRetry={onRetry} />;
  if (loading) return <Skeleton height={160} style={{ borderRadius: radius.xl }} />;
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon="calendar-days"
        title={t('inventory.host.noBookings')}
        description={t('inventory.host.noBookingsDescription')}
        compact
      />
    );
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {bookings.map((b) => (
        <View
          key={b.id}
          style={[
            styles.bookingRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          accessibilityLabel={`${b.unit?.name ?? t('inventory.unit')} ${formatDate(b.checkIn, locale, 'd MMM')}`}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="bodySm" weight="bold" numberOfLines={1}>
              {b.unit?.name ?? t('inventory.unit')}
            </Text>
            <Text variant="caption" color="textMuted">
              {formatDate(b.checkIn, locale, 'd MMM')} → {formatDate(b.checkOut, locale, 'd MMM')} ·{' '}
              {t('inventory.guestsCount', { count: b.guests })}
            </Text>
            <View style={styles.chips}>
              <Badge
                label={t(`inventory.status.${b.status}`)}
                color={STAY_STATUS_COLOR[b.status]}
              />
              {b.payment ? (
                <Badge
                  label={t(`inventory.paymentStatus.${b.payment.status}`)}
                  color={PAYMENT_STATUS_COLOR[b.payment.status]}
                  icon="lock"
                />
              ) : null}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text variant="title" color="primary">
              {formatPriceTry(b.totalTry, locale)}
            </Text>
            <Button
              label={t('inventory.booking.details')}
              size="sm"
              variant="ghost"
              onPress={() => router.push({ pathname: '/stays/booking/[id]', params: { id: b.id } })}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Ödemeler                                                             */
/* ------------------------------------------------------------------ */

function PayoutsTab({ bookings, iban }: { bookings: BookingWithPayment[]; iban: string | null }) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const summary = useMemo(
    () =>
      payoutSummary(
        bookings,
        bookings.flatMap((b) => (b.payment ? [b.payment] : [])),
      ),
    [bookings],
  );
  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.tiles}>
        <StatTile
          icon="wallet"
          label={t('inventory.payout.pending')}
          value={formatPriceTry(summary.pendingTry, locale, false)}
          color={colors.warning}
          style={styles.tile}
        />
        <StatTile
          icon="circle-check"
          label={t('inventory.payout.paid')}
          value={formatPriceTry(summary.paidTry, locale, false)}
          color={colors.success}
          style={styles.tile}
        />
        <StatTile
          icon="percent"
          label={t('inventory.payout.commission')}
          value={formatPriceTry(summary.commissionTry, locale, false)}
          color={colors.info}
          style={styles.tile}
        />
        <StatTile
          icon="refresh-cw"
          label={t('inventory.payout.refunded')}
          value={formatPriceTry(summary.refundedTry, locale, false)}
          color={colors.danger}
          style={styles.tile}
        />
      </View>
      <View
        style={[styles.blocks, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.rowBetween}>
          <Text variant="caption" color="textMuted">
            {t('inventory.host.iban')}
          </Text>
          <Text variant="caption" color="textSubtle">
            {t('inventory.payout.count', { count: summary.count })}
          </Text>
        </View>
        <Text variant="bodySm" weight="bold" color={iban ? 'text' : 'textSubtle'}>
          {iban ?? t('inventory.host.ibanMissing')}
        </Text>
      </View>
      <View style={[styles.hint, { backgroundColor: colors.primarySoft }]}>
        <Icon name="shield-check" size={14} color={colors.primary} />
        <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
          {t('inventory.escrow.hint')}
        </Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Doğrulama & politika                                                 */
/* ------------------------------------------------------------------ */

function VerificationTab({
  businessId,
  level,
  policy,
  responseRatePct,
  responseTimeMin,
  isOwner,
}: {
  businessId: string;
  level: 'none' | 'id' | 'address' | 'premium';
  policy: CancellationPolicy;
  responseRatePct: number;
  responseTimeMin: number;
  isOwner: boolean;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const verify = useVerifyHost();
  const [policyPreview, setPolicyPreview] = useState<CancellationPolicy>(policy);

  return (
    <View style={{ gap: spacing.md }}>
      <HostVerificationSteps
        level={level}
        busy={verify.isPending}
        disabled={!isOwner}
        onVerify={(next) =>
          verify.mutate(
            { businessId, level: next },
            {
              onSuccess: () => toast(t('inventory.verification.upgraded'), 'success'),
              onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
            },
          )
        }
      />
      <View style={styles.tiles}>
        <StatTile
          icon="message-circle"
          label={t('inventory.host.responseRate')}
          value={`%${responseRatePct}`}
          style={styles.tile}
          compact
        />
        <StatTile
          icon="timer"
          label={t('inventory.host.responseTime')}
          value={`${responseTimeMin} ${t('common.min')}`}
          style={styles.tile}
          compact
        />
      </View>
      <View
        style={[styles.blocks, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text variant="title">{t('inventory.host.policy')}</Text>
        <SegmentedControl<CancellationPolicy>
          segments={CANCELLATION_POLICIES.map((p) => ({
            value: p,
            label: t(`inventory.policy.${p}`),
          }))}
          value={policyPreview}
          onChange={setPolicyPreview}
        />
        <PolicyBadge policy={policyPreview} description />
      </View>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1 }}>
      <Text variant="h3">{value}</Text>
      <Text variant="label" color="textSubtle">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  stats: { flexDirection: 'row', gap: spacing.sm },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  form: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  blocks: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
