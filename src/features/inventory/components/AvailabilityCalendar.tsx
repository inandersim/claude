import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, IconButton, Skeleton, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { formatDate } from '@/core/utils/time';
import { addDays, dayToMs, eachNight, msToDay, type Availability, type ISODate } from '@/domain';

export interface AvailabilityCalendarProps {
  /** Görüntülenen ayın ilk günü ("YYYY-MM-01") */
  month: ISODate;
  onMonthChange: (month: ISODate) => void;
  /** Ay aralığındaki müsaitlik (gün anahtarı → adet/fiyat) */
  availability: Availability[] | undefined;
  loading?: boolean;
  /** Bugünün gün anahtarı (render dışında hesaplanır) */
  today: ISODate;
  checkIn: ISODate | null;
  checkOut: ISODate | null;
  onChange: (checkIn: ISODate | null, checkOut: ISODate | null) => void;
  /** Geçmiş günlerin seçilebilmesine izin ver (host takvimi) */
  allowPast?: boolean;
}

/** Ayın ilk gününü döner. */
export function monthStart(day: ISODate): ISODate {
  return `${day.slice(0, 7)}-01`;
}

/** n ay sonrası/öncesinin ilk günü. */
export function shiftMonth(month: ISODate, n: number): ISODate {
  const d = new Date(dayToMs(month));
  return msToDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

/** Aralık seçimi: ay görünümü, gece fiyatları, dolu günler çizgili. */
export function AvailabilityCalendar({
  month,
  onMonthChange,
  availability,
  loading = false,
  today,
  checkIn,
  checkOut,
  onChange,
  allowPast = false,
}: AvailabilityCalendarProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();

  const byDay = useMemo(() => {
    const map = new Map<string, Availability>();
    for (const a of availability ?? []) map.set(a.date, a);
    return map;
  }, [availability]);

  const cells = useMemo(() => {
    const first = new Date(dayToMs(month));
    const offset = (first.getUTCDay() + 6) % 7; // Pazartesi başlangıç
    const daysInMonth = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const list: (ISODate | null)[] = [];
    for (let i = 0; i < offset; i += 1) list.push(null);
    for (let d = 0; d < daysInMonth; d += 1) list.push(addDays(month, d));
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [month]);

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        formatDate(`2024-01-0${i + 1}T00:00:00`, locale, 'EEEEEE'),
      ),
    [locale],
  );

  const select = (day: ISODate) => {
    if (!checkIn || (checkIn && checkOut)) {
      onChange(day, null);
      return;
    }
    if (day <= checkIn) {
      onChange(day, null);
      return;
    }
    // Aradaki gecelerden biri doluysa yeni giriş günü olarak başla
    const blocked = eachNight(checkIn, day).some((n) => {
      const a = byDay.get(n);
      return a !== undefined && a.available <= 0;
    });
    if (blocked) onChange(day, null);
    else onChange(checkIn, day);
  };

  const hint = !checkIn
    ? t('inventory.calendar.checkInHint')
    : !checkOut
      ? t('inventory.calendar.checkOutHint')
      : t('inventory.calendar.selected', {
          checkIn: formatDate(`${checkIn}T00:00:00`, locale, 'd MMM'),
          checkOut: formatDate(`${checkOut}T00:00:00`, locale, 'd MMM'),
        });

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <IconButton
          icon="chevron-left"
          variant="ghost"
          size={32}
          onPress={() => onMonthChange(shiftMonth(month, -1))}
          accessibilityLabel={t('inventory.calendar.prev')}
        />
        <Text variant="title" style={{ flex: 1 }} align="center">
          {formatDate(`${month}T00:00:00`, locale, 'LLLL yyyy')}
        </Text>
        <IconButton
          icon="chevron-right"
          variant="ghost"
          size={32}
          onPress={() => onMonthChange(shiftMonth(month, 1))}
          accessibilityLabel={t('inventory.calendar.next')}
        />
      </View>

      <View style={styles.weekRow}>
        {weekdays.map((w, i) => (
          <Text
            key={`${w}-${i}`}
            variant="label"
            color="textSubtle"
            align="center"
            style={styles.cell}
          >
            {w.toLocaleUpperCase(locale === 'tr' ? 'tr-TR' : 'en-US')}
          </Text>
        ))}
      </View>

      {loading && !availability ? (
        <Skeleton height={220} style={{ borderRadius: radius.md }} />
      ) : (
        <View style={styles.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={`e${i}`} style={styles.cell} />;
            const a = byDay.get(day);
            const past = !allowPast && day < today;
            const full = a !== undefined && a.available <= 0;
            const disabled =
              past || (full && !checkIn) || (full && checkIn !== null && checkOut !== null);
            const isIn = day === checkIn;
            const isOut = day === checkOut;
            const inRange =
              checkIn !== null && checkOut !== null && day > checkIn && day < checkOut;
            const edge = isIn || isOut;
            return (
              <Tappable
                key={day}
                onPress={() => select(day)}
                disabled={disabled}
                haptic="selection"
                accessibilityRole="button"
                accessibilityLabel={formatDate(`${day}T00:00:00`, locale, 'd MMMM')}
                accessibilityState={{ disabled, selected: edge }}
                style={[
                  styles.cell,
                  styles.day,
                  inRange ? { backgroundColor: colors.primarySoft } : null,
                  edge ? { backgroundColor: colors.primary } : null,
                  day === today && !edge ? { borderColor: colors.primary, borderWidth: 1 } : null,
                ]}
              >
                <Text
                  variant="bodySm"
                  weight={edge ? 'extrabold' : 'semibold'}
                  color={edge ? colors.onPrimary : past ? colors.textSubtle : colors.text}
                  style={full && !edge ? styles.strike : null}
                >
                  {Number(day.slice(8, 10))}
                </Text>
                {a && !past ? (
                  <Text
                    variant="label"
                    color={edge ? colors.onPrimary : full ? colors.textSubtle : colors.textMuted}
                    style={[styles.price, full && !edge ? styles.strike : null]}
                  >
                    {full ? '—' : formatCompact(a.priceTry, locale)}
                  </Text>
                ) : (
                  <View style={styles.price} />
                )}
              </Tappable>
            );
          })}
        </View>
      )}

      <View style={styles.footer}>
        <Icon name="calendar-days" size={14} color={colors.primary} />
        <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
          {hint}
        </Text>
        {checkIn ? (
          <Tappable
            onPress={() => onChange(null, null)}
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel={t('inventory.calendar.clear')}
          >
            <Text variant="caption" weight="bold" color="primary">
              {t('inventory.calendar.clear')}
            </Text>
          </Tappable>
        ) : null}
      </View>
      <View style={styles.legend}>
        <LegendDot color={colors.primary} label={t('inventory.calendar.legendSelected')} />
        <LegendDot color={colors.textSubtle} label={t('inventory.calendar.legendBooked')} strike />
        <LegendDot color={colors.textMuted} label={t('inventory.calendar.legendPrice')} />
      </View>
    </View>
  );
}

function LegendDot({ color, label, strike }: { color: string; label: string; strike?: boolean }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text variant="label" color="textSubtle" style={strike ? styles.strike : null}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weekRow: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%` },
  day: {
    aspectRatio: 0.92,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    gap: 1,
  },
  price: { fontSize: 9, lineHeight: 11, minHeight: 11 },
  strike: { textDecorationLine: 'line-through' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
