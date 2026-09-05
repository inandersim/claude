import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Badge, Button, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatDate, formatRelative } from '@/core/utils/time';
import {
  ADVENTURE_TYPE_META,
  MATCH_STATUS_META,
  otherPartyId,
  type ZMatchWithUsers,
} from '@/domain';

interface Props {
  match: ZMatchWithUsers;
  meId: string;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  busy?: boolean;
}

export function MatchRequestCard({ match, meId, onAccept, onReject, busy }: Props) {
  const { colors } = useTheme();
  const { t, locale } = useT();
  const router = useRouter();
  const incoming = match.receiverId === meId;
  const other = incoming ? match.requester : match.receiver;
  const meta = ADVENTURE_TYPE_META[match.adventureType];
  const status = MATCH_STATUS_META[match.status];

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/match/[id]', params: { id: match.id } })}
      scaleTo={0.985}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
    >
      <View style={styles.head}>
        <Avatar
          uri={other.avatarUrl}
          name={other.displayName}
          size={46}
          verified={other.isVerified}
        />
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={1}>
            {other.displayName}
          </Text>
          <Text variant="caption" color="textMuted">
            {incoming ? t('zmatch.incoming') : t('zmatch.outgoing')} ·{' '}
            {formatRelative(match.createdAt, new Date(), locale)}
          </Text>
        </View>
        <Badge label={t(status.labelKey)} color={status.color} />
      </View>

      {match.message ? (
        <View
          style={[
            styles.quote,
            { backgroundColor: colors.surfaceMuted, borderLeftColor: meta.color },
          ]}
        >
          <Text variant="bodySm" numberOfLines={3}>
            “{match.message}”
          </Text>
        </View>
      ) : null}

      <View style={styles.details}>
        <View style={[styles.detail, { backgroundColor: meta.softColor }]}>
          <Icon name={meta.icon} size={13} color={meta.color} strokeWidth={2.6} />
          <Text variant="caption" weight="bold" color={meta.color}>
            {t(meta.labelKey)}
          </Text>
        </View>
        {match.locationName ? (
          <View style={styles.detail}>
            <Icon name="map-pin" size={13} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {match.locationName}
            </Text>
          </View>
        ) : null}
        {match.plannedDate ? (
          <View style={styles.detail}>
            <Icon name="calendar" size={13} color={colors.textSubtle} />
            <Text variant="caption" color="textMuted">
              {formatDate(match.plannedDate, locale, 'd MMM')}
            </Text>
          </View>
        ) : null}
      </View>

      {incoming && match.status === 'pending' && onAccept && onReject ? (
        <View style={styles.actions}>
          <Button
            label={t('zmatch.reject')}
            variant="secondary"
            icon="x"
            style={{ flex: 1 }}
            onPress={() => onReject(match.id)}
            disabled={busy}
          />
          <Button
            label={t('zmatch.accept')}
            variant="primary"
            icon="check"
            style={{ flex: 1.4 }}
            onPress={() => onAccept(match.id)}
            loading={busy}
          />
        </View>
      ) : null}
      {match.status === 'accepted' ? (
        <Button
          label={t('zmatch.message')}
          variant="secondary"
          icon="message-circle"
          size="sm"
          onPress={() =>
            router.push({
              pathname: '/chat/[id]',
              params: { id: otherPartyId(match, meId), matchId: match.id },
            })
          }
        />
      ) : null}
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quote: { padding: spacing.md, borderRadius: radius.md, borderLeftWidth: 3 },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 26,
    borderRadius: radius.full,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
