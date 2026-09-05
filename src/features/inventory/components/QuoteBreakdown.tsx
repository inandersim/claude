import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate } from '@/core/utils/time';
import { formatPriceTry, isWeekendNight, type Quote } from '@/domain';

export interface QuoteBreakdownProps {
  quote: Quote;
  /** Depozito satırını göster (rezervasyon öncesi) */
  showDeposit?: boolean;
}

/** Gecelik kırılım + ara toplam + platform ücreti + toplam (+ depozito). */
export function QuoteBreakdown({ quote, showDeposit = false }: QuoteBreakdownProps) {
  const { t, locale } = useT();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="h3">{t('inventory.quote.title')}</Text>

      <Tappable
        onPress={() => setOpen((v) => !v)}
        haptic="selection"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.row}
      >
        <Text variant="bodySm" color="textMuted" style={{ flex: 1 }}>
          {t('inventory.quote.nightly')} · {t('inventory.nights', { count: quote.nights })}
        </Text>
        <Text variant="bodySm" weight="bold">
          {formatPriceTry(quote.subtotalTry, locale)}
        </Text>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} color={colors.textSubtle} />
      </Tappable>
      {open ? (
        <View style={[styles.nightly, { borderColor: colors.border }]}>
          {quote.nightly.map((n) => (
            <View key={n.date} style={styles.row}>
              <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                {formatDate(`${n.date}T00:00:00`, locale, 'EEE d MMM')}
                {isWeekendNight(n.date) ? ` · ${t('inventory.quote.weekend')}` : ''}
              </Text>
              <Text variant="caption" weight="bold">
                {formatPriceTry(n.priceTry, locale)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Row
        label={t('inventory.quote.subtotal')}
        value={formatPriceTry(quote.subtotalTry, locale)}
      />
      <Row
        label={t('inventory.quote.platformFee')}
        value={formatPriceTry(quote.platformFeeTry, locale)}
      />
      <View style={[styles.total, { borderTopColor: colors.border }]}>
        <Text variant="title">{t('inventory.quote.total')}</Text>
        <Text variant="h2" color="primary">
          {formatPriceTry(quote.totalTry, locale)}
        </Text>
      </View>
      {showDeposit ? (
        <View style={[styles.deposit, { backgroundColor: colors.primarySoft }]}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" weight="bold">
              {t('inventory.quote.deposit')}
            </Text>
            <Text variant="label" color="textMuted">
              {t('inventory.quote.depositHint')}
            </Text>
          </View>
          <Text variant="title" color="primary">
            {formatPriceTry(quote.depositTry, locale)}
          </Text>
        </View>
      ) : null}
      {!quote.available ? (
        <View style={[styles.deposit, { backgroundColor: colors.dangerSoft }]}>
          <Icon name="triangle-alert" size={14} color={colors.danger} />
          <Text variant="caption" color="danger" style={{ flex: 1 }}>
            {t('inventory.quote.unavailable')}
          </Text>
        </View>
      ) : null}
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
  root: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nightly: {
    gap: spacing.xs,
    paddingLeft: spacing.md,
    borderLeftWidth: 2,
    marginBottom: spacing.xs,
  },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deposit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
