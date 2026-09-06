import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/core/theme';
import type { IconName } from '@/components/ui/Icon';

interface Props {
  rules: string[];
}

/** Kural metnine göre ikon seçer (drone, dokunma, kazı, giyim, su…). */
function ruleIcon(rule: string): IconName {
  const r = rule.toLocaleLowerCase('tr-TR');
  if (r.includes('drone')) return 'ban';
  if (r.includes('dokun') || r.includes('tırman') || r.includes('yaslan')) return 'shield-alert';
  if (r.includes('kazı') || r.includes('şerit')) return 'construction';
  if (r.includes('kıyafet') || r.includes('omuz')) return 'shirt';
  if (r.includes('su ') || r.includes('litre') || r.includes(' l ')) return 'droplets';
  if (r.includes('ateş') || r.includes('mangal')) return 'flame';
  if (r.includes('fotoğraf') || r.includes('flaş') || r.includes('kamera')) return 'camera-off';
  if (r.includes('bilet') || r.includes('rehber')) return 'ticket';
  return 'info';
}

/** Ziyaret kuralları listesi. */
export function RulesList({ rules }: Props) {
  const { colors } = useTheme();
  if (rules.length === 0) return null;
  return (
    <View style={[styles.root, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {rules.map((rule) => (
        <View key={rule} style={styles.row}>
          <Icon name={ruleIcon(rule)} size={15} color={colors.warning} />
          <Text variant="bodySm" style={{ flex: 1 }}>
            {rule}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
