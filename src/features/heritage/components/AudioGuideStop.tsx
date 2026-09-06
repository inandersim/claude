import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import type { AudioGuideStop } from '@/domain';

interface Props {
  stop: AudioGuideStop;
  active?: boolean;
  speaking?: boolean;
  onRead: () => void;
  onStop: () => void;
}

/** Sesli rehber durağı: numara, başlık, metin ve Oku/Durdur. */
export function AudioGuideStopCard({
  stop,
  active = false,
  speaking = false,
  onRead,
  onStop,
}: Props) {
  const { colors } = useTheme();
  const { t } = useT();
  const min = Math.max(1, Math.round(stop.durationSec / 60));
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.surface,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
      accessibilityLabel={`${stop.order}. ${stop.title}`}
    >
      <View style={styles.head}>
        <View
          style={[styles.num, { backgroundColor: active ? colors.primary : colors.surfaceMuted }]}
        >
          <Text variant="label" weight="extrabold" color={active ? colors.onPrimary : 'textMuted'}>
            {stop.order}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" numberOfLines={2}>
            {stop.title}
          </Text>
          <View style={styles.metaRow}>
            <Icon name="clock" size={12} color={colors.textSubtle} />
            <Text variant="caption" color="textSubtle">
              {min} dk
            </Text>
            {stop.coords ? (
              <>
                <Icon name="map-pin" size={12} color={colors.textSubtle} />
                <Text variant="caption" color="textSubtle">
                  {stop.coords.latitude.toFixed(4)}, {stop.coords.longitude.toFixed(4)}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
      <Text variant="body" color="textMuted">
        {stop.script}
      </Text>
      <View style={styles.actions}>
        {speaking ? (
          <Button
            label={t('heritage.stop')}
            icon="pause"
            variant="secondary"
            size="sm"
            onPress={onStop}
          />
        ) : (
          <Button
            label={t('heritage.read')}
            icon="play"
            variant="primary"
            size="sm"
            onPress={onRead}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
});
