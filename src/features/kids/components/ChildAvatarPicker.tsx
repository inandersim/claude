import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { CHILD_AVATARS } from '@/domain';

interface Props {
  value: string;
  onChange: (avatar: string) => void;
}

/** 8 emoji avatar seçici. */
export function ChildAvatarPicker({ value, onChange }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text variant="label" color="textSubtle">
        {t('kids.child.avatar').toLocaleUpperCase('tr-TR')}
      </Text>
      <View style={styles.row}>
        {CHILD_AVATARS.map((a) => {
          const selected = a === value;
          return (
            <Tappable
              key={a}
              onPress={() => onChange(a)}
              haptic="selection"
              accessibilityRole="button"
              accessibilityLabel={`${t('kids.child.avatar')} ${a}`}
              accessibilityState={{ selected }}
              style={[
                styles.cell,
                {
                  backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text style={styles.emoji}>{a}</Text>
            </Tappable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 26, lineHeight: 32 },
});
