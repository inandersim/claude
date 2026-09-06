import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Input,
  ProgressRing,
  Screen,
  SectionHeader,
  Skeleton,
  Tappable,
  Text,
  type IconName,
} from '@/components/ui';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  CHILD_AVATARS,
  KID_PLACE_KINDS,
  KID_SAFETY_TIPS,
  huntCardTasks,
  huntCompletionPct,
  kidAgeBandMeta,
  kidPlaceKindMeta,
  type ChildProfile,
  type KidAgeBand,
  type KidPlaceKind,
} from '@/domain';
import { useCurrentUser } from '@/features/auth/session.store';
import { SearchBar } from '@/features/explore/components/SearchBar';
import { AgeBandChips } from '@/features/kids/components/AgeBandChips';
import { ChildAvatarPicker } from '@/features/kids/components/ChildAvatarPicker';
import { ChildCard } from '@/features/kids/components/ChildCard';
import { KidPlaceCard } from '@/features/kids/components/KidPlaceCard';
import { confirmDialog } from '@/features/kids/confirm';
import {
  useAddChild,
  useChildren,
  useHuntProgress,
  useHuntTasks,
  useKidPlaces,
  useKidsPrograms,
  useRemoveChild,
} from '@/features/kids/hooks';

/** Çocuk ekleme formu (satır içi kart). */
function AddChildForm({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const add = useAddChild();
  const [name, setName] = useState('');
  const [ageBand, setAgeBand] = useState<KidAgeBand>('4_6');
  const [avatar, setAvatar] = useState<string>(CHILD_AVATARS[0]);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError(t('kids.child.nameRequired'));
      return;
    }
    add.mutate(
      { name: name.trim(), ageBand, avatar },
      {
        onSuccess: (child) => {
          toast(t('kids.child.added', { name: child.name }), 'success');
          onDone();
        },
        onError: (e) => setError(e instanceof Error ? e.message : t('common.error')),
      },
    );
  };

  return (
    <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="title" weight="extrabold">
        {t('kids.child.addTitle')}
      </Text>
      <Input
        label={t('kids.child.name')}
        placeholder={t('kids.child.namePlaceholder')}
        icon="user"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        error={error}
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View style={{ gap: spacing.sm }}>
        <Text variant="label" color="textSubtle">
          {t('kids.child.age').toLocaleUpperCase('tr-TR')}
        </Text>
        <AgeBandChips
          value={ageBand}
          onChange={(b) => b && setAgeBand(b)}
          allowAll={false}
          size="sm"
          wrap
        />
      </View>
      <ChildAvatarPicker value={avatar} onChange={setAvatar} />
      <View style={styles.formActions}>
        <Button label={t('kids.child.cancel')} variant="ghost" size="sm" onPress={onDone} />
        <Button
          label={t('kids.child.save')}
          icon="check"
          size="sm"
          onPress={submit}
          loading={add.isPending}
        />
      </View>
    </View>
  );
}

