import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Icon, Tappable, Text, type IconName } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { DeterrentProfile, DeterrentSound } from '@/domain';
import { soundMeta } from '@/domain';

const SOUND_ICONS: Record<DeterrentSound, IconName> = {
  air_horn: 'siren',
  siren: 'radio',
  whistle: 'wind',
  shout: 'mic',
  clap: 'handshake',
  metal_clang: 'hexagon',
  ultrasonic: 'signal',
  stomp: 'footprints',
};

export interface SoundPickerProps {
  sounds: DeterrentProfile['sounds'];
  value: DeterrentSound;
  onChange: (sound: DeterrentSound) => void;
  disabled?: boolean;
}

/** Yatay kaydırılabilir ses kartları: ad, süre, etkinlik barı ve not. */
export function SoundPicker({ sounds, value, onChange, disabled = false }: SoundPickerProps) {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {sounds.map((s) => {
        const meta = soundMeta(s.sound);
        const selected = s.sound === value;
        const pct = Math.round(s.effectiveness * 100);
        return (
          <Tappable
            key={s.sound}
            onPress={() => onChange(s.sound)}
            disabled={disabled}
            style={[
              styles.card,
              {
                backgroundColor: selected ? colors.primarySoft : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`${t(meta.labelKey)}, ${t('wildlife.panic.effectiveness')} ${pct}%`}
          >
            <View style={styles.head}>
              <Icon
                name={SOUND_ICONS[s.sound]}
                size={18}
                color={selected ? colors.primary : colors.text}
              />
              <Text variant="bodySm" weight="bold" numberOfLines={1} style={styles.flex}>
                {t(meta.labelKey)}
              </Text>
              <Text variant="caption" color="textMuted">
                {t('wildlife.panic.duration', { seconds: meta.durationS })}
              </Text>
            </View>
            <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${pct}%`,
                    backgroundColor:
                      pct >= 60 ? colors.success : pct >= 40 ? colors.warning : colors.textSubtle,
                  },
                ]}
              />
            </View>
            <Text variant="caption" color="textMuted" numberOfLines={3}>
              {s.note}
            </Text>
          </Tappable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  card: {
    width: 200,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    gap: spacing.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  bar: { height: 5, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
});
