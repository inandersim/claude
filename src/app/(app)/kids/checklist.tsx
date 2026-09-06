import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Header,
  ProgressRing,
  Screen,
  Skeleton,
  Text,
} from '@/components/ui';
import { useT } from '@/core/i18n';
import { layout, radius, spacing, useTheme } from '@/core/theme';
import type { KidAgeBand } from '@/domain';
import { AgeBandChips } from '@/features/kids/components/AgeBandChips';
import { FamilyChecklist } from '@/features/kids/components/FamilyChecklist';
import { useChecklistStore, useChildren, useFamilyChecklist } from '@/features/kids/hooks';

export default function FamilyChecklistScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const children = useChildren();
  const [ageOverride, setAgeOverride] = useState<KidAgeBand | null | undefined>(undefined);
  // Varsayılan: ilk çocuğun yaş bandı; kullanıcı "tüm yaşlar" da seçebilir
  const ageBand: KidAgeBand | null =
    ageOverride === undefined ? (children.data?.[0]?.ageBand ?? null) : ageOverride;
  const list = useFamilyChecklist(ageBand);
  const checked = useChecklistStore((s) => s.checked);
  const toggle = useChecklistStore((s) => s.toggle);
  const clear = useChecklistStore((s) => s.clear);

  const items = useMemo(() => list.data ?? [], [list.data]);
  const done = items.filter((i) => checked[i.key]).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('kids.checklist.title')}
        subtitle={t('kids.checklist.subtitle')}
        showBack
        right={
          done > 0 ? (
            <Button label={t('kids.checklist.reset')} variant="ghost" size="sm" onPress={clear} />
          ) : undefined
        }
      />
      <View style={styles.content}>
        <AgeBandChips value={ageBand} onChange={setAgeOverride} size="sm" />

        <View
          style={[
            styles.summary,
            {
              backgroundColor: pct === 100 ? colors.successSoft : colors.surface,
              borderColor: pct === 100 ? colors.success : colors.border,
            },
          ]}
        >
          <ProgressRing value={pct} size={56} color={pct === 100 ? colors.success : colors.primary}>
            <Text variant="label" weight="extrabold" color={pct === 100 ? 'success' : 'primary'}>
              {pct}%
            </Text>
          </ProgressRing>
          <View style={{ flex: 1 }}>
            <Text variant="title" weight="extrabold">
              {pct === 100
                ? t('kids.checklist.ready')
                : t('kids.checklist.progress', { done, total: items.length })}
            </Text>
            <Text variant="caption" color="textMuted">
              {ageBand ? t(`kids.ageBand.${ageBand}`) : t('kids.ageBand.all')}
            </Text>
          </View>
        </View>

        {list.isError ? (
          <ErrorState onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          [0, 1, 2].map((i) => (
            <Skeleton key={i} height={180} style={{ borderRadius: radius.xl }} />
          ))
        ) : items.length === 0 ? (
          <EmptyState icon="list-checks" title={t('kids.empty')} />
        ) : (
          <FamilyChecklist items={items} checked={checked} onToggle={toggle} />
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
});
