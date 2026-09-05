import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Avatar, Badge, Icon, IconButton, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import { formatDistance, mapsUrl, type LocationShareWithUser } from '@/domain';

export function ShareCard({ share }: { share: LocationShareWithUser }) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const sos = share.mode === 'sos';
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: sos ? colors.dangerSoft : colors.surface,
          borderColor: sos ? colors.danger : colors.border,
        },
      ]}
    >
      <Tappable
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: share.userId } })}
        haptic="selection"
        style={styles.head}
        accessibilityRole="button"
      >
        <Avatar
          uri={share.user.avatarUrl}
          name={share.user.displayName}
          size={44}
          verified={share.user.isVerified}
          ring={sos}
        />
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={1}>
            {share.user.displayName}
          </Text>
          <Text variant="caption" color={share.isStale ? 'accent' : 'textMuted'}>
            {t('presence.lastUpdate')}: {formatRelative(share.updatedAt, new Date(), locale)}
            {share.isStale ? ` · ${t('presence.stale')}` : ''}
          </Text>
        </View>
        {sos ? <Badge label="SOS" color={colors.danger} icon="siren" soft={false} /> : null}
      </Tappable>
      <View style={styles.stats}>
        {share.distanceKm !== null ? (
          <View style={styles.stat}>
            <Icon name="navigation" size={13} color={colors.textSubtle} />
            <Text variant="caption" weight="bold">
              {formatDistance(share.distanceKm, locale)}
            </Text>
          </View>
        ) : null}
        {share.altitudeM !== null ? (
          <View style={styles.stat}>
            <Icon name="mountain-snow" size={13} color={colors.textSubtle} />
            <Text variant="caption" weight="bold">
              {Math.round(share.altitudeM)} m
            </Text>
          </View>
        ) : null}
        {share.speedKmh !== null ? (
          <View style={styles.stat}>
            <Icon name="gauge" size={13} color={colors.textSubtle} />
            <Text variant="caption" weight="bold">
              {share.speedKmh} km/s
            </Text>
          </View>
        ) : null}
        {share.batteryPct !== null ? (
          <View style={styles.stat}>
            <Icon
              name="zap"
              size={13}
              color={share.batteryPct < 25 ? colors.danger : colors.textSubtle}
            />
            <Text variant="caption" weight="bold" color={share.batteryPct < 25 ? 'danger' : 'text'}>
              %{share.batteryPct}
            </Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }} />
        <IconButton
          icon="map"
          size={34}
          iconSize={16}
          onPress={() =>
            Linking.openURL(
              mapsUrl(share.coords.latitude, share.coords.longitude, share.user.displayName),
            )
          }
          accessibilityLabel={t('presence.open')}
        />
        <IconButton
          icon="message-circle"
          size={34}
          iconSize={16}
          onPress={() =>
            router.push({ pathname: '/chat/[id]', params: { id: share.userId, matchId: '' } })
          }
          accessibilityLabel={t('zmatch.message')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
