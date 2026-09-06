import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Avatar, Icon, ProgressRing, Text } from '@/components/ui';
import { currentLocale, useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { formatDate } from '@/core/utils/time';
import { ADVENTURE_TYPE_META, trustTier, type User } from '@/domain';

const tierColors = {
  low: '#FF8A5B',
  medium: '#FFB547',
  high: '#5EE39B',
  elite: '#6CB4FF',
} as const;

export function ProfileHeader({ user, actions }: { user: User; actions?: React.ReactNode }) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const tier = trustTier(user.trustScore);
  const primaryType = user.favoriteTypes[0] ?? 'hiking';

  return (
    <View>
      <AdventureImage
        uri={user.coverUrl}
        adventureType={primaryType}
        style={styles.cover}
        overlay
      />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View
            style={[
              styles.avatarRing,
              { borderColor: colors.background, backgroundColor: colors.background },
            ]}
          >
            <Avatar
              uri={user.avatarUrl}
              name={user.displayName}
              size={88}
              verified={user.isVerified}
            />
          </View>
          <View style={styles.actions}>{actions}</View>
        </View>

        <View style={{ gap: 2 }}>
          <Text variant="h2">{user.displayName}</Text>
          <View style={styles.metaRow}>
            <Text variant="bodySm" color="textMuted">
              @{user.username}
            </Text>
            <Text variant="bodySm" color="textSubtle">
              ·
            </Text>
            <Icon name="map-pin" size={12} color={colors.textSubtle} />
            <Text variant="bodySm" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {user.locationName}
            </Text>
          </View>
        </View>

        {user.bio ? <Text variant="body">{user.bio}</Text> : null}

        <View style={styles.types}>
          {user.favoriteTypes.map((type) => {
            const meta = ADVENTURE_TYPE_META[type];
            return (
              <View key={type} style={[styles.typeChip, { backgroundColor: meta.softColor }]}>
                <Icon name={meta.icon} size={13} color={meta.color} strokeWidth={2.6} />
                <Text variant="caption" weight="bold" color={meta.color}>
                  {t(meta.labelKey)}
                </Text>
              </View>
            );
          })}
        </View>

        <View
          style={[
            styles.statsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.statsRow}>
            <Stat
              value={formatCompact(user.followersCount, locale)}
              label={t('profile.followers')}
            />
            <Stat
              value={formatCompact(user.followingCount, locale)}
              label={t('profile.following')}
            />
            <Stat value={user.totalAdventures.toString()} label={t('profile.adventures')} />
            <Stat
              value={formatCompact(user.totalDistanceKm, locale)}
              label={t('profile.totalDistance')}
            />
          </View>
          <View style={[styles.trustRow, { borderTopColor: colors.border }]}>
            <ProgressRing
              value={user.trustScore}
              size={58}
              strokeWidth={5}
              color={tierColors[tier]}
            >
              <Text variant="title" weight="extrabold">
                {user.trustScore}
              </Text>
            </ProgressRing>
            <View style={{ flex: 1 }}>
              <View style={styles.trustTitle}>
                <Icon name="shield-check" size={15} color={tierColors[tier]} strokeWidth={2.6} />
                <Text variant="title">{t('profile.trustScore')}</Text>
              </View>
              <Text variant="caption" color="textMuted">
                {t('profile.trustScoreDescription')}
              </Text>
            </View>
          </View>
        </View>

        <Text variant="caption" color="textSubtle">
          {t('profile.memberSince')}: {formatDate(user.joinedAt, locale, 'MMMM yyyy')}
        </Text>
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="h3">{value}</Text>
      <Text variant="label" color="textSubtle">
        {label.toLocaleUpperCase(currentLocale())}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: 170, width: '100%' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: -44 },
  topRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  avatarRing: { borderWidth: 4, borderRadius: 52, padding: 0 },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    height: 28,
    borderRadius: radius.full,
  },
  statsCard: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  statsRow: { flexDirection: 'row', paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  trustTitle: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
});
