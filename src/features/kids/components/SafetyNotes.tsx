import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { KID_SAFETY_LEVEL_META, kidSafetyLevel, type KidPlace } from '@/domain';

interface Props {
  place: Pick<KidPlace, 'safetyNotes'>;
}

/** Güvenlik seviyesi başlığı + madde madde notlar. */
export function SafetyNotes({ place }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const level = kidSafetyLevel(place);
  const meta = KID_SAFETY_LEVEL_META[level];
  const color =
    meta.tone === 'success'
      ? colors.success
      : meta.tone === 'warning'
        ? colors.warning
        : colors.danger;
  const soft =
    meta.tone === 'success'
      ? colors.successSoft
      : meta.tone === 'warning'
        ? colors.warningSoft
        : colors.dangerSoft;

  return (
    <View style={[styles.root, { backgroundColor: soft, borderColor: color }]}>
      <View style={styles.head}>
        <Icon name={meta.icon as IconName} size={20} color={color} strokeWidth={2.4} />
        <View style={{ flex: 1 }}>
          <Text variant="title" weight="extrabold">
            {t('kids.safety.title')} · {t(meta.labelKey)}
          </Text>
          <Text variant="caption" color="textMuted">
            {t(meta.hintKey)}
          </Text>
        </View>
      </View>
      {place.safetyNotes.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          {place.safetyNotes.map((note) => (
            <View key={note} style={styles.row}>
              <Icon name="circle-alert" size={14} color={color} strokeWidth={2.4} />
              <Text variant="bodySm" style={{ flex: 1 }}>
                {note}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingTop: 2 },
});
