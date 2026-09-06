import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AdventureImage,
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@/components/ui';
import { useLocation } from '@/core/hooks/useLocation';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import { formatRelative } from '@/core/utils/time';
import { ADVENTURE_TYPE_META, formatDistance, formatPriceTry } from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { RatingStars } from '@/features/instructors/components/RatingStars';
import { useInstructor, useInstructorReviews } from '@/features/instructors/hooks';
import { StreamCard } from '@/features/live/components/StreamCard';
import { useStreams } from '@/features/live/hooks';
import { ListingCard } from '@/features/market/components/ListingCard';
import { useListings } from '@/features/market/hooks';

const DAY_LABELS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const DAY_LABELS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function InstructorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const { colors } = useTheme();
  const me = useCurrentUser();
  const location = useLocation(me.coords);
  const instructor = useInstructor(id, location.coords);
  const reviews = useInstructorReviews(id);
  const streams = useStreams();
  const listings = useListings({ sellerId: instructor.data?.userId });
  const data = instructor.data;
  const dayLabels = locale === 'tr' ? DAY_LABELS_TR : DAY_LABELS_EN;
  const myStreams =
    streams.data?.filter((s) => s.hostId === data?.userId && s.status !== 'ended') ?? [];
  const isMe = data?.userId === me.id;

  return (
    <Screen edges={[]}>
      <View style={[styles.topActions, { top: insets.top + spacing.sm }]}>
        <IconButton
          icon="chevron-left"
          variant="blur"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/instructors'))}
          accessibilityLabel={t('common.back')}
        />
        {data ? (
          <IconButton
            icon="message-circle"
            variant="blur"
            onPress={() =>
              router.push({ pathname: '/chat/[id]', params: { id: data.userId, matchId: '' } })
            }
            accessibilityLabel={t('instructors.message')}
          />
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        {instructor.isError ? (
          <ErrorState onRetry={() => instructor.refetch()} />
        ) : instructor.isLoading ? (
          <Skeleton height={360} style={{ borderRadius: 0 }} />
        ) : data ? (
          <>
            <AdventureImage
              uri={data.user.coverUrl}
              adventureType={data.specialties[0] ?? 'hiking'}
              style={styles.cover}
              overlay
            />
            <View style={styles.body}>
              <View style={styles.headRow}>
                <View
                  style={[
                    styles.avatarRing,
                    { borderColor: colors.background, backgroundColor: colors.background },
                  ]}
                >
                  <Avatar
                    uri={data.user.avatarUrl}
                    name={data.user.displayName}
                    size={84}
                    verified={data.user.isVerified}
                  />
                </View>
                <View style={[styles.verified, { backgroundColor: colors.primarySoft }]}>
                  <Icon name="graduation-cap" size={13} color={colors.primary} strokeWidth={2.6} />
                  <Text variant="label" weight="extrabold" color="primary">
                    {t('instructors.verifiedInstructor').toLocaleUpperCase('tr-TR')}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 4 }}>
                <Text variant="h1">{data.user.displayName}</Text>
                <Text variant="body" color="textMuted">
                  {data.headline}
                </Text>
                <RatingStars rating={data.rating} count={data.reviewCount} />
              </View>

              <View style={styles.chips}>
                {data.specialties.map((type) => (
                  <Badge
                    key={type}
                    label={t(ADVENTURE_TYPE_META[type].labelKey)}
                    color={ADVENTURE_TYPE_META[type].color}
                    icon={ADVENTURE_TYPE_META[type].icon}
                  />
                ))}
              </View>

              <View
                style={[
                  styles.stats,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Stat value={`${data.studentsCount}`} label={t('instructors.students')} />
                <Stat value={`${data.yearsExperience}`} label={t('instructors.experience')} />
                <Stat
                  value={`${data.sessionDurationMin / 60} ${t('common.hour')}`}
                  label={t('home.duration')}
                />
                <Stat
                  value={data.distanceKm !== null ? formatDistance(data.distanceKm, locale) : '—'}
                  label={t('home.distance')}
                />
              </View>

              <Section title={t('instructors.about')}>
                <Text variant="body" color="textMuted">
                  {data.bio}
                </Text>
              </Section>

              <Section title={t('instructors.certifications')}>
                {data.certifications.map((c) => (
                  <View key={c} style={styles.certRow}>
                    <Icon name="medal" size={16} color={colors.accent} strokeWidth={2.2} />
                    <Text variant="bodySm" style={{ flex: 1 }}>
                      {c}
                    </Text>
                  </View>
                ))}
              </Section>

              <View style={styles.twoCol}>
                <Section title={t('instructors.languages')} style={{ flex: 1 }}>
                  <View style={styles.chips}>
                    {data.languages.map((l) => (
                      <Badge key={l} label={l} color={colors.info} icon="languages" />
                    ))}
                  </View>
                </Section>
              </View>

              <Section title={t('instructors.availability')}>
                <View style={styles.days}>
                  {dayLabels.map((label, i) => {
                    const active = data.availableDays.includes(i);
                    return (
                      <View
                        key={label}
                        style={[
                          styles.day,
                          {
                            backgroundColor: active ? colors.primary : colors.surfaceMuted,
                            borderColor: active ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          variant="label"
                          weight="extrabold"
                          color={active ? colors.onPrimary : colors.textSubtle}
                        >
                          {label.toLocaleUpperCase('tr-TR')}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Section>

              <Section title={t('instructors.reviewsTitle')}>
                {reviews.isLoading ? (
                  <Skeleton height={64} style={{ borderRadius: radius.lg }} />
                ) : reviews.data && reviews.data.length > 0 ? (
                  reviews.data.map((r) => (
                    <View
                      key={r.id}
                      style={[
                        styles.review,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <View style={styles.reviewHead}>
                        <Avatar uri={r.author.avatarUrl} name={r.author.displayName} size={30} />
                        <View style={{ flex: 1 }}>
                          <Text variant="bodySm" weight="bold">
                            {r.author.displayName}
                          </Text>
                          <RatingStars rating={r.rating} size={11} />
                        </View>
                        <Text variant="caption" color="textSubtle">
                          {formatRelative(r.createdAt, new Date(), locale)}
                        </Text>
                      </View>
                      <Text variant="bodySm" color="textMuted">
                        {r.content}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text variant="bodySm" color="textSubtle">
                    {t('instructors.noReviews')}
                  </Text>
                )}
              </Section>
            </View>

            {myStreams.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader title={t('instructors.upcomingStreams')} />
                <View style={styles.list}>
                  {myStreams.map((s) => (
                    <StreamCard key={s.id} stream={s} row />
                  ))}
                </View>
              </View>
            ) : null}

            {listings.data && listings.data.length > 0 ? (
              <View style={styles.section}>
                <SectionHeader
                  title={t('instructors.listings')}
                  actionLabel={t('common.seeAll')}
                  onAction={() => router.push('/market')}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.hList}
                >
                  {listings.data.map((l) => (
                    <ListingCard key={l.id} listing={l} width={170} />
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        ) : (
          <EmptyState
            icon="graduation-cap"
            title={t('notFound.title')}
            description={t('notFound.description')}
          />
        )}
      </ScrollView>
      {data && !isMe ? (
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="textSubtle">
              {t('instructors.perSession')} · {data.sessionDurationMin} {t('common.min')}
            </Text>
            <Text variant="h3" color="primary">
              {formatPriceTry(data.pricePerSessionTry, locale)}
            </Text>
          </View>
          <Button
            label={t('instructors.book')}
            icon="calendar-check"
            size="lg"
            onPress={() =>
              router.push({ pathname: '/instructors/book', params: { instructorId: data.id } })
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}

function Section({
  title,
  children,
  style,
}: {
  title: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      <Text variant="h3">{title}</Text>
      {children}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="title" weight="extrabold">
        {value}
      </Text>
      <Text variant="label" color="textSubtle" align="center" numberOfLines={1}>
        {label.toLocaleUpperCase('tr-TR')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topActions: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cover: { width: '100%', height: 180 },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    marginTop: -42,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  avatarRing: { borderWidth: 4, borderRadius: 50 },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    height: 26,
    borderRadius: radius.full,
    marginBottom: spacing.xs,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stats: {
    flexDirection: 'row',
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  days: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  review: {
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm + 2 },
  hList: { paddingHorizontal: spacing.lg, gap: spacing.md },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
