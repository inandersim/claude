import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { DOCTOR_DISCLAIMER } from '@/domain';

/** "Tele-tıp acil servisin yerini tutmaz" uyarısı; her tele-tıp ekranının üstünde. */
export function DisclaimerBanner({ compact = false }: { compact?: boolean }) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.warningSoft, borderColor: colors.warning },
        compact && styles.compact,
      ]}
      accessibilityRole="alert"
    >
      <Icon name="triangle-alert" size={compact ? 16 : 20} color={colors.warning} />
      <View style={{ flex: 1, gap: 2 }}>
        {compact ? null : (
          <Text variant="label" weight="bold" color={colors.warning}>
            {t('telemed.banner.title')}
          </Text>
        )}
        <Text variant={compact ? 'caption' : 'bodySm'} color="text">
          {t(DOCTOR_DISCLAIMER)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  compact: { paddingVertical: spacing.sm },
});