export default function KidsScreen() {
  const router = useRouter();
  const { t } = useT();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const me = useCurrentUser();
  const toast = useToast();

  const children = useChildren();
  const removeChild = useRemoveChild();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const selectedChild: ChildProfile | null = useMemo(() => {
    const list = children.data ?? [];
    return list.find((c) => c.id === selectedChildId) ?? list[0] ?? null;
  }, [children.data, selectedChildId]);

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KidPlaceKind | null>(null);
  const [ageBand, setAgeBand] = useState<KidAgeBand | null>(null);
  const [strollerOnly, setStrollerOnly] = useState(false);
  const effectiveAge = ageBand ?? selectedChild?.ageBand ?? null;

  const places = useKidPlaces({
    query,
    kind,
    ageBand: effectiveAge,
    strollerOnly,
    origin: me.coords,
  });
  const tasks = useHuntTasks(selectedChild?.ageBand ?? null);
  const progress = useHuntProgress(selectedChild?.name ?? null);
  const programs = useKidsPrograms();

  const card = useMemo(
    () => huntCardTasks(tasks.data ?? [], selectedChild?.ageBand ?? null, 3),
    [tasks.data, selectedChild?.ageBand],
  );
  const pct = progress.data ? huntCompletionPct(progress.data, card) : 0;
  const columns = width >= 900 ? 3 : width >= 620 ? 2 : 1;
  const contentWidth = Math.min(width, layout.maxContentWidth) - spacing.lg * 2;
  const cardWidth =
    columns === 1 ? undefined : (contentWidth - spacing.md * (columns - 1)) / columns;

  const onRemove = (child: ChildProfile) =>
    confirmDialog(
      t('kids.child.remove'),
      t('kids.child.removeConfirm', { name: child.name }),
      t('common.delete'),
      t('common.cancel'),
      () =>
        removeChild.mutate(child.id, {
          onSuccess: () => {
            toast(t('kids.child.removed'), 'info');
            if (selectedChildId === child.id) setSelectedChildId(null);
          },
        }),
    );

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('kids.title')} subtitle={t('kids.subtitle')} showBack />
      <View style={styles.content}>
        {/* Çocuk profilleri */}
        <SectionHeader
          title={t('kids.child.title')}
          actionLabel={showForm ? undefined : t('kids.child.add')}
          onAction={showForm ? undefined : () => setShowForm(true)}
        />
        {children.isError ? (
          <ErrorState onRetry={() => children.refetch()} />
        ) : children.isLoading ? (
          <Skeleton height={72} style={{ borderRadius: radius.xl }} />
        ) : (children.data?.length ?? 0) > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {children.data!.map((c) => (
              <ChildCard
                key={c.id}
                child={c}
                compact
                selected={selectedChild?.id === c.id}
                onPress={() => setSelectedChildId(c.id)}
                onRemove={() => onRemove(c)}
              />
            ))}
          </View>
        ) : !showForm ? (
          <EmptyState
            compact
            icon="user-plus"
            title={t('kids.child.empty')}
            description={t('kids.child.emptyDescription')}
            action={{ label: t('kids.child.add'), icon: 'plus', onPress: () => setShowForm(true) }}
          />
        ) : null}
        {showForm ? <AddChildForm onDone={() => setShowForm(false)} /> : null}

        {/* Doğa avı büyük kart */}
        <Tappable
          onPress={() => router.push('/kids/hunt')}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={t('kids.hunt.title')}
          style={[
            styles.hero,
            { backgroundColor: colors.primarySoft, borderColor: colors.primary },
          ]}
        >
          <ProgressRing value={pct} size={64} color={colors.primary}>
            <Text variant="caption" weight="extrabold" color="primary">
              {pct}%
            </Text>
          </ProgressRing>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h3">{t('kids.hunt.title')}</Text>
            <Text variant="caption" color="textMuted" numberOfLines={2}>
              {selectedChild
                ? t('kids.hunt.forChild', { name: selectedChild.name }) +
                  (progress.data
                    ? ` · ${t('kids.hunt.points', { points: progress.data.points })}`
                    : '')
                : t('kids.hunt.noChild')}
            </Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.primary} />
        </Tappable>

        {/* Hızlı erişim */}
        <View style={styles.quickRow}>
          <Tappable
            onPress={() => router.push('/kids/checklist')}
            accessibilityRole="button"
            accessibilityLabel={t('kids.checklist.title')}
            style={[styles.quick, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon name="list-checks" size={20} color={colors.accent} strokeWidth={2.4} />
            <Text variant="bodySm" weight="bold" numberOfLines={2} style={{ flex: 1 }}>
              {t('kids.checklist.title')}
            </Text>
          </Tappable>
          <Tappable
            onPress={() => router.push('/tv')}
            accessibilityRole="button"
            accessibilityLabel={t('kids.videos')}
            style={[styles.quick, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Icon name="video" size={20} color={colors.info} strokeWidth={2.4} />
            <Text variant="bodySm" weight="bold" numberOfLines={2} style={{ flex: 1 }}>
              {t('kids.videos')}
            </Text>
          </Tappable>
        </View>

        {/* Çocuk dostu videolar (varsa) */}
        {programs.data && programs.data.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <SectionHeader
              title={t('kids.videos')}
              subtitle={t('kids.videosSubtitle')}
              actionLabel={t('common.seeAll')}
              onAction={() => router.push('/tv')}
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              style={{ marginHorizontal: -spacing.lg }}
            >
              {programs.data.map((p) => (
                <Tappable
                  key={p.id}
                  onPress={() => router.push({ pathname: '/tv/watch/[id]', params: { id: p.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={p.title}
                  style={[
                    styles.video,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Icon name="circle-play" size={22} color={colors.info} />
                  <Text variant="bodySm" weight="bold" numberOfLines={2}>
                    {p.title}
                  </Text>
                  <Text variant="label" color="textSubtle">
                    {p.durationMin} dk
                  </Text>
                </Tappable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Güvenlik ipuçları şeridi */}
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t('kids.tips')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={{ marginHorizontal: -spacing.lg }}
          >
            {KID_SAFETY_TIPS.map((tip) => (
              <View
                key={tip.key}
                style={[
                  styles.tip,
                  { backgroundColor: colors.warningSoft, borderColor: colors.warning },
                ]}
              >
                <Icon
                  name={tip.icon as IconName}
                  size={18}
                  color={colors.warning}
                  strokeWidth={2.4}
                />
                <Text variant="caption" numberOfLines={3} style={{ flex: 1 }}>
                  {t(tip.key)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Arama ve filtreler */}
        <SectionHeader title={t('kids.nearby')} subtitle={t('kids.nearbySubtitle')} />
        <SearchBar value={query} onChange={setQuery} placeholder={t('kids.searchPlaceholder')} />
        <AgeBandChips value={effectiveAge} onChange={setAgeBand} size="sm" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ marginHorizontal: -spacing.lg }}
        >
          <Chip
            label={t('kids.stroller')}
            icon="backpack"
            size="sm"
            selected={strollerOnly}
            onPress={() => setStrollerOnly((v) => !v)}
          />
          {KID_PLACE_KINDS.map((k) => (
            <Chip
              key={k}
              label={t(kidPlaceKindMeta[k].labelKey)}
              icon={kidPlaceKindMeta[k].icon as IconName}
              color={kidPlaceKindMeta[k].color}
              size="sm"
              selected={kind === k}
              onPress={() => setKind(kind === k ? null : k)}
            />
          ))}
        </ScrollView>

        {/* Liste */}
        {places.isError ? (
          <ErrorState onRetry={() => places.refetch()} />
        ) : places.isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} height={240} style={{ borderRadius: radius.xl }} />)
        ) : places.data && places.data.length > 0 ? (
          <>
            <Text variant="caption" color="textSubtle">
              {t('kids.results', { count: places.data.length })}
              {effectiveAge ? ` · ${t(kidAgeBandMeta[effectiveAge].labelKey)}` : ''}
            </Text>
            <View style={[styles.grid, { gap: spacing.md }]}>
              {places.data.map((p) => (
                <KidPlaceCard key={p.id} place={p} width={cardWidth} />
              ))}
            </View>
          </>
        ) : (
          <EmptyState
            icon="trees"
            title={t('kids.empty')}
            description={t('kids.emptyDescription')}
            action={{
              label: t('common.all'),
              variant: 'secondary',
              onPress: () => {
                setKind(null);
                setAgeBand(null);
                setStrollerOnly(false);
                setQuery('');
              },
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  form: { borderRadius: radius.xl, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xxl,
    borderWidth: 1,
  },
  quickRow: { flexDirection: 'row', gap: spacing.md },
  quick: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingVertical: 2 },
  video: {
    width: 150,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.xs,
  },
  tip: {
    width: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
});
