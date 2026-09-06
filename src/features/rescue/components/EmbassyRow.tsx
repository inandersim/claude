import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { dialUrl, FOREIGN_MINISTRY_CALL_CENTER, type TurkishEmbassy } from '@/domain';

interface Props {
  embassy: TurkishEmbassy | null;
  /** Türkiye'deyken temsilcilik satırı anlamsızdır; yalnızca çağrı merkezi gösterilir. */
  home?: boolean;
}

function call(number: string) {
  Linking.openURL(dialUrl(number)).catch(() => undefined);
}

/** Türk büyükelçiliği + Dışişleri Konsolosluk Çağrı Merkezi satırları. */
export function EmbassyRow({ embassy, home = false }: Props) {
  const { t } = useT();
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {!home ? (
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
            <Icon name="landmark" size={18} color={colors.primary} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">
              {embassy ? t('rescue.embassyCity', { city: embassy.city }) : t('rescue.embassy')}
            </Text>
            <Text variant="caption" color="textMuted">
              {embassy ? embassy.phone : t('rescue.embassyUnknown')}
            </Text>
          </View>
          {embassy ? (
            <Button
              label={t('rescue.call')}
              icon="phone"
              size="sm"
              variant="secondary"
              onPress={() => call(embassy.phone)}
              accessibilityLabel={`${t('rescue.call')} ${embassy.city} ${embassy.phone}`}
            />
          ) : null}
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.infoSoft }]}>
          <Icon name="phone" size={18} color={colors.info} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{t('rescue.foreignMinistryLine')}</Text>
          <Text variant="caption" color="textMuted">
            {FOREIGN_MINISTRY_CALL_CENTER}
          </Text>
        </View>
        <Button
          label={t('rescue.call')}
          icon="phone"
          size="sm"
          variant="secondary"
          onPress={() => call(FOREIGN_MINISTRY_CALL_CENTER)}
          accessibilityLabel={`${t('rescue.call')} ${t('rescue.foreignMinistryLine')}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm + 2,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
