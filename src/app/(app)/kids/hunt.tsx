import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  ProgressRing,
  Screen,
  SegmentedControl,
  Skeleton,
  Text,
} from '@/components/ui';
import { haptics } from '@/core/hooks/useHaptics';
import { useToast } from '@/core/hooks/useToast';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import {
  KID_STICKER_META,
  earnedStickers,
  huntCardTasks,
  huntCompletionPct,
  type ChildProfile,
  type HuntTask,
} from '@/domain';
import { ChildCard } from '@/features/kids/components/ChildCard';
import { HuntBingoGrid } from '@/features/kids/components/HuntBingoGrid';
import { StickerShelf } from '@/features/kids/components/StickerShelf';
import { confirmDialog } from '@/features/kids/confirm';
import {
  useChildren,
  useCompleteTask,
  useHuntProgress,
  useHuntTasks,
  useResetHunt,
} from '@/features/kids/hooks';

type GridSize = '3' | '4';

/** Seçili çocuk için kart, çıkartma rafı ve sıfırlama. */
function HuntBoard({ child, size }: { child: ChildProfile; size: 3 | 4 }) {
  const { t } = useT();
  const { colors } = useTheme();
  const toast = useToast();
  const tasks = useHuntTasks(child.ageBand);
  const progress = useHuntProgress(child.name);
  const complete = useCompleteTask(child.name);
  const reset = useResetHunt(child.name);

  const card = useMemo(
    () => huntCardTasks(tasks.data ?? [], child.ageBand, size),
    [tasks.data, child.ageBand, size],
  );
  const pct = progress.data ? huntCompletionPct(progress.data, card) : 0;

  const onComplete = (task: HuntTask) => {
    const before = progress.data?.points ?? 0;
    const beforeStickers = earnedStickers(before);
    haptics.success();
    toast(t('kids.hunt.celebrate', { name: child.name, points: task.points }), 'success');
    complete.mutate(
      { taskId: task.id, points: task.points },
      {
        onSuccess: (p) => {
          const fresh = p.stickers.filter((s) => !(beforeStickers as string[]).includes(s));
          const last = fresh[fresh.length - 1];
          if (last && last in KID_STICKER_META) {
            const meta = KID_STICKER_META[last as keyof typeof KID_STICKER_META];
            toast(
              t('kids.hunt.stickerEarned', { sticker: `${meta.emoji} ${t(meta.labelKey)}` }),
              'success',
            );
          } else if (huntCompletionPct(p, card) === 100) {
            toast(t('kids.hunt.allDone'), 'info');
          }
        },
        onError: (e) => toast(e instanceof Error ? e.message : t('common.error'), 'error'),
      },
    );
  };

  const onReset = () =>
    confirmDialog(
      t('kids.hunt.reset'),
      t('kids.hunt.resetConfirm'),
      t('kids.hunt.reset'),
      t('common.cancel'),
      () => reset.mutate(undefined, { onSuccess: () => toast(t('kids.hunt.resetDone'), 'info') }),
    );

  if (tasks.isError || progress.isError) {
    return (
      <ErrorState
        onRetry={() => {
          tasks.refetch();
          progress.refetch();
        }}
      />
    );
  }
  if (tasks.isLoading || progress.isLoading || !progress.data) {
    return (
      <View style={{ gap: spacing.md }}>
        <Skeleton height={64} style={{ borderRadius: radius.xl }} />
        <Skeleton height={320} style={{ borderRadius: radius.xl }} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View
        style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <ProgressRing value={pct} size={56} color={colors.primary}>
          <Text variant="label" weight="extrabold" color="primary">
            {pct}%
          </Text>
        </ProgressRing>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" weight="extrabold">
            {t('kids.hunt.forChild', { name: child.name })}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('kids.hunt.progress', {
              done: card.filter((x) => progress.data.completedTaskIds.includes(x.id)).length,
              total: card.length,
            })}
            {' · '}
            {t('kids.hunt.points', { points: progress.data.points })}
          </Text>
        </View>
      </View>

      {card.length === 0 ? (
        <EmptyState compact icon="puzzle" title={t('kids.empty')} />
      ) : (
        <HuntBingoGrid
          tasks={card}
          completedIds={progress.data.completedTaskIds}
          size={size}
          onComplete={onComplete}
          disabled={complete.isPending}
        />
      )}

      <StickerShelf progress={progress.data} />

      <Button
        label={t('kids.hunt.reset')}
        icon="refresh-cw"
        variant="ghost"
        onPress={onReset}
        loading={reset.isPending}
        disabled={progress.data.completedTaskIds.length === 0 && progress.data.points === 0}
      />
    </View>
  );
}

export default function HuntScreen() {
  const router = useRouter();
  const { t, locale } = useT();
  const children = useChildren();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [size, setSize] = useState<GridSize>('3');

  const selected = useMemo(() => {
    const list = children.data ?? [];
    return list.find((c) => c.id === selectedId) ?? list[0] ?? null;
  }, [children.data, selectedId]);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('kids.hunt.title')} subtitle={t('kids.hunt.subtitle')} showBack />
      <View style={styles.content}>
        {children.isError ? (
          <ErrorState onRetry={() => children.refetch()} />
        ) : children.isLoading ? (
          <Skeleton height={72} style={{ borderRadius: radius.xl }} />
        ) : (children.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon="user-plus"
            title={t('kids.child.empty')}
            description={t('kids.hunt.noChild')}
            action={{
              label: t('kids.child.add'),
              icon: 'plus',
              onPress: () => router.push('/kids'),
            }}
          />
        ) : (
          <>
            <Text variant="label" color="textSubtle">
              {t('kids.hunt.pickChild').toLocaleUpperCase(locale)}
            </Text>
            <View style={{ gap: spacing.sm }}>
              {children.data!.map((c) => (
                <ChildCard
                  key={c.id}
                  child={c}
                  compact
                  selected={selected?.id === c.id}
                  onPress={() => setSelectedId(c.id)}
                />
              ))}
            </View>
            <View style={styles.sizeRow}>
              <Text variant="caption" weight="bold" color="textMuted" style={{ flex: 1 }}>
                {t('kids.hunt.gridSize')}
              </Text>
              <View style={{ width: 160 }}>
                <SegmentedControl<GridSize>
                  segments={[
                    { value: '3', label: t('kids.hunt.grid3') },
                    { value: '4', label: t('kids.hunt.grid4') },
                  ]}
                  value={size}
                  onChange={setSize}
                />
              </View>
            </View>
            {selected ? <HuntBoard child={selected} size={size === '4' ? 4 : 3} /> : null}
          </>
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
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  sizeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
