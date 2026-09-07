import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { AdventureImage, Icon, Tappable, Text } from '@/components/ui';
import { useT } from '@/core/i18n';
import { radius, spacing, useTheme } from '@/core/theme';
import { formatCompact, initials } from '@/core/utils/format';
import { ADVENTURE_TYPE_META, type ClubWithMembership } from '@/domain';

/**
 * Kulüp kartı: kapak, logo/baş harfler, üniversite, şehir, tür ikonları,
 * üye sayısı, doğrulanma rozeti ve üyelik durumu chip'i.
 */
export function ClubCard({
  club,
  compact = false,
}: {
  club: ClubWithMembership;
  compact?: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useT();
  const { colors } = useTheme();

  const membershipLabel =
    club.membership === 'member'
      ? club.role && club.role !== 'member'
        ? t(`clubs.role.${club.role}`)
        : t('clubs.member')
      : club.membership === 'requested'
        ? t('clubs.requested')
        : null;
  const membershipColor = club.membership === 'member' ? colors.success : colors.warning;

  return (
    <Tappable
      onPress={() => router.push({ pathname: '/clubs/[id]', params: { id: club.id } })}
      scaleTo={0.97}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel={`${club.name}, ${club.university}`}
    >
      {!compact ? (
        <AdventureImage
          uri={club.coverUrl}
          kucuk
          adventureType={club.adventureTypes[0] ?? 'hiking'}
          style={styles.cover}
          overlay
        >
          <View style={styles.coverTop}>
            {club.isVerified ? (
              <View style={[styles.pill, { backgroundColor: 'rgba(8,14,12,0.6)' }]}>
                <Icon name="badge-check" size={12} color="#7BE495" strokeWidth={2.4} />
                <Text variant="label" weight="extrabold" color="#F2F7F4">
                  {t('clubs.verifiedShort').toLocaleUpperCase(locale)}
                </Text>
              </View>
            ) : (
              <View />
            )}
            {membershipLabel ? (
              <View style={[styles.pill, { backgroundColor: membershipColor }]}>
                <Text variant="label" weight="extrabold" color="#0B1410">
                  {membershipLabel.toLocaleUpperCase(locale)}
                </Text>
              </View>
            ) : null}
          </View>
        </AdventureImage>
      ) : null}
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={[styles.logo, { backgroundColor: colors.primarySoft }]}>
            <Text variant="title" weight="extrabold" color="primary">
              {initials(club.university)}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title" numberOfLines={2}>
              {club.name}
            </Text>
            <View style={styles.metaRow}>
              <Icon name="school" size={12} color={colors.textSubtle} />
              <Text variant="caption" color="textMuted" numberOfLines={1} style={{ flexShrink: 1 }}>
                {club.university} · {club.city}
              </Text>
            </View>
          </View>
          {compact && membershipLabel ? (
            <View style={[styles.chip, { backgroundColor: membershipColor }]}>
              <Text variant="label" weight="extrabold" color="#0B1410">
                {membershipLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.foot}>
          <View style={styles.types}>
            {club.adventureTypes.map((type) => (
              <View
                key={type}
                style={[styles.typeDot, { backgroundColor: ADVENTURE_TYPE_META[type].softColor }]}
                accessibilityLabel={t(ADVENTURE_TYPE_META[type].labelKey)}
              >
                <Icon
                  name={ADVENTURE_TYPE_META[type].icon}
                  size={13}
                  color={ADVENTURE_TYPE_META[type].color}
                  strokeWidth={2.4}
                />
              </View>
            ))}
          </View>
          <View style={styles.metaRow}>
            <Icon name="users" size={13} color={colors.textSubtle} />
            <Text variant="caption" weight="bold" color="textMuted">
              {t('clubs.memberCount', { count: formatCompact(club.memberCount, locale) })}
            </Text>
            {club.upcomingEventCount > 0 ? (
              <>
                <Text variant="caption" color="textSubtle">
                  ·
                </Text>
                <Icon name="calendar" size={13} color={colors.primary} />
                <Text variant="caption" weight="bold" color="primary">
                  {club.upcomingEventCount}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  cover: { width: '100%', height: 120 },
  coverTop: {
    position: 'absolute',
    top: spacing.sm + 2,
    left: spacing.sm + 2,
    right: spacing.sm + 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    height: 22,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: spacing.md, gap: spacing.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  types: { flexDirection: 'row', gap: 4 },
  typeDot: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
