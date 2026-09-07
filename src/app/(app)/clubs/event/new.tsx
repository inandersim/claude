import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Chip,
  EmptyState,
  Header,
  Icon,
  IconButton,
  Input,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { goBack } from '@/core/navigation';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  ADVENTURE_TYPE_META,
  ADVENTURE_TYPES,
  CLUB_EVENT_KINDS,
  type AdventureType,
  type ClubEventKind,
} from '@/domain';
import { EVENT_KIND_ICON } from '@/features/clubs/components/meta';
import { useClub, useCreateClubEvent } from '@/features/clubs/hooks';

const START_OPTIONS = [1, 3, 7, 14, 30];
const DURATION_OPTIONS: { hours: number }[] = [
  { hours: 2 },
  { hours: 4 },
  { hours: 8 },
  { hours: 24 },
  { hours: 48 },
  { hours: 72 },
];
const CAPACITY_OPTIONS: (number | null)[] = [null, 10, 20, 30, 50];

export default function NewClubEventScreen() {
  const { clubId } = useLocalSearchParams<{ clubId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const club = useClub(clubId);
  const create = useCreateClubEvent();
  const [now] = useState(() => Date.now());

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ClubEventKind>('trip');
  const [adventureType, setAdventureType] = useState<AdventureType>(
    club.data?.adventureTypes[0] ?? 'hiking',
  );
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startsIn, setStartsIn] = useState(7);
  const [durationH, setDurationH] = useState(8);
  const [capacity, setCapacity] = useState<number | null>(20);
  const [price, setPrice] = useState('0');
  const [openToAll, setOpenToAll] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const titleError = submitted && !title.trim() ? t('clubs.form.titleRequired') : null;
  const locationError = submitted && !location.trim() ? t('clubs.form.locationRequired') : null;
  // Kulüp kimliği yoksa/kulüp bulunamadıysa ya da üye değilsen form kullanılamaz.
  const blocked = !club.isLoading && club.data?.membership !== 'member';

  const submit = () => {
    setSubmitted(true);
    if (!title.trim() || !location.trim()) return;
    const start = new Date(now + startsIn * 86_400_000);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + durationH * 3_600_000);
    create.mutate(
      {
        clubId,
        title,
        kind,
        adventureType,
        description,
        locationName: location,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        capacity,
        openToAll,
        priceTry: Number.parseInt(price, 10) || 0,
      },
      {
        onSuccess: (e) => {
          toast(t('clubs.form.created'), 'success');
          router.replace({ pathname: '/clubs/event/[id]', params: { id: e.id } });
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  const durationLabel = (h: number) =>
    h >= 24 ? t('clubs.form.days', { count: h / 24 }) : t('clubs.form.hours', { count: h });

  return (
    <Screen edges={Platform.OS === 'ios' ? [] : ['top']}>
      <Header
        title={t('clubs.createEventTitle')}
        subtitle={club.data?.name}
        right={
          <IconButton
            icon="x"
            onPress={() => goBack(router)}
            accessibilityLabel={t('common.close')}
          />
        }
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
      >
        {club.isLoading ? (
          <Skeleton height={60} style={{ borderRadius: radius.xl }} />
        ) : !club.data ? (
          <EmptyState
            icon="school"
            title={t('clubs.notFound')}
            description={t('clubs.notFoundDescription')}
            action={{
              label: t('clubs.discover'),
              icon: 'search',
              variant: 'secondary',
              onPress: () => router.replace('/clubs'),
            }}
          />
        ) : blocked ? (
          <EmptyState
            icon="lock"
            title={t('clubs.memberOnlyCreate')}
            description={club.data.name}
            action={{
              label: t('clubs.join'),
              icon: 'users',
              onPress: () =>
                router.replace({ pathname: '/clubs/[id]', params: { id: club.data!.id } }),
            }}
          />
        ) : (
          <>
            <Input
              label={t('clubs.form.title')}
              icon="pencil"
              placeholder={t('clubs.form.titlePlaceholder')}
              value={title}
              onChangeText={setTitle}
              error={titleError}
              accessibilityLabel={t('clubs.form.title')}
            />

            <Field title={t('clubs.form.kind')}>
              <View style={styles.chips}>
                {CLUB_EVENT_KINDS.map((k) => (
                  <Chip
                    key={k}
                    label={t(`clubs.eventKind.${k}`)}
                    icon={EVENT_KIND_ICON[k]}
                    size="sm"
                    selected={kind === k}
                    onPress={() => setKind(k)}
                  />
                ))}
              </View>
            </Field>

            <Field title={t('clubs.form.adventureType')}>
              <View style={styles.chips}>
                {ADVENTURE_TYPES.map((a) => (
                  <Chip
                    key={a}
                    label={t(ADVENTURE_TYPE_META[a].labelKey)}
                    icon={ADVENTURE_TYPE_META[a].icon}
                    color={ADVENTURE_TYPE_META[a].color}
                    size="sm"
                    selected={adventureType === a}
                    onPress={() => setAdventureType(a)}
                  />
                ))}
              </View>
            </Field>

            <Input
              label={t('clubs.form.location')}
              icon="map-pin"
              placeholder={t('clubs.form.locationPlaceholder')}
              value={location}
              onChangeText={setLocation}
              error={locationError}
              accessibilityLabel={t('clubs.form.location')}
            />

            <Input
              label={t('clubs.form.description')}
              placeholder={t('clubs.form.descriptionPlaceholder')}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              style={{ minHeight: 96, textAlignVertical: 'top' }}
              accessibilityLabel={t('clubs.form.description')}
            />

            <Field title={t('clubs.form.startsIn')}>
              <View style={styles.chips}>
                {START_OPTIONS.map((d) => (
                  <Chip
                    key={d}
                    label={t('clubs.form.inDays', { count: d })}
                    size="sm"
                    selected={startsIn === d}
                    onPress={() => setStartsIn(d)}
                  />
                ))}
              </View>
            </Field>

            <Field title={t('clubs.form.duration')}>
              <View style={styles.chips}>
                {DURATION_OPTIONS.map(({ hours }) => (
                  <Chip
                    key={hours}
                    label={durationLabel(hours)}
                    size="sm"
                    selected={durationH === hours}
                    onPress={() => setDurationH(hours)}
                  />
                ))}
              </View>
            </Field>

            <Field title={t('clubs.form.capacity')}>
              <View style={styles.chips}>
                {CAPACITY_OPTIONS.map((c) => (
                  <Chip
                    key={c ?? 'none'}
                    label={c === null ? t('clubs.form.unlimited') : String(c)}
                    size="sm"
                    selected={capacity === c}
                    onPress={() => setCapacity(c)}
                  />
                ))}
              </View>
            </Field>

            <Input
              label={t('clubs.form.price')}
              icon="banknote"
              value={price}
              onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              hint={t('clubs.free')}
              accessibilityLabel={t('clubs.form.price')}
            />

            <View style={styles.chips}>
              <Chip
                label={t('clubs.form.openToAll')}
                icon={openToAll ? 'globe' : 'lock'}
                selected={openToAll}
                onPress={() => setOpenToAll((v) => !v)}
              />
            </View>

            <View style={[styles.hint, { backgroundColor: colors.surfaceMuted }]}>
              <Icon name="info" size={16} color={colors.textMuted} />
              <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
                {openToAll ? t('clubs.openToAll') : t('clubs.membersOnly')} ·{' '}
                {capacity === null ? t('clubs.noCapacity') : `${t('clubs.capacity')} ${capacity}`}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
      {blocked ? null : (
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
          <Button
            label={t('clubs.form.submit')}
            icon="calendar-plus"
            size="lg"
            fullWidth
            loading={create.isPending}
            disabled={club.isLoading}
            onPress={submit}
          />
        </View>
      )}
    </Screen>
  );
}

function Field({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" color="textMuted" style={{ marginLeft: spacing.xs }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
