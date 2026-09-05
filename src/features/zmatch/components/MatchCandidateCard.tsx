import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Avatar, Button, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact } from '@/core/utils/format';
import { ADVENTURE_TYPE_META, formatDistance, trustTier, type MatchCandidate } from '@/domain';

interface Props {
  candidate: MatchCandidate;
  onRequest: (candidate: MatchCandidate) => void;
}

const tierColors: Record<ReturnType<typeof trustTier>, string> = {
  low: '#FF8A5B',
  medium: '#FFB547',
  high: '#5EE39B',
  elite: '#6CB4FF',
};

export function MatchCandidateCard({ candidate, onRequest }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const router = useRouter();
  const { user } = candidate;
  const primaryType = user.favoriteTypes[0] ?? 'hiking';
  const tier = trustTier(user.trustScore);
  const alreadyRequested = candidate.existingMatch !== null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <AdventureImage uri={user.coverUrl} adventureType={primaryType} style={styles.cover} overlay>
        <View style={styles.distancePill}>
          <Icon name="navigation" size={12} color="#5EE39B" strokeWidth={2.6} />
          <Text variant="label" weight="extrabold" color="#F2F7F4">
            {formatDistance(candidate.distanceKm, locale).toLocaleUpperCase('tr-TR')}{' '}
            {t('zmatch.away').toLocaleUpperCase('tr-TR')}
          </Text>
        </View>
        <View style={[styles.trustPill, { backgroundColor: 'rgba(8,14,12,0.6)' }]}>
          <Icon name="shield-check" size={12} color={tierColors[tier]} strokeWidth={2.6} />
          <Text variant="label" weight="extrabold" color={tierColors[tier]}>
            {user.trustScore}
          </Text>
        </View>
      </AdventureImage>

      <View style={styles.body}>
        <Tappable
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
          haptic="selection"
          style={styles.userRow}
          accessibilityRole="button"
        >
          <View style={styles.avatarWrap}>
            <Avatar
              uri={user.avatarUrl}
              name={user.displayName}
              size={56}
              verified={user.isVerified}
              ring
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h3" numberOfLines={1}>
              {user.displayName}
            </Text>
            <View style={styles.metaRow}>
              <Icon name="map-pin" size={12} color={colors.textSubtle} />
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {user.locationName}
              </Text>
            </View>
          </View>
        </Tappable>

        <Text variant="bodySm" color="textMuted" numberOfLines={2}>
          {user.bio}
        </Text>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text variant="title" weight="extrabold">
              {user.totalAdventures}
            </Text>
            <Text variant="label" color="textSubtle">
              {t('profile.adventures').toLocaleUpperCase('tr-TR')}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text variant="title" weight="extrabold">
              {formatCompact(user.totalDistanceKm, locale)}
            </Text>
            <Text variant="label" color="textSubtle">
              KM
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={[styles.stat, { flex: 1.6 }]}>
            <View style={styles.typeRow}>
              {user.favoriteTypes.map((type) => {
                const meta = ADVENTURE_TYPE_META[type];
                const shared = candidate.sharedTypes.includes(type);
                return (
                  <View
                    key={type}
                    style={[
                      styles.typeDot,
                      {
                        backgroundColor: shared ? meta.color : meta.softColor,
                        borderColor: meta.color,
                      },
                    ]}
                    accessibilityLabel={t(meta.labelKey)}
                  >
                    <Icon
                      name={meta.icon}
                      size={12}
                      color={shared ? '#06120B' : meta.color}
                      strokeWidth={2.6}
                    />
                  </View>
                );
              })}
            </View>
            <Text variant="label" color="textSubtle">
              {candidate.sharedTypes.length}{' '}
              {t('zmatch.commonInterests').toLocaleUpperCase('tr-TR')}
            </Text>
          </View>
        </View>

        <Button
          label={alreadyRequested ? t('zmatch.requestSent') : t('zmatch.requestMatch')}
          icon={alreadyRequested ? 'check' : 'heart-handshake'}
          variant={alreadyRequested ? 'secondary' : 'primary'}
          disabled={alreadyRequested}
          fullWidth
          onPress={() => onRequest(candidate)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cover: { height: 120, width: '100%' },
  distancePill: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: 'rgba(8,14,12,0.6)',
  },
  trustPill: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 24,
    borderRadius: radius.full,
  },
  body: { padding: spacing.lg, paddingTop: 0, gap: spacing.md },
  userRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: -28 },
  avatarWrap: { borderRadius: 32, padding: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stat: { flex: 1, gap: 2 },
  divider: { width: StyleSheet.hairlineWidth, height: 28 },
  typeRow: { flexDirection: 'row', gap: 4 },
  typeDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
